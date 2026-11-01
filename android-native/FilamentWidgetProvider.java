package com.filamenthub.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.os.Build;
import android.widget.RemoteViews;

// Homescreen-Widget: Druck-/Trocknungsstand mit Balken. Die Daten schreibt die App (FilamentNotify.setWidget),
// das Widget zeigt nur den letzten Stand und öffnet beim Tippen die App.
public class FilamentWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "filament_widget";

    static int res(Context c, String name, String type) {
        return c.getResources().getIdentifier(name, type, c.getPackageName());
    }

    static void update(Context ctx, AppWidgetManager mgr, int[] ids) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int layout = res(ctx, "filament_widget", "layout");
        if (layout == 0) return;
        String title = p.getString("title", "FilamentHub");
        String text = p.getString("text", "Noch keine Daten, App einmal öffnen");
        String sub = p.getString("sub", "");
        int progress = p.getInt("progress", -1);
        int color = p.getInt("color", 0xFF168A47);
        long ts = p.getLong("ts", 0);
        // Älter als 20 Minuten: der Stand ist vermutlich überholt (App war lange zu)
        if (ts > 0 && System.currentTimeMillis() - ts > 20 * 60_000L) {
            sub = "Stand von " + java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT).format(new java.util.Date(ts));
        }
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), layout);
            v.setTextViewText(res(ctx, "fw_title", "id"), title);
            v.setTextViewText(res(ctx, "fw_text", "id"), text);
            v.setTextViewText(res(ctx, "fw_sub", "id"), sub);
            int bar = res(ctx, "fw_bar", "id");
            if (progress >= 0) {
                v.setViewVisibility(bar, android.view.View.VISIBLE);
                v.setProgressBar(bar, 100, Math.min(100, progress), false);
                if (Build.VERSION.SDK_INT >= 31) {
                    v.setColorStateList(bar, "setProgressTintList", ColorStateList.valueOf(color));
                }
            } else {
                v.setViewVisibility(bar, android.view.View.GONE);
            }
            Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            if (launch != null) {
                PendingIntent pi = PendingIntent.getActivity(ctx, 7002, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                v.setOnClickPendingIntent(res(ctx, "fw_root", "id"), pi);
            }
            mgr.updateAppWidget(id, v);
        }
    }

    /** Alle Widgets neu zeichnen (nach neuen Daten) */
    static void refresh(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, FilamentWidgetProvider.class));
        if (ids != null && ids.length > 0) update(ctx, mgr, ids);
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        update(ctx, mgr, ids);
    }
}
