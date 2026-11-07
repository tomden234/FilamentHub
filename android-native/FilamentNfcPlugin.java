package com.filamenthub.app;

import android.app.Activity;
import android.content.Intent;
import android.nfc.FormatException;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.nfc.tech.NdefFormatable;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONArray;
import org.json.JSONObject;

// NFC-Tags lesen und beschreiben (NDEF), als Ersatz für Web NFC, das es in der Android-App (WebView) nicht gibt.
// Die Web-App ruft dieses Plugin über einen kleinen NDEFReader-Ersatz auf (src/utils/nativeNfc.ts).
@CapacitorPlugin(name = "FilamentNfc")
public class FilamentNfcPlugin extends Plugin implements NfcAdapter.ReaderCallback {

    private PluginCall pendingWrite = null;
    private boolean scanning = false;
    // Solange die App vorne ist, alle Tags selbst lesen (sonst zeigt Android seinen „Neues Tag“-Bildschirm).
    // Von Anfang an an: so greift es auch, bevor die Web-App das erste Mal etwas schickt.
    private boolean autoRead = true;
    // Läuft der Reader-Modus gerade? Jedes erneute Einschalten lässt Android den Tag neu erkennen, und der alte Tag-Zugriff
    // ist dann „out of date“ (Schreiben schlägt mit „Permission Denial“ fehl). Darum nur bei einer echten Änderung umschalten.
    private boolean readerOn = false;

    @Override
    public void load() {
        super.load();
        updateReaderMode();
        Activity activity = getActivity();
        if (activity != null) handleTagIntent(activity.getIntent());
    }

    // Tag hat die App gestartet oder zurückgeholt (Android-Absichtsfilter im Manifest): wie einen normalen Scan behandeln
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handleTagIntent(intent);
    }

    @SuppressWarnings("deprecation")
    private void handleTagIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!NfcAdapter.ACTION_NDEF_DISCOVERED.equals(action)
                && !NfcAdapter.ACTION_TECH_DISCOVERED.equals(action)
                && !NfcAdapter.ACTION_TAG_DISCOVERED.equals(action)) {
            return;
        }
        // Nur einmal verarbeiten
        intent.setAction(Intent.ACTION_MAIN);
        final Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
        // Nur echte Tag-Scans des Systems: ein von einer anderen App gebauter Intent hat kein Tag-Objekt (1.233)
        if (tag == null) return;
        final PluginCall write = pendingWrite;
        if (write != null && tag != null) {
            new Thread(() -> doWrite(tag, write)).start();
            return;
        }
        JSObject event = new JSObject();
        event.put("serialNumber", tag != null ? serialOf(tag) : "");
        JSArray records = new JSArray();
        android.os.Parcelable[] raw = intent.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES);
        if (raw != null) {
            for (android.os.Parcelable m : raw) {
                for (NdefRecord record : ((NdefMessage) m).getRecords()) {
                    JSObject r = toJs(record);
                    if (r != null) records.put(r);
                }
            }
        }
        event.put("records", records);
        // Bleibt gespeichert, bis die Web-App zuhört (App startet erst durch den Tag)
        notifyListeners("tag", event, true);
    }

    private NfcAdapter adapter() {
        return NfcAdapter.getDefaultAdapter(getContext());
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        NfcAdapter nfc = adapter();
        JSObject result = new JSObject();
        result.put("available", nfc != null);
        result.put("enabled", nfc != null && nfc.isEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void startScan(PluginCall call) {
        scanning = true;
        updateReaderMode();
        call.resolve();
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        scanning = false;
        updateReaderMode();
        call.resolve();
    }

    @PluginMethod
    public void setAutoRead(PluginCall call) {
        autoRead = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        updateReaderMode();
        call.resolve();
    }

    @PluginMethod
    public void write(PluginCall call) {
        if (pendingWrite != null) {
            pendingWrite.reject("Es läuft schon ein Schreibvorgang.");
        }
        call.setKeepAlive(true);
        pendingWrite = call;
        updateReaderMode();
    }

    @PluginMethod
    public void cancelWrite(PluginCall call) {
        if (pendingWrite != null) {
            pendingWrite.reject("Abgebrochen");
            pendingWrite = null;
        }
        updateReaderMode();
        call.resolve();
    }

    private void updateReaderMode() {
        final Activity activity = getActivity();
        final NfcAdapter nfc = adapter();
        if (activity == null || nfc == null) return;
        final boolean needed = scanning || autoRead || pendingWrite != null;
        activity.runOnUiThread(() -> {
            try {
                if (needed) {
                    if (readerOn) return;
                    nfc.enableReaderMode(
                            activity,
                            this,
                            NfcAdapter.FLAG_READER_NFC_A
                                    | NfcAdapter.FLAG_READER_NFC_B
                                    | NfcAdapter.FLAG_READER_NFC_F
                                    | NfcAdapter.FLAG_READER_NFC_V,
                            null);
                    readerOn = true;
                } else if (readerOn) {
                    nfc.disableReaderMode(activity);
                    readerOn = false;
                }
            } catch (Exception ignored) {
            }
        });
    }

    @Override
    public void onTagDiscovered(Tag tag) {
        final PluginCall write = pendingWrite;
        if (write != null) {
            doWrite(tag, write);
        } else if (scanning || autoRead) {
            doRead(tag);
        }
    }

    // ---------- Lesen ----------

    private void doRead(Tag tag) {
        JSObject event = new JSObject();
        event.put("serialNumber", serialOf(tag));
        Exception last = null;
        // Zwei Versuche: ein kurzes Wackeln des Tags soll nicht gleich ein Fehler sein
        for (int attempt = 0; attempt < 2; attempt++) {
            JSArray records = new JSArray();
            Ndef ndef = Ndef.get(tag);
            try {
                if (ndef != null) {
                    ndef.connect();
                    try {
                        NdefMessage message = ndef.getNdefMessage();
                        if (message != null) {
                            for (NdefRecord record : message.getRecords()) {
                                JSObject r = toJs(record);
                                if (r != null) records.put(r);
                            }
                        }
                    } finally {
                        try {
                            ndef.close();
                        } catch (Exception ignored) {
                        }
                    }
                }
                event.put("records", records);
                notifyListeners("tag", event);
                return;
            } catch (Exception e) {
                last = e;
                try {
                    Thread.sleep(120);
                } catch (InterruptedException ie) {
                    break;
                }
            }
        }
        JSObject err = new JSObject();
        err.put("message", String.valueOf(last != null ? last.getMessage() : "Lesefehler"));
        notifyListeners("tagError", err);
    }

    private JSObject toJs(NdefRecord record) {
        JSObject r = new JSObject();
        byte[] type = record.getType();
        byte[] payload = record.getPayload();
        short tnf = record.getTnf();
        if (tnf == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(type, NdefRecord.RTD_TEXT) && payload.length > 0) {
            int langLength = payload[0] & 0x3F;
            boolean utf16 = (payload[0] & 0x80) != 0;
            int start = 1 + langLength;
            byte[] text = start <= payload.length ? Arrays.copyOfRange(payload, start, payload.length) : new byte[0];
            r.put("recordType", "text");
            r.put("encoding", utf16 ? "utf-16" : "utf-8");
            r.put("data", Base64.encodeToString(text, Base64.NO_WRAP));
        } else if (tnf == NdefRecord.TNF_MIME_MEDIA) {
            r.put("recordType", "mime");
            r.put("mediaType", new String(type, StandardCharsets.US_ASCII));
            r.put("data", Base64.encodeToString(payload, Base64.NO_WRAP));
        } else {
            r.put("recordType", "unknown");
            r.put("data", Base64.encodeToString(payload, Base64.NO_WRAP));
        }
        return r;
    }

    private String serialOf(Tag tag) {
        byte[] id = tag.getId();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < id.length; i++) {
            if (i > 0) sb.append(':');
            sb.append(String.format("%02x", id[i] & 0xFF));
        }
        return sb.toString();
    }

    // ---------- Schreiben ----------

    private NdefMessage buildMessage(PluginCall call) throws Exception {
        JSArray array = call.getArray("records");
        if (array == null || array.length() == 0) {
            return new NdefMessage(new NdefRecord(NdefRecord.TNF_EMPTY, null, null, null));
        }
        NdefRecord[] records = new NdefRecord[array.length()];
        for (int i = 0; i < array.length(); i++) {
            JSONObject o = array.getJSONObject(i);
            String type = o.optString("recordType", "text");
            if ("mime".equals(type)) {
                byte[] bytes = Base64.decode(o.optString("data", ""), Base64.DEFAULT);
                records[i] = NdefRecord.createMime(o.optString("mediaType", "application/octet-stream"), bytes);
            } else if ("url".equals(type)) {
                records[i] = NdefRecord.createUri(o.optString("data", ""));
            } else {
                records[i] = NdefRecord.createTextRecord(null, o.optString("data", ""));
            }
        }
        return new NdefMessage(records);
    }

    private void finishWrite(PluginCall call, String error, String serial) {
        // Schon von einem anderen Versuch erledigt (oder abgebrochen): nicht noch einmal melden
        if (pendingWrite != call) return;
        pendingWrite = null;
        updateReaderMode();
        if (error != null) {
            call.reject(error);
        } else {
            JSObject result = new JSObject();
            result.put("serialNumber", serial);
            call.resolve(result);
        }
    }

    /** Ein Schreibversuch. null = geschafft, Text = endgültiger Fehler. Wirft IOException, wenn der Tag verloren ging. */
    private String writeOnce(Tag tag, NdefMessage message) throws Exception {
        Ndef ndef = Ndef.get(tag);
        if (ndef != null) {
            ndef.connect();
            try {
                if (!ndef.isWritable()) return "Der Tag ist schreibgeschützt.";
                int size = message.toByteArray().length;
                if (ndef.getMaxSize() < size) {
                    return "Der Tag ist zu klein (" + ndef.getMaxSize() + " Byte, benötigt " + size + " Byte).";
                }
                ndef.writeNdefMessage(message);
            } finally {
                try {
                    ndef.close();
                } catch (Exception ignored) {
                }
            }
            return null;
        }
        NdefFormatable formatable = NdefFormatable.get(tag);
        if (formatable != null) {
            formatable.connect();
            try {
                formatable.format(message);
            } finally {
                try {
                    formatable.close();
                } catch (Exception ignored) {
                }
            }
            return null;
        }
        return "Dieser Tag unterstützt kein NDEF und kann nicht beschrieben werden.";
    }

    private void doWrite(Tag tag, PluginCall call) {
        NdefMessage message;
        try {
            message = buildMessage(call);
        } catch (Exception e) {
            finishWrite(call, "Ungültiges Datenformat: " + e.getMessage(), null);
            return;
        }
        // Drei Versuche direkt hintereinander: ein leichtes Wackeln des Tags macht nichts
        for (int attempt = 0; attempt < 3; attempt++) {
            if (pendingWrite != call) return; // inzwischen erledigt oder abgebrochen
            try {
                String error = writeOnce(tag, message);
                finishWrite(call, error, error == null ? serialOf(tag) : null);
                return;
            } catch (FormatException e) {
                finishWrite(call, "Ungültiges Datenformat: " + e.getMessage(), null);
                return;
            } catch (SecurityException e) {
                // „Tag is out of date“: Android hat den Tag inzwischen neu erkannt, dieser Zugriff ist veraltet.
                // Nicht aufgeben: Der neue Zugriff kommt von selbst (onTagDiscovered) und schreibt dann.
                break;
            } catch (IOException e) {
                // Tag verloren / Verbindung weg: nochmal versuchen
                try {
                    Thread.sleep(150);
                } catch (InterruptedException ie) {
                    break;
                }
            } catch (Exception e) {
                finishWrite(call, "Schreiben fehlgeschlagen: " + e.getMessage(), null);
                return;
            }
        }
        // Nicht aufgeben: Der Schreibvorgang bleibt offen und startet beim nächsten Antippen von selbst neu
        JSObject hint = new JSObject();
        hint.put("message", "Tag verrutscht. Einfach nochmal ans Handy halten.");
        notifyListeners("writeRetry", hint);
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        readerOn = false; // Android schaltet den Reader-Modus beim Pausieren ab
    }

    // Android schaltet den Reader-Modus beim Pausieren ab: beim Zurückkommen wieder einschalten
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        updateReaderMode();
    }
}
