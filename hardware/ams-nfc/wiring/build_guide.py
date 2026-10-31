"""Erzeugt die Aufbau-Anleitung als AUFBAU.md und AUFBAU.pdf (gleicher Inhalt).
Aufruf: python3 build_wiring.py && python3 build_guide.py   (pip install reportlab matplotlib)
Inhalt hier einmal pflegen, beide Dateien entstehen daraus.
"""
import os
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, Image, KeepTogether, NextPageTemplate, PageBreak, PageTemplate,
                                Paragraph, Preformatted, Spacer, Table, TableStyle)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)  # hardware/ams-nfc
REV = "1.115"
DATE = "30.10.2026"

# ----------------------------------------------------------------------------- Inhalt
B = []  # Blöcke


def h1(t): B.append(("h1", t))
def h2(t): B.append(("h2", t))
def p(t): B.append(("p", t))
def ul(items): B.append(("ul", items))
def ol(items): B.append(("ol", items))
def table(head, rows, widths=None): B.append(("table", head, rows, widths))
def img(path, title, caption=None): B.append(("img", path, title, caption))
def code(t): B.append(("code", t))
def note(t): B.append(("note", t))


h1("FilamentHub: NFC-Leser und Feuchte-Sensor im AMS")
p(f"Aufbau-Anleitung · Stand {REV} · {DATE}")
p("**So läuft es:** Ein ESP32 liest 5 NFC-Leser (Slot 1 bis 4 und extern) und 1 bis 2 Feuchte-Sensoren. "
  "Er schickt die Werte per WLAN an Home Assistant. Die FilamentHub-App holt sie dort ab, ordnet Spule und Slot zu "
  "und warnt bei zu hoher Feuchte.")
note("Bambu-Spulen bekommen KEINEN eigenen Tag. Das AMS liest ihren Chip selbst, die App liest nur mit. "
     "Nur Spulen anderer Marken (Sunlu, Eryone, Polymaker …) bekommen einen NTAG-Aufkleber.")

h2("1. Reihenfolge für heute")
ol([
    "Teile prüfen (Liste unten).",
    "ESP32 flashen: nur per USB, noch nichts angeschlossen (Kapitel 6).",
    "EINEN Leser anschließen (Bild 1), Tag davorhalten, in Home Assistant prüfen.",
    "Feuchte-Sensor anschließen (Bild 3), Wert in Home Assistant prüfen.",
    "Restliche Leser anlöten (Bild 2). Nach jedem Leser kurz testen.",
    "Teile drucken: Halter, ESP32-Gehäuse, Sensor-Box (Kapitel 4).",
    "Einbau im AMS (Bild 4): erst mit Klebeband probeweise, dann fest.",
    "Tags auf die Spulen kleben, in der App zuordnen (Kapitel 9).",
])

h2("2. Das brauchst du")
table(["Teil", "Menge", "Hinweis"], [
    ["ESP32 (WROOM-32, USB-C, CH340)", "1", "Zweiter ist Ersatz. Windows braucht evtl. den CH340-Treiber."],
    ["RC522 Leser (Binghe)", "5", "NUR 3,3 V. Stiftleiste nicht einlöten, Litzen direkt anlöten."],
    ["SHT31-D Sensor (ARCELI)", "1 bis 2", "Pins: VIN, GND, SCL, SDA. Zweiter ist für den externen Spulentrockner (5. Spule)."],
    ["Silikonlitze 26 AWG", "mehrere Farben", "Farben nur Vorschlag. Notier dir, welche Farbe wohin geht."],
    ["Jumper-Kabel (ELEGOO)", "einige", "Für den Testaufbau auf dem Tisch."],
    ["Lötkolben, Lötzinn, Schrumpfschlauch", "–", "Jede Lötstelle mit Schrumpfschlauch sichern."],
    ["NTAG-Aufkleber", "1 je Fremdspule", "Nicht für Bambu-Spulen."],
    ["PETG oder ASA Filament", "–", "Halter und Gehäuse. Im AMS wird es bis 65 °C warm."],
    ["Hitzefestes Klebeband (3M VHB)", "1 Rolle", "Normales Klebeband und Isolierband lösen sich."],
    ["Ferrit-Folie ca. 50 × 60 mm", "optional", "Erst kaufen, wenn ein Leser den Nachbar-Slot mitliest."],
    ["USB-C Datenkabel + 5-V-Netzteil", "1", "Dauerstrom für den ESP32 in Reichweite des AMS."],
    ["Messschieber", "1", "Board-Maße von ESP32 und SHT31-D prüfen vor dem Druck."],
    ["Home Assistant + Add-on „ESPHome Device Builder“", "–", "Hast du schon (Pi). Chrome oder Edge am PC fürs Flashen."],
], [62, 28, 80])

h2("3. Dateien (Ordner hardware/ams-nfc im Repo)")
table(["Datei", "Was"], [
    ["filament-ams.yaml", "ESPHome-Konfiguration für den ESP32 (fertig, von ESPHome 2026.10.1 als gültig geprüft)"],
    ["sensor-box/sensor_box_base.stl, sensor_box_lid.stl", "Mini-Gehäuse für den SHT31-D (Unterteil + Deckel)"],
    ["case/esp32_case_base.stl, esp32_case_lid.stl", "Gehäuse für den ESP32 (Unterteil + Deckel)"],
    ["holder/rc522_holder.stl", "Halter für einen RC522, 44 × 64 × 5 mm (5 Stück)"],
    ["holder/rc522_holder_flach.stl", "Dünne Version, 2,4 mm, ohne Ferrit-Mulde"],
    ["wiring/*.png und *.svg", "Die vier Diagramme aus dieser Anleitung"],
], [75, 95])

h2("4. Drucken")
table(["Teil", "Material", "Einstellung", "Lage auf dem Bett"], [
    ["Halter × 5", "PETG / ASA", "0,2 mm, 3 Wände, ohne Stützen", "flach"],
    ["ESP32-Gehäuse", "PETG / ASA", "0,2 mm, 3 Wände, ohne Stützen", "Unterteil: Boden unten. Deckel: Außenseite unten"],
    ["Sensor-Box × 1 bis 2", "PLA reicht in der Lagerbox, im AMS PETG / ASA", "0,4 mm Düse, 0,12 bis 0,16 mm, ohne Stützen",
     "Unterteil: Boden unten. Deckel: flache Seite unten"],
], [38, 42, 50, 40])
note("Vor dem Druck messen: Das ESP32-Gehäuse passt für ein 38-Pin-DevKit mit 28,5 × 55 mm. "
     "Die Sensor-Box ist für ein Board von 13 × 16 mm eingestellt (kleiner geht auch). "
     "Ist ein Board größer, in build_case.py bzw. build_sensor_box.py die Werte bw und bl ändern und neu bauen.")

h2("5. Verkabelung")
p("Die Diagramme zeigen die **Reihenfolge der Leitungen**, nicht die Lage der Pins auf dem Board. "
  "Such jeden Pin auf deinem ESP32 nach der aufgedruckten Beschriftung (zum Beispiel D18, D23, 3V3). "
  "Auf deinem Board steht D17 (GPIO17) als D17 und D16 (GPIO16) als D16 (bei anderen Boards TX2 und RX2, das ist derselbe Pin).")
h2("RC522 an ESP32")
table(["RC522-Pin", "ESP32-Pin", "gilt für"], [
    ["3.3V", "3V3", "alle 5 Leser gemeinsam"],
    ["GND", "GND", "alle 5 Leser gemeinsam"],
    ["SCK", "D18 (GPIO18)", "alle 5 Leser gemeinsam"],
    ["MOSI", "D23 (GPIO23)", "alle 5 Leser gemeinsam"],
    ["MISO", "D19 (GPIO19)", "alle 5 Leser gemeinsam"],
    ["RST", "D22 (GPIO22)", "alle 5 Leser gemeinsam"],
    ["IRQ", "frei lassen", "–"],
    ["SDA (= CS) Leser 1 / Slot 1", "D5 (GPIO5)", "einzeln"],
    ["SDA (= CS) Leser 2 / Slot 2", "D17 (GPIO17)", "einzeln"],
    ["SDA (= CS) Leser 3 / Slot 3", "D16 (GPIO16)", "einzeln"],
    ["SDA (= CS) Leser 4 / Slot 4", "D4 (GPIO4)", "einzeln"],
    ["SDA (= CS) Leser 5 / Extern", "D13 (GPIO13)", "einzeln"],
], [70, 50, 50])
h2("SHT31-D an ESP32")
table(["Sensor-Pin", "Sensor Box", "Sensor Trockner"], [
    ["VIN", "3V3", "3V3"],
    ["GND", "GND", "GND"],
    ["SDA", "D21 (GPIO21)", "D33 (GPIO33)"],
    ["SCL", "D32 (GPIO32)", "D25 (GPIO25)"],
], [50, 55, 65])
p("D22 (GPIO22) ist schon RST der Leser, darum liegt SCL der Box auf D32 (GPIO32). Der Trockner-Sensor hat einen eigenen Bus, weil beide Sensoren die Adresse 0x44 haben.")
ul([
    "**Nur 3,3 V** an die RC522. Nie an 5 V oder VIN.",
    "Sensor nicht direkt neben den ESP32 kleben, der wird warm und der Sensor misst dann zu wenig Feuchte.",
    "Sensor-Kabel: bis ca. 1 m problemlos, bis ca. 2 m meist auch. SDA und SCL mit GND verdrillen.",
    "Bei Aussetzern der Leser: Kabel kürzen und SCK, MOSI, MISO mit einer GND-Litze verdrillen.",
])

img("wiring/1_test_ein_leser.png", "Bild 1: Testaufbau mit einem Leser")
img("wiring/2_alle_leser.png", "Bild 2: Alle 5 Leser")
img("wiring/3_sensor.png", "Bild 3: Feuchte-Sensor")
img("wiring/4_einbau_ams.png", "Bild 4: Einbau im AMS (Skizze, nicht maßstäblich)")

h2("6. ESP32 aufspielen (ESPHome)")
ol([
    "In Home Assistant das Add-on **ESPHome Device Builder** öffnen.",
    "**New Device**, Name `filament-ams`, Typ ESP32. Bei „Set up Wi-Fi“ dein WLAN eintragen (dann sind `wifi_ssid` und `wifi_password` schon als Secrets da).",
    "**Wichtig vor dem Ersetzen:** In der automatisch erzeugten Datei stehen ein API-Schlüssel (Zeile `key:` unter `api` / `encryption`) und ein OTA-Passwort. Beide kopieren.",
    "Oben rechts **Secrets** öffnen und eintragen: `filament_ams_api_key` (der kopierte Schlüssel) und `filament_ams_ota` (das kopierte Passwort oder ein eigenes).",
    "Den ganzen Inhalt der Datei durch `filament-ams.yaml` ersetzen und speichern.",
    "ESP32 per USB-C an den PC, **Install**, **Plug into this computer**. Das erste Mal dauert einige Minuten.",
    "Fertig: In Home Assistant unter **Einstellungen, Geräte & Dienste, ESPHome** erscheint „filament-ams“. Auf **Hinzufügen** klicken, den API-Schlüssel eingeben.",
])
code("""# Secrets (nur Beispiel, keine echten Werte):
wifi_ssid: "DeinWLAN"
wifi_password: "dein-wlan-passwort"
filament_ams_api_key: "<der Schlüssel aus der erzeugten Datei>"
filament_ams_ota: "<das OTA-Passwort>"
""")
note("Fehlt „Plug into this computer“ oder ist es grau? Das geht nur, wenn Home Assistant über https oder localhost geöffnet ist "
     "und du Chrome oder Edge nutzt. Dann: Install, Manual download, Factory format. Die .bin-Datei auf https://web.esphome.io "
     "öffnen, Connect, Port wählen, Install. Erkennt Windows den ESP32 nicht: CH340-Treiber installieren und ein Datenkabel nehmen (kein reines Ladekabel).")
p("Danach geht jedes Update drahtlos („Wirelessly“). Zum Testen kannst du `remove_after` in der YAML kurz auf `10s` stellen, "
  "damit ein Slot nach dem Wegnehmen des Tags schnell leer wird. Danach zurück auf `10min` (die Spule dreht sich beim Drucken).")

h2("7. Testen")
ol([
    "Home Assistant, **Entwicklerwerkzeuge, Zustände**, Filter `filament_ams`.",
    "Du siehst: `sensor.filament_ams_slot_1_tag` bis `_slot_5_tag`, `_box_feuchte`, `_box_temperatur`, `_trockner_feuchte`, `_trockner_temperatur`, `_ip`, `_wlan_signal`, `_esp32_temperatur`.",
    "NTAG-Aufkleber 2 bis 3 cm vor Leser 1 halten. `slot_1_tag` zeigt die Nummer, zum Beispiel `04-A1-B2-C3-D4-E5-F6`.",
    "Warm die Hand über den Sensor halten: Temperatur und Feuchte steigen.",
    "Ist alles gut, den nächsten Leser anlöten. Immer nur einen Schritt auf einmal.",
])
note("Beim Test mit einem Leser meldet der ESP32 im Log Fehler für Leser 2 bis 5 und evtl. für den zweiten Sensor. Das ist normal, die sind noch nicht angeschlossen. "
     "Eine Bambu-Spule im Slot steht nur als „fremder Tag ignoriert“ im Log. Auch normal.")

h2("8. Fehlersuche")
table(["Problem", "Prüfen"], [
    ["Leser erkennt keinen Tag", "3V3 und GND? MISO und MOSI nicht vertauscht? Abstand unter 2 bis 3 cm? Wirklich ein NTAG (kein Bambu-Chip)? Log in ESPHome ansehen."],
    ["Alle Leser tot, einer geht", "Gemeinsame Leitung (SCK, MOSI, MISO, RST, 3V3, GND) an dem Leser unterbrochen? Lötstellen prüfen."],
    ["Ein Leser tot, andere gehen", "SDA-Leitung (CS) dieses Lesers an den richtigen GPIO? Kaltlötstelle?"],
    ["Leser liest den Nachbar-Slot mit", "Ferrit-Folie hinter den Leser, 5-mm-Halter nutzen, Leser weiter nach hinten setzen."],
    ["Sensor „nicht verfügbar“", "SDA und SCL vertauscht? Im ESPHome-Log steht nach dem Start, welche I2C-Adresse gefunden wurde (erwartet 0x44). Kabel kürzen."],
    ["Feuchte springt oder ist zu niedrig", "Sensor weg vom ESP32 und von Trockenmittel-Päckchen. Kabel verdrillen."],
    ["Slot wird nach einer Weile „leer“", "Normal: nach `remove_after` (10 min) ohne Tag gilt der Slot als leer."],
    ["ESP32 nicht im WLAN", "Secrets prüfen. Fällt er zurück, macht er das WLAN „Filament-AMS Setup“ auf."],
], [55, 115])

h2("9. Einbau im AMS 2 Pro")
ul([
    "**Wohin:** Leser 1 an die linke Außenwand innen, Leser 2 bis 4 an die Trennwand links von ihrem Slot (Seite zum eigenen Slot), Leser 5 am externen Spulenhalter hinten.",
    "**Lage:** unten an der Wand, kurz über den Laufrollen, eher hinten und mittig. Mindestens ca. 4 cm Abstand zu den Bambu-Lesern vorne in den Zuführungen, sonst stören sich die Leser (gleiche Funkfrequenz).",
    "**Abstand zur Spule:** höchstens 2 bis 3 cm. Platine im 5-mm-Halter, flach an die Wand.",
    "**Kleben:** 3M VHB oder hitzefestes Klebeband (innen bis 65 °C). Nichts bohren.",
    "**Kabel:** dünne Litzen flach an der Wand nach hinten, unter der Deckeldichtung hinaus. ESP32 außen im Gehäuse.",
    "**Tag auf die Spule:** NTAG auf die linke Spulenseite, 1 bis 3 cm vom Rand. Spule immer mit dem Tag nach links einlegen.",
    "**Gelesen wird beim Drehen:** Der Tag kommt bei jeder Umdrehung am Leser vorbei. Eine neue Fremd-Spule erkennt die App spätestens kurz nach dem Druckstart.",
    "**Zuerst probieren:** Leser mit Klebeband ansetzen, Tag drehen, in Home Assistant prüfen. Erst wenn es klappt, fest kleben.",
])

h2("10. In der App")
ul([
    "Home Assistant muss in der App verbunden sein (Verbindungen, Home Assistant). Dann findet sie die Sensoren `sensor.filament_ams_slot_1_tag` bis `slot_5_tag` selbst.",
    "**Bekannter Tag:** Die Spule wird dem Slot zugeordnet. Passt der Slot im Drucker nicht, schickt die App Material und Farbe (Entwickler-Modus nötig).",
    "**Unbekannter Tag:** Die App meldet „Unbekannter Tag in Slot X“. Wähl im Slot einmal die Spule aus, dann merkt sie sich den Tag.",
    "**Feuchte:** Mitteilungen, Einstellungen, Luftfeuchte. Standard: Alarm ab 25 %, AMS trocknet automatisch ab 30 %. Die App kennt `sensor.filament_ams_box_feuchte` schon.",
    "**Bambu-Spulen:** Neue Bambu-Spule im AMS, dann fragt die App „Als neue Spule anlegen“ (alles vorausgefüllt) oder „Ist schon in der App“.",
])

h2("11. Was noch nicht getestet ist")
ul([
    "Die ESPHome-Konfiguration ist von ESPHome 2026.10.1 als gültig geprüft. Die Firmware selbst wurde nicht kompiliert, nicht geflasht und nicht an echten Lesern probiert.",
    "Die AMS-Innenmaße sind nicht gemessen. Wie viel Platz an Wand und Trennwand ist, zeigt erst der Test.",
    "Ob ein Leser an der Trennwand den Nachbar-Slot mitliest, ist offen. Zuerst Slot 1 an der Außenwand testen.",
    "Die Board-Maße von ESP32 und SHT31-D musst du vor dem Druck messen.",
    "Wie lang die Kabel zwischen ESP32 und Lesern sein dürfen, hängt vom Aufbau ab. Bei Aussetzern Kabel kürzen und verdrillen.",
])

# ----------------------------------------------------------------------------- Markdown
def md_inline(t):
    return t


def render_md():
    out = []
    for b in B:
        k = b[0]
        if k == "h1":
            out.append(f"# {b[1]}\n")
        elif k == "h2":
            out.append(f"## {b[1]}\n")
        elif k == "p":
            out.append(f"{b[1]}\n")
        elif k == "ul":
            out.append("\n".join(f"- {i}" for i in b[1]) + "\n")
        elif k == "ol":
            out.append("\n".join(f"{n}. {i}" for n, i in enumerate(b[1], 1)) + "\n")
        elif k == "table":
            head, rows = b[1], b[2]
            out.append("| " + " | ".join(head) + " |")
            out.append("|" + "|".join("---" for _ in head) + "|")
            for r in rows:
                out.append("| " + " | ".join(c.replace("|", "\\|") for c in r) + " |")
            out.append("")
        elif k == "img":
            out.append(f"### {b[2]}\n\n![{b[2]}]({b[1]})\n")
        elif k == "code":
            out.append("```yaml\n" + b[1].rstrip() + "\n```\n")
        elif k == "note":
            out.append("> **Hinweis:** " + b[1] + "\n")
    with open(os.path.join(OUT, "AUFBAU.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print("ok AUFBAU.md")


# ----------------------------------------------------------------------------- PDF
FD = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("DV", FD + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DV-B", FD + "DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DV-I", FD + "DejaVuSans-Oblique.ttf"))
pdfmetrics.registerFont(TTFont("DV-BI", FD + "DejaVuSans-BoldOblique.ttf"))
pdfmetrics.registerFont(TTFont("DVM", FD + "DejaVuSansMono.ttf"))
pdfmetrics.registerFontFamily("DV", normal="DV", bold="DV-B", italic="DV-I", boldItalic="DV-BI")

GREEN = colors.HexColor("#1f6f4a")
INK = colors.HexColor("#1b1f23")
SOFT = colors.HexColor("#5b636b")
ST = {
    "h1": ParagraphStyle("h1", fontName="DV-B", fontSize=20, leading=25, textColor=INK, spaceAfter=4),
    "h2": ParagraphStyle("h2", fontName="DV-B", fontSize=13.5, leading=17, textColor=GREEN, spaceBefore=12, spaceAfter=5, keepWithNext=1),
    "p": ParagraphStyle("p", fontName="DV", fontSize=9.6, leading=14, textColor=INK, spaceAfter=5, alignment=TA_LEFT),
    "li": ParagraphStyle("li", fontName="DV", fontSize=9.6, leading=13.6, textColor=INK, leftIndent=14, bulletIndent=2, spaceAfter=2.5),
    "cell": ParagraphStyle("cell", fontName="DV", fontSize=8.6, leading=11.4, textColor=INK),
    "cellh": ParagraphStyle("cellh", fontName="DV-B", fontSize=8.6, leading=11.4, textColor=colors.white),
    "note": ParagraphStyle("note", fontName="DV", fontSize=9.2, leading=13, textColor=INK),
    "img": ParagraphStyle("img", fontName="DV-B", fontSize=13, leading=16, textColor=INK, spaceAfter=3),
}


def fmt(t):
    t = escape(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`(.+?)`", r'<font name="DVM" size="8.6">\1</font>', t)
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("DV", 7.5)
    canvas.setFillColor(SOFT)
    w, h = canvas._pagesize
    canvas.drawString(12 * mm, 7 * mm, f"FilamentHub · NFC-Leser und Sensor · Stand {REV}")
    canvas.drawRightString(w - 12 * mm, 7 * mm, f"Seite {doc.page}")
    canvas.restoreState()


def build_pdf():
    path = os.path.join(OUT, "AUFBAU.pdf")
    doc = BaseDocTemplate(path, pagesize=A4, title="FilamentHub: NFC-Leser und Feuchte-Sensor im AMS",
                          author="Claude", subject=f"Aufbau-Anleitung Stand {REV}")
    pw, ph = A4
    lw, lh = landscape(A4)
    port = PageTemplate(id="port", frames=[Frame(15 * mm, 14 * mm, pw - 30 * mm, ph - 26 * mm, id="fp")], onPage=footer, pagesize=A4)
    land = PageTemplate(id="land", frames=[Frame(10 * mm, 12 * mm, lw - 20 * mm, lh - 22 * mm, id="fl")], onPage=footer, pagesize=landscape(A4))
    doc.addPageTemplates([port, land])
    avail = pw - 30 * mm
    S = []
    in_land = False
    for b in B:
        k = b[0]
        if in_land and k != "img":
            S += [NextPageTemplate("port"), PageBreak()]
            in_land = False
        if k in ("h1", "h2", "p"):
            S.append(Paragraph(fmt(b[1]), ST[k]))
        elif k == "ul":
            for i in b[1]:
                S.append(Paragraph(fmt(i), ST["li"], bulletText="•"))
            S.append(Spacer(1, 3))
        elif k == "ol":
            for n, i in enumerate(b[1], 1):
                S.append(Paragraph(fmt(i), ST["li"], bulletText=f"{n}."))
            S.append(Spacer(1, 3))
        elif k == "table":
            head, rows, widths = b[1], b[2], b[3]
            data = [[Paragraph(fmt(c), ST["cellh"]) for c in head]] + [[Paragraph(fmt(c), ST["cell"]) for c in r] for r in rows]
            cw = None
            if widths:
                tot = sum(widths)
                cw = [avail * w_ / tot for w_ in widths]
            t = Table(data, colWidths=cw, repeatRows=1)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f6f4")]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c4cdc8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]))
            S.append(t)
            S.append(Spacer(1, 6))
        elif k == "code":
            S.append(Preformatted(b[1].rstrip(), ParagraphStyle("code", fontName="DVM", fontSize=8, leading=11, textColor=INK,
                                                                backColor=colors.HexColor("#f3f4f6"), borderPadding=6, leftIndent=6)))
            S.append(Spacer(1, 8))
        elif k == "note":
            t = Table([[Paragraph("<b>Hinweis:</b> " + fmt(b[1]), ST["note"])]], colWidths=[avail])
            t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff4d6")),
                                   ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#e0b400")),
                                   ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                                   ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
            S.append(Spacer(1, 3))
            S.append(t)
            S.append(Spacer(1, 6))
        elif k == "img":
            from PIL import Image as PI
            ip = os.path.join(OUT, b[1])
            iw, ih = PI.open(ip).size
            maxw, maxh = lw - 20 * mm, lh - 22 * mm - 14 * mm
            sc = min(maxw / iw, maxh / ih)
            S += ([PageBreak()] if in_land else [NextPageTemplate("land"), PageBreak()])
            S += [Paragraph(fmt(b[2]), ST["img"]), Image(ip, width=iw * sc, height=ih * sc)]
            in_land = True
    doc.build(S)
    print("ok AUFBAU.pdf")


if __name__ == "__main__":
    render_md()
    build_pdf()
