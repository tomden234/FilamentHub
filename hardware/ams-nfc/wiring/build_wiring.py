"""Zeichnet die Verkabelungs-Diagramme für den NFC-Leser im AMS und den Feuchte-Sensor.
Erzeugt (PNG + SVG): 1_test_ein_leser, 2_alle_leser, 3_sensor, 4_einbau_ams.
Aufruf: python3 build_wiring.py   (pip install matplotlib)
Die Pins müssen zu hardware/ams-nfc/filament-ams.yaml passen. Ändert sich die YAML, hier mit anpassen.
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.patheffects as pe
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, Rectangle

# Kabelfarben (nur Vorschlag, wichtig ist nur, dass du dir deine Farben notierst)
C = {
    "3V3": "#d62828", "GND": "#222222", "SCK": "#e0b400", "MOSI": "#1d6fd1", "MISO": "#2a9d4a", "RST": "#f08a24",
    "CS1": "#7b2cbf", "CS2": "#8d5524", "CS3": "#7a7a7a", "CS4": "#e84aa0", "CS5": "#16b5b5",
    "SDA": "#1d6fd1", "SCL": "#e0b400",
}
INK = "#1b1f23"
SOFT = "#5b636b"
ESP_FILL = "#16324f"


def fig_ax(w, h, title, sub=None):
    fig = plt.figure(figsize=(w / 100, h / 100), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, w)
    ax.set_ylim(h, 0)
    ax.axis("off")
    ax.add_patch(Rectangle((0, 0), w, h, fc="white", ec="none", zorder=0))
    ax.text(30, 38, title, fontsize=20, fontweight="bold", color=INK, va="center")
    if sub:
        ax.text(30, 72, sub, fontsize=11.5, color=SOFT, va="center")
    return fig, ax


def wire(ax, pts, color, lw=3.4, z=3, ls="-"):
    xs, ys = zip(*pts)
    ax.plot(xs, ys, color=color, lw=lw, solid_capstyle="round", solid_joinstyle="round", ls=ls, zorder=z,
            path_effects=[pe.withStroke(linewidth=lw + 1.6, foreground="#6b7178", alpha=0.55)])


def dot(ax, x, y, color, r=5.5):
    ax.add_patch(Circle((x, y), r, fc=color, ec="white", lw=1.4, zorder=6))


def rbox(ax, x, y, w, h, fc, ec, lw=2.0, r=14, z=1):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}", fc=fc, ec=ec, lw=lw, zorder=z))


def esp_block(ax, x, y, w, h, note=True):
    rbox(ax, x, y, w, h, ESP_FILL, "#0b1b2b", lw=2.5)
    ax.text(x + w / 2 - 20, y + 36, "ESP32", fontsize=19, fontweight="bold", color="white", ha="center", va="center", zorder=5)
    ax.text(x + w / 2 - 20, y + 62, "DevKit (38 oder 30 Pins)", fontsize=9.5, color="#b8c7d6", ha="center", va="center", zorder=5)
    # USB-C
    rbox(ax, x + w / 2 - 55, y + h - 26, 70, 26, "#c9d1d9", "#8b949e", lw=1.5, r=8, z=4)
    ax.text(x + w / 2 - 20, y + h - 40, "USB-C", fontsize=9, color="#b8c7d6", ha="center", va="center", zorder=5)
    if note:
        ax.text(x + w / 2 - 20, y + h - 84, "Pins nach der Beschriftung\nauf der Platine suchen", fontsize=8.5, color="#8fb3d6",
                ha="center", va="center", zorder=5, linespacing=1.3)


def esp_pin(ax, x, y, label, sub=None):
    # Auf dem Board steht „D18“, nicht „GPIO18“: D-Nummer groß, GPIO klein darunter
    import re as _re
    _m = _re.match(r"GPIO(\d+)$", label)
    if _m:
        n = _m.group(1)
        extra = [e for e in [sub] if e and e != f"D{n}"]
        label, sub = f"D{n}", " · ".join([f"GPIO{n}"] + extra)
    ax.add_patch(Rectangle((x - 9, y - 6), 18, 12, fc="#d9a441", ec="#8a6a1f", lw=1, zorder=4))
    ax.text(x - 16, y, label, fontsize=11.5, fontweight="bold", color="white", ha="right", va="center", zorder=5)
    if sub:
        ax.text(x - 16, y + 13, sub, fontsize=8, color="#9fb6cc", ha="right", va="center", zorder=5)


def module_block(ax, x, y, w, h, title, color="#1f6f4a", dark="#10412b"):
    rbox(ax, x, y, w, h, color, dark, lw=2.5)
    ax.text(x + w - 18, y + 22, title, fontsize=12.5, fontweight="bold", color="white", ha="right", va="center", zorder=5)


def mod_pin(ax, x, y, label, used=True):
    ax.add_patch(Rectangle((x - 9, y - 6), 18, 12, fc="#d9a441" if used else "#9aa3ab", ec="#8a6a1f", lw=1, zorder=4))
    ax.text(x + 18, y, label, fontsize=10.5, fontweight="bold" if used else "normal", color="white" if used else "#d5dbe0",
            ha="left", va="center", zorder=5)


def legend(ax, x, y, items, per_row=6, dx=190, size=10.5):
    for i, (name, col, txt) in enumerate(items):
        cx = x + (i % per_row) * dx
        cy = y + (i // per_row) * 26
        ax.plot([cx, cx + 34], [cy, cy], color=col, lw=5, solid_capstyle="round", zorder=3,
                path_effects=[pe.withStroke(linewidth=6.6, foreground="#6b7178", alpha=0.55)])
        ax.text(cx + 44, cy, txt, fontsize=size, color=INK, va="center")


def warn_box(ax, x, y, w, h, text, fc="#fff4d6", ec="#e0b400", fs=11):
    rbox(ax, x, y, w, h, fc, ec, lw=1.8, r=10)
    ax.text(x + 16, y + h / 2, text, fontsize=fs, color=INK, va="center", linespacing=1.45, zorder=5)


def save(fig, name):
    fig.savefig(f"{name}.png", dpi=100)
    fig.savefig(f"{name}.svg")
    plt.close(fig)
    print("ok", name)


# ===================================================================================
# 1  Testaufbau: ein Leser
# ===================================================================================
def fig_test():
    W, H = 1400, 760
    fig, ax = fig_ax(W, H, "Schritt 1: Testaufbau mit EINEM Leser (Slot 1)",
                     "Erst nur diesen einen Leser anschließen, in Home Assistant prüfen, dann die anderen dazu.")
    ex, ey, ew, eh = 50, 120, 330, 560
    esp_block(ax, ex, ey, ew, eh)
    px = ex + ew
    mx, my, mw, mh = 930, 120, 380, 470
    module_block(ax, mx, my, mw, mh, "RC522 Leser 1")
    ax.text(mx + mw / 2, my + 56, "(Slot 1 · linke Außenwand)", fontsize=9.5, color="#cfe8da", ha="center", zorder=5)
    # Reihenfolge der Pins am RC522: SDA, SCK, MOSI, MISO, IRQ, GND, RST, 3.3V
    rows = [("SDA", "GPIO5", "CS1", "SDA (= CS)"), ("SCK", "GPIO18", "SCK", "SCK"), ("MOSI", "GPIO23", "MOSI", "MOSI"),
            ("MISO", "GPIO19", "MISO", "MISO"), ("IRQ", None, None, "IRQ  (frei lassen)"), ("GND", "GND", "GND", "GND"),
            ("RST", "GPIO22", "RST", "RST"), ("3V3", "3V3", "3V3", "3.3V  (NIE 5 V!)")]
    y0, dy = my + 105, 50
    for i, (_, esp, col, lab) in enumerate(rows):
        y = y0 + i * dy
        mod_pin(ax, mx, y, lab, used=esp is not None)
        if esp is None:
            continue
        esp_pin(ax, px, y, esp)
        wire(ax, [(px, y), (mx, y)], C[col])
        dot(ax, px, y, C[col])
        dot(ax, mx, y, C[col])
        ax.text((px + mx) / 2, y - 13, {"CS1": "CS-Leitung Slot 1", "SCK": "Takt", "MOSI": "Daten zum Leser", "MISO": "Daten vom Leser",
                                         "GND": "Masse", "RST": "Reset (bei allen Lesern gleich)", "3V3": "Strom 3,3 V"}[col],
                fontsize=9.5, color=SOFT, ha="center", va="center", zorder=5)
    legend(ax, 50, 716, [("3V3", C["3V3"], "Rot  3V3"), ("GND", C["GND"], "Schwarz  GND"), ("SCK", C["SCK"], "Gelb  SCK"),
                         ("MOSI", C["MOSI"], "Blau  MOSI"), ("MISO", C["MISO"], "Grün  MISO"), ("RST", C["RST"], "Orange  RST")],
           per_row=6, dx=205)
    save(fig, "1_test_ein_leser")


# ===================================================================================
# 2  Alle 5 Leser
# ===================================================================================
def fig_all():
    W, H = 1900, 1345
    fig, ax = fig_ax(W, H, "Alle 5 Leser: gemeinsame Leitungen (Sammelschienen) + je eine eigene CS-Leitung",
                     "Rot, Schwarz, Gelb, Blau, Grün, Orange gehen an ALLE 5 Leser. Nur die CS-Leitung (SDA am Leser) ist je Leser eine eigene.")
    ex, ey, ew, eh = 40, 120, 330, 1000
    esp_block(ax, ex, ey, ew, eh, note=False)
    ax.text(ex + ew / 2 - 20, ey + eh - 92, "Pins nach der Beschriftung\nauf der Platine suchen", fontsize=8.5, color="#8fb3d6",
            ha="center", va="center", zorder=5, linespacing=1.3)
    px = ex + ew
    esp_rows = [("3V3", "3V3", None), ("GND", "GND", None), ("SCK", "GPIO18", "D18"), ("MOSI", "GPIO23", "D23"), ("MISO", "GPIO19", "D19"),
                ("RST", "GPIO22", "D22"), ("CS1", "GPIO5", "D5"), ("CS2", "GPIO17", "D17"), ("CS3", "GPIO16", "D16"),
                ("CS4", "GPIO4", "D4"), ("CS5", "GPIO13", "D13")]
    mtops = [140 + i * 190 for i in range(5)]
    # ESP-Pins liegen in den Lücken zwischen den Lesern, damit keine Leitung auf einer Leser-Zeile liegt (sonst überdecken sich Farben).
    # Das Bild zeigt die Reihenfolge der Leitungen, NICHT die Lage der Pins auf dem Board.
    ys = [160, 190, 315, 343, 371, 515, 543, 571, 705, 733, 761]
    ypin = {k: ys[i] for i, (k, _, _) in enumerate(esp_rows)}
    # Sammelschienen: oberster ESP-Pin = am weitesten rechts (keine Kreuzung auf der ESP-Seite)
    rails = ["3V3", "GND", "SCK", "MOSI", "MISO", "RST"]
    xr = {k: 800 - i * 46 for i, k in enumerate(rails)}
    r_top, r_bot = 140, 1085
    # Leser
    mx, mw, mh = 1210, 380, 170
    names = ["Leser 1", "Leser 2", "Leser 3", "Leser 4", "Leser 5"]
    where = ["Slot 1 · linke Außenwand", "Slot 2 · Trennwand 1│2", "Slot 3 · Trennwand 2│3", "Slot 4 · Trennwand 3│4", "Extern · ext. Spulenhalter hinten"]
    pin_rows = ["SDA", "SCK", "MOSI", "MISO", "IRQ", "GND", "RST", "3V3"]
    pin_lab = {"SDA": "SDA (= CS)", "SCK": "SCK", "MOSI": "MOSI", "MISO": "MISO", "IRQ": "IRQ", "GND": "GND", "RST": "RST", "3V3": "3.3V"}
    # Schienen zuerst zeichnen
    for k in rails:
        wire(ax, [(xr[k], r_top), (xr[k], r_bot)], C[k], lw=3.4, z=2)
        ax.text(xr[k], r_top - 14, k, fontsize=10.5, fontweight="bold", color=C[k] if k != "SCK" else "#a98600", ha="center", va="center", zorder=5)
    # ESP-Pins -> Schienen
    for k in rails:
        y = ypin[k]
        label = next(r for r in esp_rows if r[0] == k)
        esp_pin(ax, px, y, label[1], label[2])
        wire(ax, [(px, y), (xr[k], y)], C[k])
        dot(ax, px, y, C[k])
        dot(ax, xr[k], y, C[k])
    # Leser
    for i, mt in enumerate(mtops):
        module_block(ax, mx, mt, mw, mh, f"RC522 {names[i]}")
        ax.text(mx + mw - 18, mt + 44, where[i], fontsize=9.2, color="#cfe8da", ha="right", va="center", zorder=5)
        for j, pr in enumerate(pin_rows):
            y = mt + 62 + j * 14.2
            used = pr != "IRQ"
            ax.add_patch(Rectangle((mx - 9, y - 5), 18, 10, fc="#d9a441" if used else "#9aa3ab", ec="#8a6a1f", lw=1, zorder=4))
            ax.text(mx + 16, y, pin_lab[pr], fontsize=8.6, fontweight="bold" if used else "normal",
                    color="white" if used else "#d5dbe0", ha="left", va="center", zorder=5)
            if pr in rails:
                wire(ax, [(mx, y), (xr[pr], y)], C[pr], lw=2.6, z=3)
                dot(ax, xr[pr], y, C[pr], r=4.4)
                dot(ax, mx, y, C[pr], r=4.2)
    # CS-Leitungen (eigene Spur links der Schienen)
    cs = ["CS1", "CS2", "CS3", "CS4", "CS5"]
    for i, k in enumerate(cs):
        lane = 420 + i * 16
        ytop = mtops[i] + 62
        y = ypin[k]
        label = next(r for r in esp_rows if r[0] == k)
        esp_pin(ax, px, y, label[1], label[2])
        wire(ax, [(px, y), (lane, y), (lane, ytop), (mx, ytop)], C[k], lw=3.0)
        dot(ax, px, y, C[k])
        dot(ax, mx, ytop, C[k], r=4.6)
        ax.text(1000, ytop - 11, f"{k}: {label[1]} → SDA von {names[i]}", fontsize=9.3, color=SOFT, ha="center", va="center", zorder=5)
    # Legende + Hinweis unter den Lesern
    legend(ax, 60, 1152, [("3V3", C["3V3"], "3V3"), ("GND", C["GND"], "GND"), ("SCK", C["SCK"], "SCK"), ("MOSI", C["MOSI"], "MOSI"),
                          ("MISO", C["MISO"], "MISO"), ("RST", C["RST"], "RST (GPIO22)")], per_row=6, dx=165, size=10)
    ax.text(1080, 1152, "CS1 bis CS5: Violett, Braun, Grau, Pink, Türkis (nur Vorschlag, Farben dürfen anders sein)", fontsize=9.5, color=SOFT, va="center")
    warn_box(ax, 40, 1190, 1820, 135,
             "Wichtig\n"
             "•  RC522 NUR an 3,3 V (nie an 5 V oder VIN). IRQ bleibt bei allen Lesern frei.\n"
             "•  Sammelschienen = die Litzen innen verlöten (Kette oder Stern), Lötstellen mit Schrumpfschlauch sichern.\n"
             "•  Reihenfolge: erst Leser 1 testen (Bild 1), danach 2, 3, 4, 5, jeweils nach dem Anlöten kurz prüfen.",
             fs=10.5)
    save(fig, "2_alle_leser")


# ===================================================================================
# 3  Feuchte-Sensor
# ===================================================================================
def fig_sensor():
    W, H = 1400, 820
    fig, ax = fig_ax(W, H, "Feuchte-Sensor SHT31-D (I2C)",
                     "Sensor 1 steckt in der Filament-Lagerbox / AMS. Sensor 2 steckt im externen Spulentrockner (5. Spule) und hängt an einem eigenen Bus.")
    ex, ey, ew, eh = 50, 120, 330, 640
    esp_block(ax, ex, ey, ew, eh)
    px = ex + ew
    # ESP-Pins in der Reihenfolge der Sensor-Pins (VIN, GND, SCL, SDA)
    mx, mw = 930, 360
    s1, s2 = 120, 450
    for top, title, sub in [(s1, "SHT31-D  Box", "SDA GPIO21 · SCL GPIO32"), (s2, "SHT31-D  Trockner (extern)", "SDA GPIO33 · SCL GPIO25")]:
        module_block(ax, mx, top, mw, 250, title, color="#2d5f8a", dark="#173a57")
        ax.text(mx + mw - 18, top + 48, sub, fontsize=9.5, color="#d2e4f3", ha="right", va="center", zorder=5)
    pins = ["VIN", "GND", "SCL", "SDA"]
    # Sensor 1
    y1 = {p: s1 + 95 + i * 36 for i, p in enumerate(pins)}
    y2 = {p: s2 + 95 + i * 36 for i, p in enumerate(pins)}
    for p in pins:
        mod_pin(ax, mx, y1[p], {"VIN": "VIN (3,3 V)", "GND": "GND", "SCL": "SCL", "SDA": "SDA"}[p])
        mod_pin(ax, mx, y2[p], {"VIN": "VIN (3,3 V)", "GND": "GND", "SCL": "SCL", "SDA": "SDA"}[p])
    # ESP-Pins (Reihenfolge im Bild: auf Sensor 1 ausgerichtet)
    ey_ = {"3V3": y1["VIN"], "GND": y1["GND"], "GPIO32": y1["SCL"], "GPIO21": y1["SDA"], "GPIO25": y2["SCL"], "GPIO33": y2["SDA"]}
    col = {"3V3": C["3V3"], "GND": C["GND"], "GPIO32": C["SCL"], "GPIO21": C["SDA"], "GPIO25": C["SCL"], "GPIO33": C["SDA"]}
    sub = {"GPIO32": "SCL Box", "GPIO21": "SDA Box", "GPIO25": "SCL Trockner", "GPIO33": "SDA Trockner"}
    for k, y in ey_.items():
        esp_pin(ax, px, y, k, sub.get(k))
    # Sensor 1: direkte Leitungen
    wire(ax, [(px, ey_["3V3"]), (mx, y1["VIN"])], C["3V3"])
    wire(ax, [(px, ey_["GND"]), (mx, y1["GND"])], C["GND"])
    wire(ax, [(px, ey_["GPIO32"]), (mx, y1["SCL"])], C["SCL"])
    wire(ax, [(px, ey_["GPIO21"]), (mx, y1["SDA"])], C["SDA"])
    # Sensor 2: Strom + Masse als Abzweig, Daten eigene Leitungen
    xb = {"3V3": 610, "GND": 660}
    for k, pin in (("3V3", "VIN"), ("GND", "GND")):
        wire(ax, [(xb[k], ey_[k]), (xb[k], y2[pin]), (mx, y2[pin])], col[k])
        dot(ax, xb[k], ey_[k], col[k])
    wire(ax, [(px, ey_["GPIO25"]), (mx, y2["SCL"])], C["SCL"])
    wire(ax, [(px, ey_["GPIO33"]), (mx, y2["SDA"])], C["SDA"])
    for p in pins:
        for yy in (y1[p], y2[p]):
            c = {"VIN": C["3V3"], "GND": C["GND"], "SCL": C["SCL"], "SDA": C["SDA"]}[p]
            dot(ax, mx, yy, c)
    for k, y in ey_.items():
        dot(ax, px, y, col[k])
    ax.text(710, 418, "Zweiter Sensor: gleiche Adresse (0x44) geht nicht\nauf einem Bus, darum eigene Pins GPIO33 / GPIO25",
            fontsize=9.5, color=SOFT, ha="left", va="center", zorder=5, linespacing=1.4)
    warn_box(ax, 50, 770, 1240, 46,
             "Kabel: bis ca. 1 m problemlos, bis ca. 2 m meist auch. SDA und SCL jeweils mit GND verdrillen. Sensor nicht neben den ESP32 kleben (der wird warm).",
             fs=10.2)
    ax.text(1290, 384, "Home Assistant: sensor.filament_ams_box_feuchte / _box_temperatur", fontsize=9, color=SOFT, ha="right", va="center")
    ax.text(1290, 714, "Home Assistant: sensor.filament_ams_trockner_feuchte / _trockner_temperatur", fontsize=9, color=SOFT, ha="right", va="center")
    save(fig, "3_sensor")


# ===================================================================================
# 4  Einbau im AMS (Skizze)
# ===================================================================================
def fig_ams():
    W, H = 1500, 890
    fig, ax = fig_ax(W, H, "Einbau im AMS 2 Pro (Draufsicht, Skizze)",
                     "Nicht maßstäblich. Innenmaße sind noch nicht gemessen: Leser erst mit Klebeband probeweise ansetzen und testen.")
    ax0, ay0, aw, ah = 110, 180, 900, 540
    rbox(ax, ax0, ay0, aw, ah, "#eef1f4", "#3b4249", lw=3, r=18)
    ax.text(ax0 - 18, ay0 + 20, "hinten", fontsize=11, color=SOFT, ha="right", va="center", zorder=5)
    ax.text(ax0 - 18, ay0 + ah - 20, "vorne", fontsize=11, color=SOFT, ha="right", va="center")
    sw = aw / 4
    # Bambu-Leser vorne (Sperrzone)
    ax.add_patch(Rectangle((ax0 + 3, ay0 + ah - 100), aw - 6, 97, fc="#fde2e2", ec="none", hatch="////", alpha=0.7, zorder=1))
    ax.text(ax0 + aw / 2, ay0 + ah - 50, "vorne in den Zuführungen sitzen die Bambu-Leser: eigene Leser mindestens 4 cm davon weg",
            fontsize=10.5, color="#9b1c1c", ha="center", va="center", zorder=5, fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="#e8b4b4", alpha=0.95))
    for i in range(4):
        sx = ax0 + i * sw
        if i > 0:
            ax.add_patch(Rectangle((sx - 4, ay0 + 6), 8, ah - 12, fc="#8b949e", ec="#4b535a", lw=1, zorder=2))
        # Spule von oben
        ax.add_patch(Rectangle((sx + 52, ay0 + 40), sw - 80, ah - 170, fc="#cfe3f5", ec="#3b6ea5", lw=2, zorder=2))
        ax.text(sx + 52 + (sw - 80) / 2, ay0 + 70, f"Spule {i + 1}", fontsize=11, fontweight="bold", color="#254a73", ha="center", va="center", zorder=5)
        ax.text(sx + 52 + (sw - 80) / 2, ay0 + 94, "Tag links außen", fontsize=8.8, color="#254a73", ha="center", va="center", zorder=5)
        # Tag (links an der Spule)
        ax.add_patch(Circle((sx + 52, ay0 + 200), 9, fc="#e8a317", ec="#8a5a00", lw=1.5, zorder=6))
        # Leser an der linken Wand
        wall_x = ax0 if i == 0 else sx + 4
        rx = wall_x + 6 if i == 0 else wall_x
        ax.add_patch(Rectangle((rx, ay0 + 160), 22, 80, fc="#1f6f4a", ec="#10412b", lw=2, zorder=6))
        ax.text(rx + 11, ay0 + 200, str(i + 1), fontsize=11, fontweight="bold", color="white", ha="center", va="center", zorder=7)
        # Kabel nach hinten
        wire(ax, [(rx + 11, ay0 + 160), (rx + 11, ay0 - 40)], C[f"CS{i + 1}"], lw=2.6, z=4)
    # Kabelbaum + ESP32 außen
    wire(ax, [(ax0 + 17, ay0 - 40), (1115, ay0 - 40), (1115, 360)], "#6b7178", lw=4, z=3, ls="--")
    rbox(ax, 1030, 360, 170, 120, ESP_FILL, "#0b1b2b", lw=2.5)
    ax.text(1115, 402, "ESP32", fontsize=15, fontweight="bold", color="white", ha="center", va="center", zorder=5)
    ax.text(1115, 430, "außerhalb,\nim Gehäuse (case/)", fontsize=9, color="#b8c7d6", ha="center", va="center", zorder=5, linespacing=1.3)
    ax.text(1090, ay0 - 62, "Kabelbaum läuft hinten an der Wand und unter der Deckeldichtung nach außen", fontsize=9.5, color=SOFT,
            ha="right", va="center")
    # Extern
    rbox(ax, 1030, 530, 170, 100, "#eef1f4", "#3b4249", lw=2, r=12)
    ax.text(1115, 560, "Extern", fontsize=12, fontweight="bold", color=INK, ha="center", va="center", zorder=5)
    ax.text(1115, 586, "Leser 5 am externen\nSpulenhalter hinten", fontsize=9, color=SOFT, ha="center", va="center", zorder=5, linespacing=1.3)
    ax.add_patch(Rectangle((1020, 550), 18, 60, fc="#1f6f4a", ec="#10412b", lw=2, zorder=6))
    ax.text(1029, 580, "5", fontsize=10, fontweight="bold", color="white", ha="center", va="center", zorder=7)
    # Legende / Regeln
    warn_box(ax, 110, 765, 1090, 105,
             "•  Leser 1 an die linke Außenwand, Leser 2 bis 4 an die Trennwand links von ihrem Slot (Seite zum eigenen Slot).\n"
             "•  Unten an der Wand, kurz über den Laufrollen, eher hinten/mittig. Abstand zur Spulenseite höchstens 2–3 cm.\n"
             "•  NTAG-Aufkleber auf die linke Spulenseite, 1–3 cm vom Rand. Spule immer mit dem Tag nach links einlegen.\n"
             "•  Halter aus PETG/ASA (innen bis 65 °C beim Trocknen). Nichts bohren, Ferrit-Folie nur wenn der Nachbar-Slot mitliest.",
             fs=10.2)
    save(fig, "4_einbau_ams")


if __name__ == "__main__":
    fig_test()
    fig_all()
    fig_sensor()
    fig_ams()
