"""EIN Bild: 1 ESP32 mit allen 5 RC522-Lesern, beiden SHT31-D-Sensoren UND dem Status-LED-Streifen (WS2812B).
Aufruf: python3 build_gesamt.py  (braucht matplotlib, build_wiring.py liegt daneben)
Pins müssen zu hardware/ams-nfc/filament-ams.yaml passen.
"""
import build_wiring as bw
from build_wiring import C, INK, SOFT, wire, dot, esp_pin, module_block, esp_block, legend, warn_box, fig_ax, save, Rectangle

# Sensor-Kabel in den Farben des Nutzers
S = {"VIN": "#d62828", "GND": "#f08a24", "SCL": "#e0b400", "SDA": "#2a9d4a"}


def fig_gesamt():
    W, H = 1900, 1960
    fig, ax = fig_ax(W, H, "Alles an EINEM ESP32: 5 × RC522 + 2 × SHT31-D + Status-LED-Streifen",
                     "Leser: Sammelschienen + je eine CS-Leitung. Sensoren: 3V3/GND von den Schienen, SDA/SCL eigene Pins. LED: Daten an D27, Strom vom 5-V-Netzteil, GND gemeinsam.")
    ex, ey, ew, eh = 40, 120, 330, 1640
    esp_block(ax, ex, ey, ew, eh, note=False)
    ax.text(ex + ew / 2 - 20, ey + 880, "Pins nach der Beschriftung\nauf der Platine suchen", fontsize=8.5, color="#8fb3d6",
            ha="center", va="center", zorder=5, linespacing=1.3)
    px = ex + ew
    esp_rows = {"3V3": ("3V3", None, 160), "GND": ("GND", None, 190), "SCK": ("GPIO18", "D18", 315), "MOSI": ("GPIO23", "D23", 343),
                "MISO": ("GPIO19", "D19", 371), "RST": ("GPIO22", "D22", 515), "CS1": ("GPIO5", "D5", 543), "CS2": ("GPIO17", "D17", 571),
                "CS3": ("GPIO16", "D16", 705), "CS4": ("GPIO4", "D4", 733), "CS5": ("GPIO13", "D13", 761),
                "BOXSCL": ("GPIO32", "SCL Box", 1165), "BOXSDA": ("GPIO21", "SDA Box", 1200),
                "TROCKSCL": ("GPIO25", "SCL Trockner", 1340), "TROCKSDA": ("GPIO33", "SDA Trockner", 1368),
                "LED": ("GPIO27", "D27 · LED-Daten", 1545)}
    rails = ["3V3", "GND", "SCK", "MOSI", "MISO", "RST"]
    xr = {k: 800 - i * 46 for i, k in enumerate(rails)}
    r_top, r_bot = 140, 1440
    r_bot_gnd = 1640  # GND-Schiene geht weiter bis zum LED-Streifen
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

    # --- Status-LED (WS2812B) + 5-V-Netzteil ---
    LED_R, LED_K, LED_G = "#d62828", "#222222", "#2a9d4a"
    wire(ax, [(xr["GND"], r_bot), (xr["GND"], r_bot_gnd)], C["GND"], lw=3.4, z=2)
    lt = 1480
    bw.rbox(ax, mx, lt, mw, 180, "#6b3fa0", "#2e1a47", lw=2.5)
    ax.text(mx + mw - 18, lt + 22, "LED-Streifen WS2812B (5 V)", fontsize=12.5, fontweight="bold", color="white", ha="right", va="center", zorder=5)
    ax.text(mx + mw - 18, lt + 160, "Anfang des Streifens (Pfeil zeigt weg vom ESP)\nHA: light.filament_ams_status_led", fontsize=8.6, color="#e6d8f5",
            ha="right", va="center", zorder=5, linespacing=1.3)
    lp = {"GND": lt + 55, "DIN": lt + 85, "5V": lt + 115}
    for nm, y in lp.items():
        ax.add_patch(Rectangle((mx - 9, y - 6), 18, 12, fc="#d9a441", ec="#8a6a1f", lw=1, zorder=4))
        ax.text(mx + 16, y, {"5V": "+5V (rot)", "DIN": "DIN (Daten, grün)", "GND": "GND (weiß/schwarz)"}[nm], fontsize=9.5,
                fontweight="bold", color="white", va="center", zorder=5)
    # GND: ESP-GND-Schiene -> Streifen GND
    wire(ax, [(xr["GND"], lp["GND"]), (mx, lp["GND"])], LED_K, lw=3.0)
    dot(ax, xr["GND"], lp["GND"], LED_K, r=4.6)
    dot(ax, mx, lp["GND"], LED_K, r=4.6)
    ax.text(1000, lp["GND"] - 11, "GND gemeinsam: ESP, Streifen und Netzteil", fontsize=9.3, color=SOFT, ha="center", va="center", zorder=5)
    # Daten: ESP D27 -> DIN
    lab, sub, y = esp_rows["LED"]
    esp_pin(ax, px, y, lab, sub)
    wire(ax, [(px, y), (470, y), (470, lp["DIN"]), (mx, lp["DIN"])], LED_G, lw=3.0)
    dot(ax, px, y, LED_G)
    dot(ax, mx, lp["DIN"], LED_G, r=4.6)
    ax.text(1000, lp["DIN"] + 12, "D27 → DIN (optional 330 Ω in die Leitung)", fontsize=9.3, color=SOFT, ha="center", va="center", zorder=5)
    # Netzteil
    nx, ny, nw, nh = 880, 1710, 260, 100
    bw.rbox(ax, nx, ny, nw, nh, "#3a3a3a", "#111111", lw=2.5)
    ax.text(nx + nw / 2, ny + 24, "Netzteil 5 V / 2 A", fontsize=12, fontweight="bold", color="white", ha="center", va="center", zorder=5)
    ax.text(nx + nw / 2, ny + 50, "(USB-Kabel: rot = +5V, schwarz = GND)", fontsize=8.6, color="#dddddd", ha="center", va="center", zorder=5)
    ax.text(nx + 30, ny + 78, "GND", fontsize=10, fontweight="bold", color="#cccccc", va="center", zorder=5)
    ax.text(nx + nw - 30, ny + 78, "+5V", fontsize=10, fontweight="bold", color="#ff8080", ha="right", va="center", zorder=5)
    # Netzteil-GND an das untere Ende der GND-Schiene
    wire(ax, [(nx + 50, ny), (nx + 50, 1685), (xr["GND"], 1685), (xr["GND"], r_bot_gnd)], LED_K, lw=3.4)
    dot(ax, xr["GND"], r_bot_gnd, LED_K, r=4.6)
    # Netzteil +5V direkt an den Streifen
    wire(ax, [(nx + nw - 50, ny), (nx + nw - 50, 1685), (1150, 1685), (1150, lp["5V"]), (mx, lp["5V"])], LED_R, lw=3.4)
    dot(ax, mx, lp["5V"], LED_R, r=4.6)
    ax.text(mx + mw + 12, lp["5V"], "nie an 3V3\noder VIN!", fontsize=8.8, color="#d62828", fontweight="bold", va="center", zorder=5, linespacing=1.2)

    legend(ax, 60, 1830, [("3V3", C["3V3"], "3V3"), ("GND", C["GND"], "GND (Leser)"), ("SCK", C["SCK"], "SCK"), ("MOSI", C["MOSI"], "MOSI"),
                          ("MISO", C["MISO"], "MISO"), ("RST", C["RST"], "RST (GPIO22)")], per_row=6, dx=165, size=10)
    ax.text(1080, 1830, "CS1 bis CS5: Violett, Braun, Grau, Pink, Türkis (Vorschlag)", fontsize=9.5, color=SOFT, va="center")
    warn_box(ax, 40, 1855, 1820, 95,
             "Wichtig\n"
             "•  IRQ bleibt bei allen Lesern frei. Sammelschienen innen verlöten, mit Schrumpfschlauch sichern. Zwischen GND und 3V3 kein Durchgang.\n"
             "•  Leser/Sensoren NUR an 3,3 V. LED-Streifen NUR am 5-V-Netzteil, GND von Netzteil, Streifen und ESP verbinden. ESP bleibt per USB versorgt.",
             fs=10.2)
    save(fig, "6_gesamt_ein_esp")


if __name__ == "__main__":
    fig_gesamt()
