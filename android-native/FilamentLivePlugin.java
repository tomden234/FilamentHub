package com.filamenthub.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

// Live-Update: lädt die neue Web-Oberfläche (live-bundle.zip aus dem GitHub-Release) in den App-Speicher.
// Die App bleibt dieselbe (gleiche Signatur, gleiche Daten), nur die Oberfläche wird ausgetauscht.
// Beim Start lädt MainActivity die neueste heruntergeladene Version. Geht etwas schief, fällt sie auf die eingebaute zurück.
@CapacitorPlugin(name = "FilamentLive")
public class FilamentLivePlugin extends Plugin {

    /** Muss mit "nativeApi" in live-version.json (apk.yml) übereinstimmen. Erhöhen, wenn sich Java-Plugins ändern. */
    public static final int NATIVE_API = 8;

    static final String PREFS = "filament_live";

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isNewer(String a, String b) {
        String[] x = a.split("[^0-9]+");
        String[] y = b.split("[^0-9]+");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length && !x[i].isEmpty() ? Integer.parseInt(x[i]) : 0;
            int q = i < y.length && !y[i].isEmpty() ? Integer.parseInt(y[i]) : 0;
            if (p != q) return p > q;
        }
        return false;
    }

    static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteRecursive(k);
        f.delete();
    }

    static void clear(Context c) {
        prefs(c).edit().remove("livePath").remove("liveVersion").putInt("bootTries", 0).apply();
        deleteRecursive(new File(c.getFilesDir(), "live"));
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject o = new JSObject();
        o.put("liveVersion", prefs(getContext()).getString("liveVersion", ""));
        o.put("nativeApi", NATIVE_API);
        call.resolve(o);
    }

    @PluginMethod
    public void markGood(PluginCall call) {
        prefs(getContext()).edit().putInt("bootTries", 0).apply();
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        clear(getContext());
        call.resolve();
    }

    /** Neue Oberfläche sofort laden (sonst erst beim nächsten Start) */
    @PluginMethod
    public void apply(PluginCall call) {
        String path = prefs(getContext()).getString("livePath", null);
        if (path == null || !new File(path, "index.html").exists()) {
            call.reject("Kein Live-Update vorhanden");
            return;
        }
        getBridge().setServerBasePath(path);
        call.resolve();
    }

    /**
     * Neue APK direkt in der App laden und den Android-Installer öffnen (kein Browser).
     * Einmal "Installieren" bestätigen, die Daten bleiben erhalten.
     */
    @PluginMethod
    public void installApk(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null) {
            call.reject("url erforderlich");
            return;
        }
        final Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
            // Einmalig: dieser App das Installieren erlauben
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(settings);
            call.reject("needPermission");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(ctx.getCacheDir(), "apk");
                deleteRecursive(dir);
                dir.mkdirs();
                File apk = new File(dir, "FilamentHub.apk");
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(60000);
                conn.setInstanceFollowRedirects(true);
                if (conn.getResponseCode() != 200) throw new Exception("HTTP " + conn.getResponseCode());
                try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(install);
                call.resolve();
            } catch (Exception e) {
                call.reject("Download fehlgeschlagen: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        final String version = call.getString("version");
        if (url == null || version == null || !version.matches("[0-9A-Za-z._-]+")) {
            call.reject("url und version erforderlich");
            return;
        }
        final Context ctx = getContext();
        new Thread(() -> {
            File root = new File(ctx.getFilesDir(), "live");
            File tmp = new File(root, version + ".tmp");
            File target = new File(root, version);
            try {
                deleteRecursive(tmp);
                tmp.mkdirs();
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setInstanceFollowRedirects(true);
                if (conn.getResponseCode() != 200) throw new Exception("HTTP " + conn.getResponseCode());
                String tmpCanonical = tmp.getCanonicalPath() + File.separator;
                try (InputStream in = conn.getInputStream(); ZipInputStream zip = new ZipInputStream(in)) {
                    ZipEntry entry;
                    byte[] buf = new byte[16384];
                    while ((entry = zip.getNextEntry()) != null) {
                        File out = new File(tmp, entry.getName());
                        if (!out.getCanonicalPath().startsWith(tmpCanonical)) throw new Exception("Ungültiger Pfad im Paket");
                        if (entry.isDirectory()) {
                            out.mkdirs();
                            continue;
                        }
                        out.getParentFile().mkdirs();
                        try (FileOutputStream fos = new FileOutputStream(out)) {
                            int n;
                            while ((n = zip.read(buf)) > 0) fos.write(buf, 0, n);
                        }
                    }
                }
                if (!new File(tmp, "index.html").exists()) throw new Exception("index.html fehlt im Paket");
                deleteRecursive(target);
                if (!tmp.renameTo(target)) throw new Exception("Umbenennen fehlgeschlagen");
                // alte Versionen aufräumen
                File[] old = root.listFiles();
                if (old != null) for (File f : old) if (!f.equals(target)) deleteRecursive(f);
                prefs(ctx).edit().putString("livePath", target.getAbsolutePath()).putString("liveVersion", version).putInt("bootTries", 0).apply();
                JSObject o = new JSObject();
                o.put("version", version);
                call.resolve(o);
            } catch (Exception e) {
                deleteRecursive(tmp);
                call.reject("Download fehlgeschlagen: " + e.getMessage());
            }
        }).start();
    }
}
