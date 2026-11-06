package com.filamenthub.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

// Hält die App im Hintergrund am Leben (kleine dauerhafte Anzeige), damit die Verbindung zum Drucker offen bleibt
// und Meldungen (Trocknung fertig/gestoppt, Druck fertig) auch kommen, wenn die App nicht vorne ist.
// Ein/Aus über das Plugin FilamentNotify (Methode keepAlive), Schalter in den Mitteilungs-Einstellungen.
public class FilamentKeepAliveService extends Service {
    private static final String CHANNEL = "filamenthub_keepalive";
    private static final int NOTIFICATION_ID = 7001;
    // FOREGROUND_SERVICE_TYPE_SPECIAL_USE (Android 14+), als Zahl, damit es auch mit älterem compileSdk baut
    private static final int TYPE_SPECIAL_USE = 0x40000000;

    /** Kleines Symbol für Meldungen: einfarbige Spule, sonst das App-Symbol */
    static int smallIcon(Context c) {
        int id = c.getResources().getIdentifier("ic_stat_spool", "drawable", c.getPackageName());
        if (id != 0) return id;
        int icon = c.getApplicationInfo().icon;
        return icon != 0 ? icon : android.R.drawable.ic_dialog_info;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
                    NotificationChannel ch = new NotificationChannel(CHANNEL, "FilamentHub im Hintergrund", NotificationManager.IMPORTANCE_MIN);
                    ch.setShowBadge(false);
                    nm.createNotificationChannel(ch);
                }
            }
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            PendingIntent pi = null;
            if (launch != null) {
                pi = PendingIntent.getActivity(this, 7001, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            }
            NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(smallIcon(this))
                .setColor(0xFF168A47)
                .setContentTitle("FilamentHub")
                .setContentText("Bleibt für Meldungen mit dem Drucker verbunden")
                .setOngoing(true)
                .setShowWhen(false)
                .setPriority(NotificationCompat.PRIORITY_MIN);
            if (pi != null) b.setContentIntent(pi);
            Notification n = b.build();
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, n, TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIFICATION_ID, n);
            }
        } catch (Exception e) {
            // Start nicht erlaubt (z. B. App nicht vorne): ohne Hintergrund-Dienst weiterlaufen
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        stopForeground(true);
        super.onDestroy();
    }
}
