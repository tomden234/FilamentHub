package com.filamenthub.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// Meldungen aufs Handy: Berechtigung anfragen (Android 13+), Meldung zeigen, Android-Einstellungen öffnen.
// Tipp auf eine Meldung: Die App öffnet sich und bekommt die ID der Mitteilung (consumeTap / Ereignis notificationTap).
@CapacitorPlugin(
    name = "FilamentNotify",
    permissions = { @Permission(strings = { "android.permission.POST_NOTIFICATIONS" }, alias = "notifications") }
)
public class FilamentNotifyPlugin extends Plugin {
    private static final String CHANNEL = "filamenthub_alerts";
    private static final String EXTRA_ID = "fh_inbox_id";
    // ID der zuletzt angetippten Meldung, bis die Oberfläche sie abgeholt hat
    private static String pendingId = "";

    @Override
    public void load() {
        super.load();
        try {
            // Kaltstart durch Tipp auf die Meldung: ID aus dem Start-Intent lesen
            Intent in = getActivity().getIntent();
            rememberTap(in, false);
        } catch (Exception ignored) {
            // kein Start-Intent
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        rememberTap(intent, true);
    }

    // Link zu einer Spule (QR-Etikett): filamenthub://spool/ID oder https://…github.io/…/#s=ID
    private static String spoolFromLink(Intent intent) {
        try {
            android.net.Uri d = intent.getData();
            if (d == null) return "";
            String scheme = d.getScheme();
            if ("filamenthub".equals(scheme)) {
                String last = d.getLastPathSegment();
                return last == null ? "" : last;
            }
            String frag = d.getFragment();
            if (frag != null && frag.startsWith("s=")) return android.net.Uri.decode(frag.substring(2));
        } catch (Exception ignored) {
            // kein verwertbarer Link
        }
        return "";
    }

    private void rememberTap(Intent intent, boolean notifyJs) {
        if (intent == null) return;
        String id = "";
        if (intent.hasExtra(EXTRA_ID)) {
            id = intent.getStringExtra(EXTRA_ID);
            intent.removeExtra(EXTRA_ID); // nicht nochmal auslösen (z. B. nach Drehen des Geräts)
        } else {
            String spool = spoolFromLink(intent);
            if (!spool.isEmpty()) {
                id = "spool:" + spool;
                intent.setData(null); // nur einmal auswerten
            }
        }
        if (id == null || id.isEmpty()) return;
        pendingId = id;
        if (notifyJs) {
            JSObject o = new JSObject();
            o.put("id", id);
            notifyListeners("notificationTap", o);
        }
    }

    @PluginMethod
    public void consumeTap(PluginCall call) {
        JSObject r = new JSObject();
        r.put("id", pendingId);
        pendingId = "";
        call.resolve(r);
    }

    private boolean enabled() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    private JSObject statusObject() {
        JSObject r = new JSObject();
        r.put("granted", enabled());
        return r;
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (enabled()) {
            call.resolve(statusObject());
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionResult");
        } else {
            call.resolve(statusObject());
        }
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void show(PluginCall call) {
        try {
            if (!enabled()) {
                JSObject r = new JSObject();
                r.put("shown", false);
                call.resolve(r);
                return;
            }
            Context ctx = getContext();
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
                    NotificationChannel ch = new NotificationChannel(CHANNEL, "FilamentHub Meldungen", NotificationManager.IMPORTANCE_HIGH);
                    nm.createNotificationChannel(ch);
                }
            }
            String title = call.getString("title", "FilamentHub");
            String body = call.getString("body", "");
            String tag = call.getString("tag", "fh");
            String inboxId = call.getString("id", "");
            Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            PendingIntent pi = null;
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                launch.putExtra(EXTRA_ID, inboxId);
                // Eigene Anfrage-Nummer je Meldung, sonst überschreibt eine neue Meldung die ID der alten
                pi = PendingIntent.getActivity(ctx, tag.hashCode(), launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            }
            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(FilamentKeepAliveService.smallIcon(ctx))
                .setColor(0xFF168A47)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);
            if (pi != null) b.setContentIntent(pi);
            NotificationManagerCompat.from(ctx).notify(tag.hashCode(), b.build());
            JSObject r = new JSObject();
            r.put("shown", true);
            call.resolve(r);
        } catch (SecurityException e) {
            JSObject r = new JSObject();
            r.put("shown", false);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }


    // Stehende Mitteilung mit Fortschrittsbalken (Druck / Trocknen): bleibt oben, wird laufend aktualisiert, leise
    private static final String LIVE_CHANNEL = "filament_live_status";
    private static final int LIVE_ID = 7001;

    @PluginMethod
    public void showOngoing(PluginCall call) {
        try {
            JSObject r = new JSObject();
            if (!enabled()) {
                r.put("shown", false);
                call.resolve(r);
                return;
            }
            Context ctx = getContext();
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null && nm.getNotificationChannel(LIVE_CHANNEL) == null) {
                    NotificationChannel ch = new NotificationChannel(LIVE_CHANNEL, "Druck- und Trocknungsstand", NotificationManager.IMPORTANCE_LOW);
                    ch.setShowBadge(false);
                    nm.createNotificationChannel(ch);
                }
            }
            String title = call.getString("title", "FilamentHub");
            String text = call.getString("text", "");
            String sub = call.getString("sub", "");
            int progress = call.getInt("progress", -1);
            Long eta = call.getLong("etaMs", 0L);
            Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            PendingIntent pi = null;
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                pi = PendingIntent.getActivity(ctx, LIVE_ID, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            }
            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, LIVE_CHANNEL)
                .setSmallIcon(FilamentKeepAliveService.smallIcon(ctx))
                .setColor(0xFF168A47)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_LOW);
            if (!sub.isEmpty()) b.setSubText(sub);
            if (progress >= 0) b.setProgress(100, Math.min(100, progress), false);
            else b.setProgress(0, 0, true);
            if (eta != null && eta > 0) {
                b.setWhen(eta).setShowWhen(true).setUsesChronometer(true);
                if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(true);
            }
            if (pi != null) b.setContentIntent(pi);
            NotificationManagerCompat.from(ctx).notify(LIVE_ID, b.build());
            r.put("shown", true);
            call.resolve(r);
        } catch (SecurityException e) {
            JSObject r = new JSObject();
            r.put("shown", false);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void clearOngoing(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(LIVE_ID);
        call.resolve();
    }

    // Hintergrund-Dienst ein/aus: hält die App am Leben, damit Meldungen auch bei geschlossener App kommen
    @PluginMethod
    public void keepAlive(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        JSObject r = new JSObject();
        try {
            Context ctx = getContext();
            Intent svc = new Intent(ctx, FilamentKeepAliveService.class);
            if (on) {
                ContextCompat.startForegroundService(ctx, svc);
            } else {
                ctx.stopService(svc);
            }
            r.put("running", on);
        } catch (Exception e) {
            r.put("running", false);
            r.put("error", String.valueOf(e.getMessage()));
        }
        call.resolve(r);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
