"""EIN Bild: 1 ESP32 mit allen 5 RC522-Lesern UND beiden SHT31-D-Sensoren.
Aufruf: python3 build_gesamt.py  (braucht matplotlib, build_wiring.py liegt daneben)
Pins müssen zu hardware/ams-nfc/filament-ams.yaml passen.
"""
import build_wiring as bw
from build_wiring import C, INK, SOFT, wire, dot, esp_pin, module_block, esp_block, legend, warn_box, fig_ax, save, Rectangle

# Sensor-Kabel in den Farben des Nutzers
S = {"VIN": "#d62828", "GND": "#f08a24", "SCL": "#e0b400", "SDA": "#2a9d4a"}


def fig_gesamt():
    W, H = 1900, 1660
    fig, ax = fig_ax(W, H, "Alles an EINEM ESP32: 5 × RC522-Leser + 2 × SHT31-D-Sensor",
                     "Leser: Sammelschienen + je eine CS-Leitung. Sensoren: 3V3 und GND von den Sammelschienen, SDA/SCL je eigene Pins (eigener Bus).")
    ex, ey, ew, eh = 40, 120, 330, 1330
    esp_block(ax, ex, ey, ew, eh, note=False)
    ax.text(ex + ew / 2 - 20, ey + eh - 92, "Pins nach der Beschriftung\nauf der Platine suchen", fontsize=8.5, color="#8fb3d6",
            ha="center", va="center", zorder=5, linespacing=1.3)
    px = ex + ew
    esp_rows = {"3V3": ("3V3", None, 160), "GND": ("GND", None, 190), "SCK": ("GPIO18", "D18", 315), "MOSI": ("GPIO23", "D23", 343),
                "MISO": ("GPIO19", "D19", 371), "RST": ("GPIO22", "D22", 515), "CS1": ("GPIO5", "D5", 543), "CS2": ("GPIO17", "TX2", 571),
                "CS3": ("GPIO16", "RX2", 705), "CS4": ("GPIO4", "D4", 733), "CS5": ("GPIO13", "D13", 761),
                "BOXSCL": ("GPIO32", "SCL Box", 1165), "BOXSDA": ("GPIO21", "SDA Box", 1200),
                "TROCKSCL": ("GPIO25", "SCL Trockner", 1340), "TROCKSDA": ("GPIO33", "SDA Trockner", 1368)}
    rails = ["3V3", "GND", "SCK", "MOSI", "MISO", "RST"]
    xr = {k: 800 - i * 46 for i, k in enumerate(rails)}
    r_top, r_bot = 140, 1440
    mtops = [140 + i * 190 for i in range(5)]
    mx, mw, mh = 1210, 380, 170
    names = ["Leser 1", "Leser 2", "Leser 3", "Leser 4", "Leser 5"]
    where = ["Slot 1 · linke Außenwand", "Slot 2 · Trennwand 1│2", "Slot 3 · Trennwand 2│3", "Slot 4 · Trennwand 3│4", "Extern · ext. Spulenhalter hinten"]
    pin_rows = ["SDA", "SCK", "MOSI", "MISO", "IRQ", "GND", "RST", "3V3"]
    pin_lab = {"SDA": "SDA (= CS)", "SCK": "SCK", "MOSI": "MOSI", "MISO": "MISO", "IRQ": "IRQ", "GND": "GND", "RST": "RST", "3V3": "3.3V"}
    for k in rails:
        wire(ax, [(xr[k], r_top), (xr[k], r_bot)], C[k], lw=3.4, z=2)
        ax.text(xr[k], r_top - 14, k, fontsize=10.5, fontweight="bold", color=C[k] if k != "SCK" else "#a98600", ha="center", va="center", zorder=5)
    for k in rails:
        lab, sub, y = esp_rows[k]
        esp_pin(ax, px, y, lab, sub)
        wire(ax, [(px, y), (xr[k], y)], C[k])
        dot(ax, px, y, C[k])
        dot(ax, xr[k], y, C[k])
    for i, mt in enumerate(mtops):
        module_block(ax, mx, mt, mw, mh, f"RC522 {names[i]}")
        ax.text(mx + mw - 18, mt + 44, where[i], fontsize=9.2, color="#cfe8da", ha="right", va="center", zorder=5)
        for j, pr in enumerate(pin_rows):
            y = mt + 62 + j * 14.2
            used = pr != "IRQ"
            ax.add_patch(Rectangle((mx - 9, y - 5), 18, 10, fc="#d9a441" if used else "#9aa3ab", ec="#8a6a1f", lw=1, zorder=4))
            ax.text(mx + 16, y, pin_lab[pr], fontsize=8.6, fontweight="bold" if used else "normal", color="white" if used else "#d5dbe0",
                    ha="left", va="center", zorder=5)
            if pr in rails:
                wire(ax, [(mx, y), (xr[pr], y)], C[pr], lw=2.6, z=3)
                dot(ax, xr[pr], y, C[pr], r=4.4)
                dot(ax, mx, y, C[pr], r=4.2)
    for i, k in enumerate(["CS1", "CS2", "CS3", "CS4", "CS5"]):
        lane = 420 + i * 16
        ytop = mtops[i] + 62
        lab, sub, y = esp_rows[k]
        esp_pin(ax, px, y, lab, sub)
        wire(ax, [(px, y), (lane, y), (lane, ytop), (mx, ytop)], C[k], lw=3.0)
        dot(ax, px, y, C[k])
        dot(ax, mx, ytop, C[k], r=4.6)
        ax.text(1000, ytop - 11, f"{k}: {lab} → SDA von {names[i]}", fontsize=9.3, color=SOFT, ha="center", va="center", zorder=5)

    # --- Sensoren (unter den Lesern) ---
    sens = [("SHT31-D Box", 1130, "BOXSCL", "BOXSDA", "HA: …_box_feuchte / _temperatur", 500, 516),
            ("SHT31-D Trockner (extern, 5. Spule)", 1290, "TROCKSCL", "TROCKSDA", "HA: …_trockner_feuchte / _temperatur", 532, 548)]
    for title, top, kscl, ksda, ha, lscl, lsda in sens:
        bw.rbox(ax, mx, top, mw, 135, "#2d5f8b", "#16324f", lw=2.5)
        ax.text(mx + mw - 18, top + 22, title, fontsize=12.5, fontweight="bold", color="white", ha="right", va="center", zorder=5)
        ax.text(mx + mw - 18, top + 122, ha, fontsize=8.6, color="#cfe0f0", ha="right", va="center", zorder=5)
        pins = {"VIN": top + 44, "GND": top + 66, "SCL": top + 88, "SDA": top + 110}
        for nm, y in pins.items():
            ax.add_patch(Rectangle((mx - 9, y - 6), 18, 12, fc="#d9a441", ec="#8a6a1f", lw=1, zorder=4))
            ax.text(mx + 16, y, {"VIN": "VIN (3,3 V)"}.get(nm, nm), fontsize=9.5, fontweight="bold", color="white", va="center", zorder=5)
        # VIN von 3V3-Schiene, GND von GND-Schiene
        wire(ax, [(xr["3V3"], pins["VIN"]), (mx, pins["VIN"])], S["VIN"], lw=3.0)
        dot(ax, xr["3V3"], pins["VIN"], S["VIN"], r=4.6)
        dot(ax, mx, pins["VIN"], S["VIN"], r=4.6)
        wire(ax, [(xr["GND"], pins["GND"]), (mx, pins["GND"])], S["GND"], lw=3.0)
        dot(ax, xr["GND"], pins["GND"], S["GND"], r=4.6)
        dot(ax, mx, pins["GND"], S["GND"], r=4.6)
        for kk, nm, lane in ((kscl, "SCL", lscl), (ksda, "SDA", lsda)):
            lab, sub, y = esp_rows[kk]
            esp_pin(ax, px, y, lab, sub)
            wire(ax, [(px, y), (lane, y), (lane, pins[nm]), (mx, pins[nm])], S[nm], lw=3.0)
            dot(ax, px, y, S[nm])
            dot(ax, mx, pins[nm], S[nm], r=4.6)
    ax.text(1590, 1112, "Sensor-Kabel: Rot = VIN (von 3V3), Orange = GND (von GND), Gelb = SCL, Grün = SDA", fontsize=9.6, color=SOFT, ha="right", va="center")

    legend(ax, 60, 1480, [("3V3", C["3V3"], "3V3"), ("GND", C["GND"], "GND (Leser)"), ("SCK", C["SCK"], "SCK"), ("MOSI", C["MOSI"], "MOSI"),
                          ("MISO", C["MISO"], "MISO"), ("RST", C["RST"], "RST (GPIO22)")], per_row=6, dx=165, size=10)
    ax.text(1080, 1480, "CS1 bis CS5: Violett, Braun, Grau, Pink, Türkis (Vorschlag)", fontsize=9.5, color=SOFT, va="center")
    warn_box(ax, 40, 1520, 1820, 120,
             "Wichtig\n"
             "•  Alles NUR an 3,3 V (nie an 5 V oder VIN des ESP32). IRQ bleibt bei allen Lesern frei.\n"
             "•  Sammelschienen = Litzen innen verlöten, Lötstellen mit Schrumpfschlauch sichern. Beide Sensoren holen 3V3 und GND von den Schienen.\n"
             "•  Reihenfolge: Leser 1 + Box-Sensor testen, dann Leser 2 bis 5, zuletzt Trockner-Sensor. Zwischen GND und 3V3 darf kein Durchgang sein.",
             fs=10.2)
    save(fig, "6_gesamt_ein_esp")


if __name__ == "__main__":
    fig_gesamt()
