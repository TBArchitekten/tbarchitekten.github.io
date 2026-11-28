# -*- coding: utf-8 -*-
"""Bürovorlagen LPH 3 als Excel: Koordination (FPB, SSM, PGF, A1.ABS, KLA, ENV) und Planliste (PLI).

Aufruf aus dem Repo:  python3 scripts/muster-lph3/build_xlsx.py
Schreibt muster/lph3/LPH3_3_Koordination.xlsx und muster/lph3/LPH3_2_Planliste.xlsx.
Danach Formelwerte berechnen (LibreOffice), damit Vorschau und die KI Werte sehen:
  python3 <xlsx-skill>/scripts/recalc.py muster/lph3/LPH3_3_Koordination.xlsx

Inhalt und Fundstellen: Aufgabenbibliothek LPH 3 v0.3.4 (app/data/muster-planner-lph3-v0.3.json),
HOAI 2021, BayBO, ByAK-Merkblätter – Liste in scripts/muster-lph3/quellen.json.
Die Mappen sind Muster: keine Projekt-, Kunden- oder Personendaten (das Repository ist öffentlich).
"""
import json, pathlib
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment

REPO = pathlib.Path(__file__).resolve().parents[2]
OUT = REPO / "muster" / "lph3"
OUT.mkdir(parents=True, exist_ok=True)
Q = json.load(open(REPO / "scripts/muster-lph3/quellen.json", encoding="utf-8"))
BIB = json.load(open(REPO / "app/data/muster-planner-lph3-v0.3.json", encoding="utf-8"))
PARAM = {p["code"]: p for p in BIB["parameters"]}
STAND = "20.11.2026"

# ───────── Gestaltung
ARIAL = "Arial"
INK, MUTED, GREEN, BLUE, GREY = "202823", "5F6B63", "355B49", "0000FF", "808080"
F_TITLE = Font(name=ARIAL, size=14, bold=True, color=INK)
F_SUB = Font(name=ARIAL, size=9, color=MUTED)
F_HEAD = Font(name=ARIAL, size=9, bold=True, color="FFFFFF")
F_BODY = Font(name=ARIAL, size=9, color=INK)
F_BOLD = Font(name=ARIAL, size=9, bold=True, color=INK)
F_PROP = Font(name=ARIAL, size=9, color=BLUE)            # Vorschlag des Musters – prüfen, überschreiben
F_EX = Font(name=ARIAL, size=9, italic=True, color=GREY)  # Beispielzeile – löschen
F_SEC = Font(name=ARIAL, size=9, bold=True, color=GREEN)
FILL_HEAD = PatternFill("solid", fgColor=GREEN)
FILL_IN = PatternFill("solid", fgColor="FFF4CC")          # Eingabe
FILL_SEC = PatternFill("solid", fgColor="E4ECE6")
FILL_CALC = PatternFill("solid", fgColor="F2F4F2")        # Formel – nicht überschreiben
THIN = Side(style="thin", color="C9D3CB")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")
WRAPC = Alignment(wrap_text=True, vertical="top", horizontal="center")
DATE = "DD.MM.YYYY"


LINE = Alignment(vertical="top")  # einzeilig: Kopfangaben und Hinweise laufen über leere Nachbarzellen


def put(ws, ref, value, font=F_BODY, fill=None, align=None, fmt=None, border=True):
    c = ws[ref]
    c.value = value
    c.font = font
    c.alignment = align or (WRAP if border else LINE)
    if fill: c.fill = fill
    if border: c.border = BOX
    if fmt: c.number_format = fmt
    return c


def title(ws, text, sub, width_cols):
    ws["A1"].value = text; ws["A1"].font = F_TITLE
    ws["A2"].value = sub; ws["A2"].font = F_SUB; ws["A2"].alignment = Alignment(wrap_text=False, vertical="top")
    ws.row_dimensions[1].height = 22


def header(ws, row, heads, widths, height=30):
    for i, (h, w) in enumerate(zip(heads, widths), start=1):
        col = get_column_letter(i)
        put(ws, f"{col}{row}", h, font=F_HEAD, fill=FILL_HEAD, align=WRAP)
        ws.column_dimensions[col].width = w
    ws.row_dimensions[row].height = height


def section(ws, row, text, ncols):
    for i in range(1, ncols + 1):
        c = ws.cell(row=row, column=i); c.fill = FILL_SEC; c.border = BOX
    put(ws, f"A{row}", text, font=F_SEC, fill=FILL_SEC, align=Alignment(vertical="center"))


def dv_list(ws, src, ranges, strict=False, prompt=None):
    dv = DataValidation(type="list", formula1=src, allow_blank=True)
    dv.errorStyle = "stop" if strict else "warning"
    dv.errorTitle = "Wert aus der Liste?"
    dv.error = "Dieser Wert steht nicht in der Auswahlliste (Blatt Listen). Trotzdem übernehmen?" if not strict else "Bitte einen Wert aus der Liste wählen."
    if prompt:
        dv.promptTitle = "Auswahl"; dv.prompt = prompt; dv.showInputMessage = True
    ws.add_data_validation(dv)
    for r in ranges if isinstance(ranges, (list, tuple)) else [ranges]:
        dv.add(r)
    return dv


def dv_date(ws, ranges):
    dv = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True)
    dv.errorStyle = "warning"; dv.error = "Bitte ein Datum eingeben (TT.MM.JJJJ)."
    ws.add_data_validation(dv)
    for r in ranges if isinstance(ranges, (list, tuple)) else [ranges]:
        dv.add(r)


def page(ws, title_rows, landscape=True, a3=False):
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.paperSize = ws.PAPERSIZE_A3 if a3 else ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    if title_rows: ws.print_title_rows = title_rows
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.page_margins.top = ws.page_margins.bottom = 0.6
    ws.oddFooter.left.text = "TBA Office · Bürovorlage LPH 3 · Muster"
    ws.oddFooter.center.text = "&A"
    ws.oddFooter.right.text = "Seite &P von &N"
    ws.sheet_view.showGridLines = False


def lists_sheet(wb, lists):
    """Blatt «Listen»: eine Spalte je Auswahlliste. Gibt {name: '=Listen!$X$2:$X$n'} zurück."""
    ws = wb.create_sheet("Listen")
    title(ws, "Listen · Auswahlwerte", "Hier lassen sich die Auswahlwerte der Mappe anpassen. Neue Werte unten anfügen; die Bereiche reichen bis Zeile 40.", 1)
    refs = {}
    for i, (name, values) in enumerate(lists.items(), start=1):
        col = get_column_letter(i)
        put(ws, f"{col}4", name, font=F_HEAD, fill=FILL_HEAD)
        for j, v in enumerate(values, start=5):
            put(ws, f"{col}{j}", v, font=F_BODY)
        ws.column_dimensions[col].width = max(14, min(34, max(len(str(v)) for v in values + [name]) + 2))
        refs[name] = f"=Listen!${col}$5:${col}$40"
    ws.freeze_panes = "A5"
    page(ws, "4:4")
    return refs


def quellen_rows(ws, start, ids=None):
    put(ws, f"B{start}", "Quellen (abgerufen am 20.11.2026)", font=F_SEC, border=False, align=Alignment())
    r = start + 1
    for q in Q["quellen"]:
        if ids and q["id"] not in ids: continue
        put(ws, f"B{r}", q["id"], font=F_BOLD)
        put(ws, f"C{r}", q["titel"])
        c = put(ws, f"D{r}", q["url"], font=Font(name=ARIAL, size=9, color="1F5FA8", underline="single"))
        c.hyperlink = q["url"]
        r += 1
    put(ws, f"B{r+1}", Q["hinweis"], font=F_SUB, border=False)
    ws.merge_cells(f"B{r+1}:D{r+1}")
    ws.row_dimensions[r + 1].height = 36
    return r + 2


# ════════════════════════════════════════════════════════════ Koordination
def koordination():
    wb = Workbook()
    anl = wb.active; anl.title = "Anleitung"
    prj = wb.create_sheet("Projekt")
    fpb = wb.create_sheet("Fachplanerbedarf")
    ssm = wb.create_sheet("Schnittstellen")
    frl = wb.create_sheet("Fragenliste")
    eng = wb.create_sheet("Eingang")
    kla = wb.create_sheet("Klärungsliste")
    ent = wb.create_sheet("Entscheidungen")
    L = lists_sheet(wb, {
        "Zuständigkeit": ["V", "G", "B", "K", "M", "F", "?", "G/K", "K/G", "G/F", "M/F", "V/F", "–"],
        "ja/nein": ["ja", "nein"],
        "ja/nein/prüfen": ["ja", "nein", "prüfen"],
        "Beauftragt": ["ja", "nein", "angefragt"],
        "Status Fachplaner": ["offen", "angefragt", "Angebot liegt vor", "empfohlen", "beauftragt", "entfällt"],
        "Status Schnittstelle": ["v0 Vorschlag", "offen – Kick-off", "v1 abgestimmt", "geändert"],
        "Status Frage": ["offen", "beantwortet", "Termin vereinbart", "entfällt"],
        "Status Klärung": ["offen", "in Klärung", "gelöst", "Vorbehalt", "Entscheidungspunkt", "entfällt"],
        "Status Entscheidung": ["vorbereitet", "vorgelegt", "entschieden", "vertagt", "entfällt"],
        "Disziplin": ["ALLE", "ARCH", "TWP", "HLS", "ELT", "BPH", "BRS", "GEO", "VER", "FRA", "AUF", "AG", "BEH"],
        "Wer fragt": ["Architektur → Fachplanung", "Fachplanung → Architektur"],
        "Runde": ["01", "02", "03"],
        "Bestätigung": ["stimmt überein", "Vorbehalt", "ausstehend"],
        "DIN 276": ["2018-12", "2008-12"],
        "Gliederungstiefe": ["2. Ebene", "3. Ebene"],
        "Auftraggeber": ["privat", "öffentlich"],
        "Neubau/Bestand": ["Neubau", "Bestand"],
        "Projektgröße": ["klein", "mittel", "groß"],
    })
    MS = "=Projekt!$A$33:$A$46"
    global PROJEKT
    PROJEKT = '="Projekt: "&IF(Projekt!C5="","(Blatt Projekt ausfüllen)",Projekt!C5)'

    def ms_date(ref):
        return (f'=IF({ref}="","",IFERROR(IF(INDEX(Projekt!$C$33:$C$46,MATCH({ref},Projekt!$A$33:$A$46,0))="","Datum fehlt",'
                f'INDEX(Projekt!$C$33:$C$46,MATCH({ref},Projekt!$A$33:$A$46,0))),"Meilenstein?"))')

    # ───────── Projekt
    ws = prj
    title(ws, "Projekt · Parameter und Termine", "Zuerst ausfüllen. Die anderen Blätter lesen hier Gebäudeklasse, Termine und Projektname. Gelb = Eingabe, grau = Formel.", 4)
    header(ws, 4, ["Code", "Feld", "Wert", "Wirkung · Hinweis · Quelle"], [9, 40, 46, 84])
    felder = [
        ("–", "Projekt", None, "Kurzname wie im Office."),
        ("–", "Projektnummer", None, ""),
        ("–", "Auftraggeber", None, "Firma oder Name. Ansprechpartner mit Rolle im Blatt Fachplanerbedarf bzw. im Projekt des Office."),
        ("P-AGT", "Art des Auftraggebers", "Auftraggeber", PARAM["P-AGT"]["effect"]),
        ("–", "Ort / Grundstück", None, ""),
        ("–", "Nutzung", None, "z. B. Wohnen, Büro, Mischnutzung"),
        ("P-BES", "Neubau oder Bestand", "Neubau/Bestand", PARAM["P-BES"]["effect"]),
        ("P-GKL", "Gebäudeklasse (1 bis 5)", "GK", "Art. 2 Abs. 3 BayBO. GK 1: freistehend, Höhe bis 7 m, höchstens zwei Nutzungseinheiten mit zusammen bis 400 m². GK 2: nicht freistehend, sonst wie GK 1. GK 3: sonstige Gebäude bis 7 m. GK 4: bis 13 m, Nutzungseinheiten je bis 400 m². GK 5: sonstige Gebäude, auch unterirdische. Höhe = Fußboden des höchsten Geschosses mit möglichem Aufenthaltsraum über mittlerer Geländeoberfläche."),
        ("P-GKL", "Sonderbau", "ja/nein", "Katalog in Art. 2 Abs. 4 BayBO. " + PARAM["P-GKL"]["effect"]),
        ("–", "Wohngebäude", "ja/nein", "Für die Ausnahme von der Prüfpflicht des Standsicherheitsnachweises (Art. 62a Abs. 2 BayBO)."),
        ("–", "Mittel- oder Großgarage", "ja/nein", "Für die Prüfpflicht des Brandschutznachweises (Art. 62b Abs. 2 BayBO)."),
        ("P-FPL", "Fachplaner bei Phasenbeginn beauftragt", "ja/nein", PARAM["P-FPL"]["effect"]),
        ("P-DIS", "Beteiligte Disziplinen", None, "z. B. TWP, HLS, ELT, BPH, BRS. " + PARAM["P-DIS"]["effect"]),
        ("P-KOT", "DIN 276: Fassung für die Kostenberechnung", "DIN 276", "Für das Honorar gilt DIN 276-1:2008-12 (HOAI § 4 Abs. 1); DIN 276:2018-12 gilt nicht automatisch (DAB 01/2019). Für die Kostenberechnung als Leistung die Fassung vertraglich festlegen (L3.PSV.1-04)."),
        ("P-KOT", "Gliederungstiefe der Kostenberechnung", "Gliederungstiefe", PARAM["P-KOT"]["effect"] + " Mindesttiefe siehe Zeile 29."),
        ("P-THE", "Aktive Themenpakete", None, "z. B. BAD, TRE, FAS, LIC, BOD. " + PARAM["P-THE"]["effect"]),
        ("P-MUS", "Physische Muster / Mustermappe vereinbart", "ja/nein", PARAM["P-MUS"]["effect"]),
        ("P-GRO", "Projektgröße", "Projektgröße", PARAM["P-GRO"]["effect"]),
        ("–", "Beschäftigte mehrerer Arbeitgeber auf der Baustelle zu erwarten", "ja/nein", "Für die Pflicht des Bauherrn, einen Koordinator nach § 3 BaustellV zu bestellen."),
    ]
    for i, (code, feld, liste, hinweis) in enumerate(felder, start=5):
        put(ws, f"A{i}", code, font=F_BOLD)
        put(ws, f"B{i}", feld)
        put(ws, f"C{i}", None, fill=FILL_IN)
        put(ws, f"D{i}", hinweis, font=F_SUB)
        if liste == "GK":
            dv = DataValidation(type="whole", operator="between", formula1="1", formula2="5", allow_blank=True)
            dv.error = "Gebäudeklasse 1 bis 5 als Zahl"; ws.add_data_validation(dv); dv.add(f"C{i}")
        elif liste:
            dv_list(ws, L[liste], f"C{i}", strict=True)
    ws.row_dimensions[12].height = 62
    section(ws, 25, "Abgeleitet – nicht ausfüllen", 4)
    abgeleitet = [
        ("Standsicherheitsnachweis",
         '=IF(OR(C12="",C13=""),"Gebäudeklasse und Sonderbau eintragen",IF(AND(C14="ja",C12<=2),"Keine Bescheinigung oder Prüfung erforderlich (Wohngebäude GK 1–2, Art. 62a Abs. 2 BayBO)",'
         'IF(C12>=4,IF(C13="ja","Prüfung durch Bauaufsichtsbehörde, Prüfingenieur oder Prüfamt; Nachweis mit dem Bauantrag","Bescheinigung durch Prüfsachverständigen; Vorlage mit der Baubeginnsanzeige"),'
         '"Kriterienkatalog (Anlage 2 BauVorlV) prüfen: sind nicht alle Kriterien erfüllt, "&IF(C13="ja","Prüfung durch Bauaufsichtsbehörde, Prüfingenieur oder Prüfamt","Bescheinigung durch Prüfsachverständigen"))))',
         "Art. 62a Abs. 2 BayBO; StMB, Bautechnische Nachweise (25.11.2024). Prüfzeiten sind im Terminplan Wartezeit. Sonderfälle (z. B. kleine eingeschossige Gebäude, Typenprüfung) im Einzelfall prüfen."),
        ("Brandschutznachweis",
         '=IF(OR(C12="",C13="",C15=""),"Gebäudeklasse, Sonderbau und Garage eintragen",IF(OR(C13="ja",C15="ja",C12=5),"Bescheinigung durch Prüfsachverständigen für Brandschutz oder bauaufsichtliche Prüfung – Wahl des Bauherrn im Bauantrag",'
         'IF(C12=4,"Keine Prüfung; der Nachweisersteller bestätigt mit der Anzeige der Nutzungsaufnahme, dass die Ausführung dem Nachweis entspricht","Keine Prüfung")))',
         "Art. 62b Abs. 2 BayBO; Art. 78 Abs. 2 BayBO; StMB, Bautechnische Nachweise. Schall- und Wärmeschutz werden im Genehmigungsverfahren nicht geprüft (LHM)."),
        ("Koordinator nach BaustellV",
         '=IF(C23="","Angabe in Zeile 23 eintragen",IF(C23="ja","Der Bauherr bestellt einen Koordinator – schon für die Planung der Ausführung (SiGe-Plan, Unterlage für spätere Arbeiten). Hinweis an den Auftraggeber geben.","Kein Koordinator erforderlich, solange nur Beschäftigte eines Arbeitgebers tätig werden"))',
         "§ 3 BaustellV. Der Bauherr bleibt verantwortlich, auch wenn er einen Koordinator beauftragt."),
        ("Kostenberechnung: Mindesttiefe",
         '=IF(C18="2018-12","Mindestens 3. Ebene (DIN 276:2018-12)"&IF(C19="2. Ebene"," – gewählte Tiefe liegt darunter",""),IF(C18="2008-12","Mindestens 2. Ebene (DIN 276-1:2008-12)","Fassung in Zeile 18 eintragen"))&". Technische Ausrüstung: 3. Ebene."',
         "ByAK-Merkblatt M01 (01/2021); DAB 01/2019; HOAI Anlage 15 LPH 3 f) „Kostenberechnung nach DIN 276 (3. Ebene)“."),
    ]
    for i, (feld, formel, hinweis) in enumerate(abgeleitet, start=26):
        put(ws, f"A{i}", "–", font=F_BOLD)
        put(ws, f"B{i}", feld, font=F_BOLD)
        put(ws, f"C{i}", formel, fill=FILL_CALC)
        put(ws, f"D{i}", hinweis, font=F_SUB)
        ws.row_dimensions[i].height = 60
    section(ws, 31, "Termine · Meilensteine des Terminplans (aus dem Terminplan des Projekts übernehmen)", 4)
    put(ws, "A32", "Code", font=F_HEAD, fill=FILL_HEAD); put(ws, "B32", "Meilenstein", font=F_HEAD, fill=FILL_HEAD)
    put(ws, "C32", "Datum", font=F_HEAD, fill=FILL_HEAD); put(ws, "D32", "Aufgabe im Planner · Bezug", font=F_HEAD, fill=FILL_HEAD)
    meilensteine = [
        ("M00", "Projektauftakt mit Auftraggeber", "L3.PSV.1"),
        ("M00A", "Erforderliche Fachplaner beauftragt", "L3.FPB.1 (Beauftragung ist Sache des Auftraggebers)"),
        ("M01", "Vorläufige Planungsgrundlagen an beauftragte Fachplaner übermittelt", "L3.A1.AUS"),
        ("M02", "Kick-off Fachplaner", "L3.A1.ABS"),
        ("M03", "Zieltermin Fachplanungsbeiträge Arbeitsstand 01", "L3.KLA.1"),
        ("M04", "Entscheidungspunkte an Auftraggeber bereitstellen", "L3.A3.AUS"),
        ("M05", "Entscheidungsbesprechung Auftraggeber · Arbeitsstand 02", "L3.A3.ABS"),
        ("M06", "Abstimmung Entwurfsstand LPH 3 mit Auftraggeber abgeschlossen", "Abgabe A5"),
        ("M07", "Abgestimmte Beiträge der beauftragten Fachplaner bereitgestellt", "L3.KLA.3"),
        ("M08", "Kostenbesprechung · Kostenberechnung mit Kostenschätzung vergleichen", "L3.KOB.1"),
        ("M08A", "Kostenentscheidung und Budgetabgleich dokumentiert", "L3.A6.ABS"),
        ("M09", "Interne Abgabe und Abschlussprüfung LPH 3", "Abgabe A7"),
        ("M10", "Abschlussbesprechung · Ergebnisse LPH 3 übergeben und erläutern", "L3.A7.AUS"),
        ("M11", "Freigabe LPH 3 durch Auftraggeber (vorläufig)", "L3.A7.ABS"),
    ]
    for i, (code, name, bezug) in enumerate(meilensteine, start=33):
        put(ws, f"A{i}", code, font=F_BOLD); put(ws, f"B{i}", name)
        put(ws, f"C{i}", None, fill=FILL_IN, fmt=DATE); put(ws, f"D{i}", bezug, font=F_SUB)
    dv_date(ws, "C33:C46")
    put(ws, "B47", "Meilensteine nach Muster-Terminplan LPH 3 v1.6. Termine des Musters sind Orientierungswerte, keine Vertragsfristen.", font=F_SUB, border=False)
    ws.freeze_panes = "A5"
    page(ws, "4:4", landscape=True)

    # ───────── Fachplanerbedarf (L3.FPB.1)
    ws = fpb
    title(ws, "Fachplanerbedarf und Beauftragungsempfehlung",
          "L3.FPB.1 · Entscheidungshilfe für den Auftraggeber · Prüfpunkte L3.FPB.1-01 bis -06 · entfällt, wenn alle Fachplaner bei Phasenbeginn beauftragt sind (P-FPL = ja)", 16)
    put(ws, "A3", PROJEKT, font=F_BOLD, border=False)
    put(ws, "E3", '="Erforderlich, noch nicht beauftragt: "&COUNTIFS(F7:F24,"ja",H7:H24,"<>ja")', font=F_BOLD, border=False)
    put(ws, "G3", "Stand:", font=F_BOLD, border=False, align=Alignment(horizontal="right", vertical="top")); put(ws, "H3", None, fill=FILL_IN, fmt=DATE)
    heads = ["Nr", "Disziplin", "Kürzel", "Leistungsbild · Grundlage", "In der Regel erforderlich, wenn …", "erforderlich?",
             "Begründung (für das Projekt)", "beauftragt?", "Büro · Ansprechpartner (Firma, Rolle)", "beauftragte Leistungsphasen",
             "Umfang LPH 3 und Besondere Leistungen (Vorschlag)", "Abgrenzung: Lücken, Doppelungen", "Angebot vom",
             "Bewertung · Empfehlung des Büros", "Entscheidung AG bis", "Status"]
    header(ws, 6, heads, [5, 22, 7, 30, 38, 10, 28, 10, 26, 12, 40, 28, 11, 30, 12, 13], height=42)
    fp = [
        ("Tragwerksplanung", "TWP", "HOAI §§ 49–52, Anlage 14",
         '="Bei Neubau und Eingriffen ins Tragwerk praktisch immer. Nachweis: "&Projekt!$C$26',
         "LPH 1–6; LPH 3 a)–i) einschließlich Mitwirken bei Kostenberechnung und Terminplanung (g), überschlägige Mengen (d). Besondere Leistungen nach Bedarf: vorgezogene prüfbare Berechnung, Erdbebennachweis, Mehraufwand Sonderkonstruktionen."),
        ("TGA · Heizung, Lüftung, Sanitär", "HLS", "HOAI §§ 53–56, Anlage 15, Anlagengruppen 1–3",
         "Bei jedem Neubau mit mehr als einfachen Standardanlagen; immer bei Lüftungsanlagen, Sonderbauten, Förderauflagen.",
         "LPH 1–9; LPH 3 a)–h) mit Kostenberechnung nach DIN 276 (3. Ebene) und Terminplanung (f), Durchführungen und Lastangaben für das Tragwerk (d)."),
        ("TGA · Elektro, Fernmelde- und IT", "ELT", "HOAI Anlage 15, Anlagengruppen 4, 5 (ggf. 8 Gebäudeautomation)",
         "Wie HLS; Sicherheitsanlagen (Brandmeldeanlage, Sicherheitsbeleuchtung) bei Sonderbauten.",
         "LPH 1–9; LPH 3 wie HLS. Abgrenzung Lichtplanung und Gebäudeautomation klären."),
        ("TGA · Förderanlagen (Aufzug)", "AUF", "HOAI Anlage 15, Anlagengruppe 6; BayBO Art. 37",
         "Wenn ein Aufzug vorgesehen oder nach Art. 37 BayBO erforderlich ist.",
         "Oft bei HLS oder ELT mitbeauftragt – Zuständigkeit ausdrücklich festlegen."),
        ("Bauphysik", "BPH", "HOAI Anlage 1 Nr. 1.2 (Wärmeschutz und Energiebilanzierung, Bauakustik, Raumakustik)",
         "GEG-Nachweis bei jedem Neubau; Schallschutz bei Wohnen, Mischnutzung und Außenlärm; Raumakustik bei Versammlungs- und Büroräumen.",
         "LPH 1–7 (ab LPH 2 als Mitwirkung); LPH 3 a)–d): Rechenmodelle und Kennwerte fortschreiben, Bauteile bemessen (Bauteilkatalog, L3.BTK.1), Erläuterungsbericht. Besondere Leistung: Simulationen."),
        ("Brandschutz", "BRS", "Kein Leistungsbild der HOAI; Umfang vertraglich (z. B. nach AHO-Heft 17); Nachweis Art. 62b BayBO",
         '="Sonderbau, GK 5, Mittel- oder Großgarage: Nachweis wird geprüft oder bescheinigt. Sonst kann die Objektplanung den Nachweis als Bauvorlageberechtigte erstellen. Dieses Projekt: "&Projekt!$C$27',
         "Brandschutzkonzept ab LPH 2/3 (Vorgänge t018, t032); Mitwirkung LPH 4, 5 und 8 nach Vertrag."),
        ("Geotechnik", "GEO", "HOAI Anlage 1 Nr. 1.3 (Geotechnischer Bericht)",
         "Immer, wenn Gründung, Baugrube, Grundwasser oder Versickerung nicht gesichert bekannt sind.",
         "Teilleistungen a)–c) vor der Tragwerkslösung: Erkundung, Baugrundbeschreibung, Gründungsempfehlung mit Bodenkennwerten."),
        ("Ingenieurvermessung", "VER", "HOAI Anlage 1 Nr. 1.4",
         "Lage- und Höhenplan als Planungsgrundlage; Lageplan für den Bauantrag (BauVorlV).",
         "Planungsbegleitende Vermessung vor LPH 3; Bauvermessung später."),
        ("Freianlagen", "FRA", "HOAI §§ 38–40, Anlage 11",
         "Wenn Außenanlagen gestaltet werden, Freiflächengestaltungssatzung oder Baumschutz gelten.",
         "LPH 1–9; LPH 3 mit Kostenberechnung KG 500."),
        ("Prüfsachverständige · Prüfingenieur", "PRÜF", "BayBO Art. 62a, 62b; Beauftragung durch den Bauherrn (Prüfingenieur bei Sonderbau durch die Bauaufsicht)",
         '="Standsicherheit: "&Projekt!$C$26&" · Brandschutz: "&Projekt!$C$27',
         "Keine Planungsleistung. Prüfzeiten als Wartezeit in den Terminplan; Kosten KG 700."),
        ("Koordinator SiGeKo", "SIG", "§ 3 BaustellV (Pflicht des Bauherrn)",
         "=Projekt!$C$28",
         "Hinweis an den Auftraggeber; SiGe-Plan und Unterlage für spätere Arbeiten schon in der Planung der Ausführung."),
        ("Weitere (z. B. Lichtplanung, Akustik, Küche, Fassade, Schadstoffe im Bestand)", "–", "nach Thema", "nach Bedarf", ""),
    ]
    r = 7
    for i, (dis, kz, lb, wann, umfang) in enumerate(fp, start=1):
        put(ws, f"A{r}", i, align=WRAPC); put(ws, f"B{r}", dis, font=F_BOLD); put(ws, f"C{r}", kz, font=F_BOLD)
        put(ws, f"D{r}", lb, font=F_SUB)
        put(ws, f"E{r}", wann, font=F_BODY, fill=FILL_CALC if str(wann).startswith("=") else None)
        for col in "FGHIJLMN": put(ws, f"{col}{r}", None, fill=FILL_IN)
        put(ws, f"K{r}", umfang, font=F_PROP)
        put(ws, f"O{r}", '=IF(Projekt!$C$34="","",Projekt!$C$34)', fill=FILL_CALC, fmt=DATE)
        put(ws, f"P{r}", "offen", font=F_PROP, fill=FILL_IN)
        ws.row_dimensions[r].height = 64
        r += 1
    for _ in range(6):  # Reserve
        put(ws, f"A{r}", r - 6, align=WRAPC)
        for col in "BCDEFGHIJKLMNP": put(ws, f"{col}{r}", None, fill=FILL_IN)
        put(ws, f"O{r}", None, fill=FILL_IN, fmt=DATE)
        r += 1
    last = r - 1
    dv_list(ws, L["ja/nein/prüfen"], f"F7:F{last}", strict=True)
    dv_list(ws, L["Beauftragt"], f"H7:H{last}", strict=True)
    dv_list(ws, L["Status Fachplaner"], f"P7:P{last}")
    dv_date(ws, [f"M7:M{last}", f"O7:O{last}"])
    for col in "MO":
        for rr in range(7, last + 1): ws[f"{col}{rr}"].number_format = DATE
    put(ws, f"B{last+2}", "Spalte O schlägt den Meilenstein M00A (Blatt Projekt) als Entscheidungstermin vor; die Karte fordert die Entscheidung bis zum Kick-off an (L3.FPB.1-06). Die Beauftragung ist Sache des Auftraggebers.", font=F_SUB, border=False)
    ws.auto_filter.ref = f"A6:P{last}"
    ws.freeze_panes = "C7"
    ws.conditional_formatting.add(f"F7:F{last}", FormulaRule(formula=['AND(F7="ja",H7<>"ja")'], fill=PatternFill("solid", fgColor="FCE4CC")))
    page(ws, "6:6", a3=True)

    # ───────── Schnittstellen (L3.SSM.1 / SSM.2)
    ws = ssm
    title(ws, "Schnittstellen- und Liefermatrix",
          "L3.SSM.1 (v0, Vorschlag des Büros, mit dem Paket M01) · L3.A1.ABS (v1, im Kick-off M02 abgestimmt) · Legende V G B K M F nach ByAK-Muster-Schnittstellenkatalog (M13)", 25)
    put(ws, "A3", PROJEKT, font=F_BOLD, border=False)
    RIGHT = Alignment(horizontal="right", vertical="top")
    put(ws, "P3", "Version (v0 / v1):", font=F_BOLD, border=False, align=RIGHT); put(ws, "Q3", "v0", font=F_PROP, fill=FILL_IN)
    put(ws, "R3", "Stand:", font=F_BOLD, border=False, align=RIGHT); put(ws, "S3", None, fill=FILL_IN, fmt=DATE)
    put(ws, "A4", "V Verantwortung · G plant (Grundleistung) · B plant (Besondere Leistung) · K koordiniert und integriert · M wirkt mit · F liefert Angaben / legt Anforderungen fest · ? offen – im Kick-off klären",
        font=F_SUB, border=False)
    heads = ["Nr", "Thema · Bauteil", "KG DIN 276 (2018-12)", "AG", "Behörde · Prüfung", "ARCH", "TWP", "HLS", "ELT", "BPH", "BRS", "GEO", "VER", "FRA",
             "Zuständigkeit eindeutig?", "Was wird geliefert", "Format", "Lieferung 1", "Datum", "Lieferung 2", "Datum", "Wird gebraucht für",
             "Grundlage", "Status", "Bemerkung · Klärung"]
    header(ws, 6, heads, [5, 30, 12, 5.5, 8, 6, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 16, 34, 16, 9, 11, 9, 11, 28, 26, 13, 30], height=40)
    for c in range(4, 15):
        ws.cell(row=6, column=c).alignment = Alignment(text_rotation=90, horizontal="center", vertical="bottom", wrap_text=True)
    ws.row_dimensions[6].height = 78
    D = ["AG", "BEH", "ARCH", "TWP", "HLS", "ELT", "BPH", "BRS", "GEO", "VER", "FRA"]
    S = [
        ("A · Grundlagen", None),
        ("Vermessung: Lage- und Höhenplan", dict(kg="–", c=dict(AG="V", ARCH="K", VER="G", FRA="M"), was="Grenzen, Bestand, Bäume, Leitungen, Höhen in m ü. NHN", fmt="DWG und PDF", l1="M00", l2="", fuer="Lageplan, Höhen, Abstandsflächen, Entwässerung", grund="HOAI Anl. 1 Nr. 1.4; L3.PSV.1-05", bem="Bereitstellung durch den Auftraggeber (Mitwirkung).")),
        ("Baugrund und Grundwasser", dict(kg="310, 320", c=dict(AG="V", ARCH="K", TWP="F", HLS="M", GEO="G"), was="Geotechnischer Bericht: Bodenkennwerte, Gründungsempfehlung, Bemessungswasserstand, Versickerung, Baugrube", fmt="PDF", l1="M00", l2="", fuer="Gründung, Untergeschoss, Entwässerung, Kosten KG 300", grund="HOAI Anl. 1 Nr. 1.3; L3.PSV.1-05", bem="TWP legt fest, welche Angaben die Gründung braucht.")),
        ("Bestand, Bebauungsplan, Satzungen, Raumprogramm", dict(kg="–", c=dict(AG="V", BEH="F", ARCH="K"), was="Bestandsunterlagen, B-Plan und örtliche Satzungen, Raumprogramm mit Nutzungen", fmt="PDF", l1="M00", l2="", fuer="Entwurf, Genehmigungsfähigkeit, Flächenaufstellung", grund="L3.PSV.1-05", bem="")),
        ("B · Themen und Bauteile – je Thema genau eine planende Stelle (L3.SSM.1-03)", None),
        ("Gründung und Tragwerk: Tragsystem, Achsraster, Spannweiten, Aussteifung", dict(kg="320; 330–360", chk=True, c=dict(ARCH="K", TWP="G", HLS="M", BPH="M", BRS="F", GEO="F"), was="Tragwerkslösung, Hauptabmessungen, Bauteildicken, überschlägige Bemessung", fmt="Pläne PDF und DWG, Kurzbericht", l1="M03", l2="M07", fuer="Grundrisse und Schnitte Stand 02, Bauteilkatalog, Kostenberechnung KG 300", grund="HOAI Anl. 14 LPH 3 a)–c); L3.KLA.1-02", bem="Prüfpflicht des Standsicherheitsnachweises: Blatt Projekt.")),
        ("Schächte und Trassen HLS", dict(kg="410–430", chk=True, c=dict(ARCH="K", TWP="M", HLS="G", BRS="F"), was="Lage und Größe der Schächte und Haupttrassen", fmt="Eintrag in Architekturplan", l1="M03", l2="M07", fuer="Grundrisse, Deckenöffnungen, Abschottungen", grund="HOAI Anl. 15 LPH 3 c); BayBO Art. 38", bem="")),
        ("Schächte und Trassen ELT und IT", dict(kg="440–450", chk=True, c=dict(ARCH="K", TWP="M", ELT="G", BRS="F"), was="Lage und Größe der Steigtrassen und Haupttrassen", fmt="Eintrag in Architekturplan", l1="M03", l2="M07", fuer="Grundrisse, Deckenöffnungen, Abschottungen", grund="HOAI Anl. 15 LPH 3 c); BayBO Art. 38", bem="")),
        ("Technikflächen HLS: Heizung, Lüftung, Hausanschluss Wasser", dict(kg="410–430", chk=True, c=dict(AG="F", ARCH="K", TWP="M", HLS="G", BPH="M", BRS="F"), was="Raumbedarf, Lage, lichte Höhe, Einbringweg, Lasten", fmt="Raumbedarfsliste, Skizze", l1="M03", l2="M07", fuer="Grundrisse, Flächenaufstellung, Tragwerk, Kosten", grund="HOAI Anl. 15 LPH 3 c)", bem="")),
        ("Technikflächen ELT und IT: Hausanschluss, Verteilung, IT", dict(kg="440–450", chk=True, c=dict(AG="F", ARCH="K", TWP="M", ELT="G", BRS="F"), was="Raumbedarf, Lage, Zugang, Lasten", fmt="Raumbedarfsliste, Skizze", l1="M03", l2="M07", fuer="Grundrisse, Flächenaufstellung, Kosten", grund="HOAI Anl. 15 LPH 3 c)", bem="")),
        ("Durchführungen und Lastangaben der Technik (Grundsatz)", dict(kg="340, 350; 400", chk=True, c=dict(ARCH="K", TWP="G", HLS="F", ELT="F"), was="Wesentliche Durchführungen und Lasten – ohne Schlitz- und Durchbruchsplanung", fmt="Liste und Skizze", l1="M03", l2="M07", fuer="Tragwerksbemessung, Kostenberechnung", grund="HOAI Anl. 15 LPH 3 d); L3.KLA.1-06, L3.KLA.2-04", bem="Schlitz- und Durchbruchsplanung folgt in der LPH 5.")),
        ("Brandschutz: Brandabschnitte, Rettungswege, Bauteilanforderungen", dict(kg="330–360; 450", chk=True, c=dict(BEH="F", ARCH="K", TWP="M", HLS="M", ELT="M", BPH="M", BRS="G"), was="Brandschutzkonzept (Entwurf): Einstufung, Brandabschnitte, Rettungswege, Anforderungen an Bauteile und Anlagen", fmt="Bericht und Pläne PDF", l1="M03", l2="M07", fuer="Grundrisse, Bauteilkatalog, Genehmigungsfähigkeit (L3.GEN.1)", grund="BayBO Art. 62b; L3.KLA.1-05", bem="Ohne Brandschutzplanung ist die Objektplanung Ersteller (G).")),
        ("Wärmeschutz und Energiekonzept (GEG)", dict(kg="330, 360; 420, 430", chk=True, c=dict(AG="F", ARCH="K", HLS="M", BPH="G"), was="Rechenmodell, Kennwerte, Nachweisstrategie GEG, sommerlicher Wärmeschutz", fmt="Bauteilkatalog, Kurzbericht", l1="M03", l2="M07", fuer="Bauteilkatalog, Fenster und Sonnenschutz, Objektbeschreibung", grund="HOAI Anl. 1 Nr. 1.2.2 LPH 3 a), c); L3.BTK.1", bem="Den energetischen Zielstandard legt der Auftraggeber fest.")),
        ("Schallschutz und Raumakustik", dict(kg="340, 350", chk=True, c=dict(AG="F", ARCH="K", TWP="M", HLS="M", BPH="G"), was="Anforderungsniveau, Bauteilnachweise, raumakustische Maßnahmen", fmt="Bauteilkatalog, Kurzbericht", l1="M03", l2="M07", fuer="Wand- und Deckenaufbauten, Kosten", grund="HOAI Anl. 1 Nr. 1.2; L3.KLA.1-04", bem="Das Schallschutzniveau entscheidet der Auftraggeber (Blatt Entscheidungen).")),
        ("Fassade und Gebäudehülle", dict(kg="330, 360", chk=True, c=dict(ARCH="G/K", TWP="M", ELT="M", BPH="F", BRS="F"), was="Prinzipschnitt, Aufbauten, Öffnungen, Sonnenschutz, Leitdetails", fmt="Plan PDF 1:20", l1="M03", l2="M07", fuer="Ansichten, Bauteilkatalog, Bemusterung (L3.FAS.1)", grund="HOAI Anl. 10 LPH 3 a); L3.BTK.1-05", bem="")),
        ("Dach und Dachaufbauten", dict(kg="360; 440", chk=True, c=dict(ARCH="G/K", TWP="M", HLS="F", ELT="F", BPH="F", BRS="F"), was="Dachaufbau, Lage und Größe der Dachaufbauten, Photovoltaik, Dachentwässerung", fmt="Dachaufsicht PDF", l1="M03", l2="M07", fuer="Schnitte, Ansichten, Genehmigungsfähigkeit", grund="L3.KLA.1-03", bem="")),
        ("Aufzug und Förderanlagen", dict(kg="460", chk=True, c=dict(ARCH="K", TWP="M", HLS="?", ELT="?", BRS="F"), was="Aufzugstyp, Schachtmaße, Unter- und Überfahrt, Antrieb", fmt="Datenblatt, Skizze", l1="M03", l2="M07", fuer="Grundrisse, Schnitte, Tragwerk, Kosten KG 460", grund="HOAI § 53 (Anlagengruppe 6); BayBO Art. 37", bem="Wer plant die Förderanlage? Im Kick-off festlegen.")),
        ("Entwässerung: Schmutz- und Regenwasser, Versickerung", dict(kg="410; 550", chk=True, c=dict(BEH="F", ARCH="K", HLS="G", GEO="F", VER="M", FRA="M"), was="Entwässerungskonzept: Grundleitungen, Anschlusspunkte, Versickerung oder Rückhaltung, Hebeanlage", fmt="Plan PDF und DWG", l1="M03", l2="M07", fuer="Lageplan, Untergeschoss, Genehmigung, Kosten", grund="HOAI Anl. 15 LPH 3 a), e); Entwässerungssatzung", bem="")),
        ("Hausanschlüsse Wasser, Abwasser, Wärme oder Gas", dict(kg="220, 230", chk=True, c=dict(AG="V", BEH="F", ARCH="K", HLS="G"), was="Anschlusspunkte, Leistungen, Trassen", fmt="Plan PDF", l1="M03", l2="M07", fuer="Lageplan, Technikflächen, Kosten KG 200", grund="HOAI Anl. 15 LPH 3 c)", bem="Anträge beim Versorger stellt der Auftraggeber.")),
        ("Hausanschlüsse Strom und Telekommunikation", dict(kg="220, 230", chk=True, c=dict(AG="V", BEH="F", ARCH="K", ELT="G"), was="Anschlusspunkte, Anschlussleistung, Trassen", fmt="Plan PDF", l1="M03", l2="M07", fuer="Lageplan, Technikflächen, Kosten KG 200", grund="HOAI Anl. 15 LPH 3 c)", bem="")),
        ("Anschlüsse Außenanlagen: Höhen, Zugänge, Stellplätze, Feuerwehrflächen", dict(kg="500", chk=True, c=dict(BEH="F", ARCH="K", HLS="M", BRS="F", VER="F", FRA="G"), was="Höhen an den Gebäudeanschlüssen, Zugänge, Flächen", fmt="Plan PDF und DWG", l1="M03", l2="M07", fuer="Lageplan, EG-Grundriss, Kosten KG 500", grund="HOAI Anl. 11; BayBO Art. 5", bem="Ohne Freianlagenplanung plant die Objektplanung (G).")),
        ("Elektro, Blitzschutz, Erdung, Sicherheitsbeleuchtung", dict(kg="440, 450", chk=True, c=dict(ARCH="K", TWP="M", ELT="G", BRS="F"), was="Konzept, Verteilungen, Sicherheitsanlagen, Fundamenterder", fmt="Schema, Kurzbericht", l1="M03", l2="M07", fuer="Technikflächen, Tragwerk, Brandschutz, Kosten", grund="HOAI Anl. 15 LPH 3 a)–c)", bem="")),
        ("Beleuchtung und Lichtkonzept", dict(kg="440", chk=True, c=dict(AG="F", ARCH="G", ELT="G"), was="Lichtkonzept, Leuchtenauswahl, Deckenspiegel", fmt="Plan PDF", l1="M03", l2="M07", fuer="Deckenspiegel, Bemusterung (L3.LIC.1)", grund="L3.LIC.1", bem="Zuständigkeit Lichtplanung / ELT / Architektur festlegen.")),
        ("C · Zuarbeit zu den Ergebnissen der Objektplanung (L3.SSM.1-04)", None),
        ("Objektbeschreibung und Erläuterungsbericht", dict(kg="–", c=dict(ARCH="G/K", TWP="M", HLS="M", ELT="M", BPH="M", BRS="M"), was="Textbeiträge je Disziplin", fmt="Text (DOCX)", l1="M07", l2="", fuer="Objektbeschreibung (L3.OBJ.2, L3.OBJ.3)", grund="HOAI Anl. 10 LPH 3 c); Anl. 14 LPH 3 e); Anl. 1 Nr. 1.2.2 LPH 3 d)", bem="")),
        ("Kostenberechnung: Kostenbeitrag je Disziplin", dict(kg="300–500", c=dict(AG="F", ARCH="G/K", TWP="M", HLS="G", ELT="G", FRA="G"), was="Kostenbeitrag in vereinbarter Gliederung und Tiefe, mit Preisstand", fmt="Tabelle (XLSX) nach DIN 276", l1="M07", l2="", fuer="Kostenberechnung (L3.KOB.1, M08)", grund="HOAI Anl. 10 LPH 3 e); Anl. 14 LPH 3 d), g); Anl. 15 LPH 3 f)", bem="Gliederung und Tiefe: Blatt Projekt.")),
        ("Terminplan: Lieferzusagen und Abhängigkeiten", dict(kg="–", c=dict(ARCH="G/K", TWP="M", HLS="M", ELT="M", BPH="M", BRS="M"), was="Eigene Termine und Abhängigkeiten", fmt="Terminliste", l1="M02", l2="", fuer="Terminplan LPH 3", grund="HOAI Anl. 10 LPH 3 f); Anl. 14 LPH 3 g); Anl. 15 LPH 3 f)", bem="")),
        ("Genehmigungsfähigkeit: Behördenabstimmung", dict(kg="–", c=dict(BEH="F", ARCH="G/K", TWP="M", HLS="M", ELT="M", BRS="M"), was="Fachliche Beiträge zur Vorabstimmung", fmt="Kurzbericht", l1="M07", l2="", fuer="Baurechts-Check (L3.GEN.1, L3.GEN.2)", grund="HOAI Anl. 10 LPH 3 d); Anl. 14 LPH 3 f); Anl. 15 LPH 3 e)", bem="")),
    ]
    r = 7; n = 0; chk_rows = []
    def ssm_row(r, n, name, d):
        put(ws, f"A{r}", n, align=WRAPC)
        put(ws, f"B{r}", name, font=F_BOLD if d else F_BODY, fill=None if d else FILL_IN)
        put(ws, f"C{r}", d["kg"] if d else None, font=F_PROP if d else F_BODY, fill=FILL_IN)
        for k, key in enumerate(D):
            col = get_column_letter(4 + k)
            put(ws, f"{col}{r}", (d["c"].get(key) if d else None), font=F_PROP, fill=FILL_IN, align=WRAPC)
        if d is None or d.get("chk"):
            rng = f"D{r}:N{r}"
            put(ws, f"O{r}",
                f'=IF(COUNTA({rng})=0,"",IF(SUMPRODUCT(LEN({rng})-LEN(SUBSTITUTE({rng},"?","")))>0,"offen – im Kick-off klären",'
                f'IF(SUMPRODUCT(LEN({rng})-LEN(SUBSTITUTE(UPPER({rng}),"G","")))+SUMPRODUCT(LEN({rng})-LEN(SUBSTITUTE(UPPER({rng}),"B","")))=1,"eindeutig",'
                f'IF(SUMPRODUCT(LEN({rng})-LEN(SUBSTITUTE(UPPER({rng}),"G","")))+SUMPRODUCT(LEN({rng})-LEN(SUBSTITUTE(UPPER({rng}),"B","")))=0,"keine planende Stelle","mehrere planende Stellen – abgrenzen"))))',
                fill=FILL_CALC)
            chk_rows.append(r)
        else:
            put(ws, f"O{r}", "–", font=F_SUB, fill=FILL_CALC, align=WRAPC)
        vals = dict(P=d and d["was"], Q=d and d["fmt"], R=d and d["l1"], T=d and d["l2"], V=d and d["fuer"], W=d and d["grund"], Y=d and d["bem"])
        for col, v in vals.items():
            put(ws, f"{col}{r}", v or None, font=F_PROP if col != "W" else F_SUB, fill=FILL_IN if col != "W" else None)
        put(ws, f"S{r}", ms_date(f"R{r}"), fill=FILL_CALC, fmt=DATE)
        put(ws, f"U{r}", ms_date(f"T{r}"), fill=FILL_CALC, fmt=DATE)
        put(ws, f"X{r}", "v0 Vorschlag" if d else None, font=F_PROP, fill=FILL_IN)
        ws.row_dimensions[r].height = 40
    for name, d in S:
        if d is None:
            if name.startswith("C ·"):
                for _ in range(4):  # Reserve für projektbezogene Themen (B)
                    n += 1; ssm_row(r, n, None, None); r += 1
            section(ws, r, name, 25); r += 1; continue
        n += 1; ssm_row(r, n, name, d); r += 1
    for _ in range(2):
        n += 1; ssm_row(r, n, None, None)
        put(ws, f"O{r}", "–", font=F_SUB, fill=FILL_CALC, align=WRAPC); chk_rows.remove(r); r += 1
    last = r - 1
    put(ws, "V3", f'="Offene oder doppelte Zuständigkeiten: "&(COUNTIF(O7:O{last},"offen*")+COUNTIF(O7:O{last},"mehrere*")+COUNTIF(O7:O{last},"keine*"))', font=F_BOLD, border=False)
    dv_list(ws, L["Zuständigkeit"], f"D7:N{last}", prompt="V G B K M F, ? = offen; Kombinationen wie G/K erlaubt")
    dv_list(ws, MS, [f"R7:R{last}", f"T7:T{last}"])
    dv_list(ws, L["Status Schnittstelle"], f"X7:X{last}")
    for col, color in [("?", "F8CBAD"), ("G", "D5E8D4"), ("B", "D5E8D4"), ("K", "DAE3F3"), ("F", "FFF2CC"), ("M", "EDEDED"), ("V", "E4D7F5")]:
        ws.conditional_formatting.add(f"D7:N{last}", FormulaRule(formula=[f'ISNUMBER(FIND("{col}",UPPER(D7)))'], fill=PatternFill("solid", fgColor=color), stopIfTrue=True))
    ws.conditional_formatting.add(f"O7:O{last}", FormulaRule(formula=['O7="eindeutig"'], font=Font(name=ARIAL, size=9, color="2E6B3F")))
    ws.conditional_formatting.add(f"O7:O{last}", FormulaRule(formula=['AND(O7<>"",O7<>"eindeutig",O7<>"–")'], fill=PatternFill("solid", fgColor="FCE4CC")))
    ws.auto_filter.ref = f"A6:Y{last}"
    ws.freeze_panes = "C7"
    page(ws, "6:6", a3=True)

    # ───────── Fragenliste (L3.PGF.1-06 / L3.A1.ABS-06)
    ws = frl
    title(ws, "Fragenliste je Disziplin · Rückfragenliste",
          "L3.PGF.1-06 (Fragen je Disziplin im Planungsgrundlagen-Paket, M01) · L3.A1.ABS-06 (Rückfragen im Kick-off beantwortet oder terminiert, M02). Fragen ohne Bezug zum Projekt auf «entfällt» setzen, nicht löschen.", 15)
    put(ws, "A3", PROJEKT, font=F_BOLD, border=False)
    put(ws, "E3", "Zum Versand an eine Fachplanung nach Spalte B filtern: ALLE und die Disziplin.", font=F_SUB, border=False)
    heads = ["Nr", "Disziplin", "Wer fragt", "Thema", "Frage · benötigte Angabe", "Wird gebraucht für", "Grundlage", "gebraucht bis", "Datum",
             "Antwort · Festlegung", "beantwortet von", "am", "Status", "übernommen in", "Bemerkung"]
    header(ws, 6, heads, [8, 8, 15, 15, 58, 30, 26, 9, 11, 40, 14, 11, 12, 18, 26], height=30)
    A, F = "Architektur → Fachplanung", "Fachplanung → Architektur"
    FR = [
        ("ALLE", A, "Grundlagen", "Welche Unterlagen oder Angaben fehlen Ihnen, um den Arbeitsstand 01 zu beginnen?", "Beginn der Fachplanungsbeiträge", "HOAI Anl. 10 LPH 3 b)", "M02"),
        ("ALLE", A, "Lieferumfang", "Welche Pläne, Schemata, Berechnungen und Texte liefern Sie zum Arbeitsstand 01 (M03) und zum abgestimmten Endstand (M07)?", "Eingangskontrolle, Terminplan", "L3.A1.ABS-03; HOAI Anl. 14 und 15 LPH 3", "M02"),
        ("ALLE", A, "Kostenbeitrag", "In welcher Gliederung liefern Sie den Kostenbeitrag – Kostengruppen, Gliederungstiefe, Preisstand – und bis wann?", "Kostenberechnung (L3.KOB.1)", "L3.A1.ABS-04; HOAI Anl. 14 LPH 3 g); Anl. 15 LPH 3 f)", "M02"),
        ("ALLE", A, "Abhängigkeiten", "Welche Ihrer Lieferungen hängen von Angaben anderer Fachplanungen ab, und bis wann brauchen Sie diese?", "Schnittstellenmatrix v1, Terminplan", "HOAI Anl. 15 LPH 3 d); L3.SSM.1", "M02"),
        ("ALLE", A, "Austausch", "Mit welchem Dateiformat, welchem Nullpunkt und welcher Layer- bzw. Modellstruktur arbeiten Sie?", "Austauschdateien (Planliste, Blatt Austausch)", "L3.PLI.1-06", "M02"),
        ("ALLE", A, "Behörden", "Welche Abstimmungen mit Behörden oder Versorgern sind aus Ihrer Sicht in der LPH 3 nötig?", "Genehmigungsfähigkeit (L3.GEN.1)", "HOAI Anl. 10 LPH 3 d); Anl. 14 LPH 3 f); Anl. 15 LPH 3 e)", "M03"),
        ("ALLE", A, "Leistungsumfang", "Halten Sie Besondere Leistungen für erforderlich, die nicht beauftragt sind? Wenn ja, welche und warum?", "Abgrenzung, Entscheidung des Auftraggebers", "L3.FPB.1-02, -04", "M02"),
        ("ALLE", A, "Annahmen", "Welche Annahmen treffen Sie, die wir oder der Auftraggeber bestätigen müssen?", "Klärungsliste, Entscheidungsvorlage", "L3.KLA.1-07, -08", "M03"),
        ("TWP", A, "Tragsystem", "Welches Tragsystem schlagen Sie vor (Bauweise, Achsraster, Spannrichtungen), und welche Varianten halten Sie für wirtschaftlich?", "Grundrisse und Schnitte Stand 02, Kostenberechnung", "HOAI Anl. 14 LPH 3 a)", "M03"),
        ("TWP", A, "Bauteildicken", "Welche Decken-, Wand- und Stützenabmessungen sollen wir vorläufig führen?", "Grundrisse, Schnitte, Bauteilkatalog", "HOAI Anl. 14 LPH 3 b), c)", "M03"),
        ("TWP", A, "Unterzüge", "Wo sind Unterzüge, Überzüge oder Abfangungen unvermeidbar, und mit welcher Höhe ist zu rechnen?", "Raumhöhen, Trassenführung der Technik", "HOAI Anl. 14 LPH 3 c); L3.KLA.1-02", "M03"),
        ("TWP", A, "Aussteifung", "Welche Wände oder Kerne steifen das Gebäude aus und dürfen deshalb nicht verschoben oder geöffnet werden?", "Grundrissentwicklung, Öffnungen", "HOAI Anl. 14 LPH 3 a), c)", "M03"),
        ("TWP", A, "Gründung", "Welche Gründung setzen Sie an, auf welchem Baugrundgutachten beruht sie, und was fehlt dazu?", "Untergeschoss, Kosten KG 320", "HOAI Anl. 14 LPH 3 a); Anl. 1 Nr. 1.3", "M03"),
        ("TWP", A, "Sonderkonstruktionen", "Welche Bereiche erfordern Sonderkonstruktionen (Auskragungen, große Spannweiten, Abfangungen), und welche Folgen haben sie für Kosten und Termine?", "Entscheidungsvorlage", "HOAI Anl. 14 LPH 3, Besondere Leistungen", "M03"),
        ("TWP", A, "Mengen", "Bis wann und in welcher Form liefern Sie die überschlägigen Mengen (Beton, Betonstahl, Stahl, Holz)?", "Mengenermittlung und Kostenberechnung KG 300", "HOAI Anl. 14 LPH 3 d), g)", "M07"),
        ("TWP", A, "Prüfung", "Muss der Standsicherheitsnachweis bescheinigt oder geprüft werden, und welche Unterlagen und Zeiten bedeutet das?", "Terminplan LPH 4 und 5, Kosten KG 700", "BayBO Art. 62a; Blatt Projekt", "M03"),
        ("TWP", A, "Feuerwiderstand", "Welche Feuerwiderstandsanforderungen beeinflussen die Bemessung (Bauteile, Bekleidungen)?", "Bauteilkatalog, Kosten", "BayBO Art. 24–30; Abstimmung mit BRS", "M03"),
        ("TWP", F, "Nutzlasten", "Nutzungen und Nutzlasten je Bereich, einschließlich Sonderlasten (Archiv, Technik, Dachbegrünung, Photovoltaik)", "Lastannahmen", "HOAI Anl. 14 LPH 3 a)", "M01"),
        ("TWP", F, "Aufbauten", "Regelaufbauten mit Aufbauhöhen und Flächenlasten (Aufbauvorgaben)", "Lastannahmen, Bemessung", "L3.BTK.1", "M01"),
        ("TWP", F, "Lasten der Technik", "Schwere Lasten und große Öffnungen der Technik (Zentralen, Speicher, Rückkühler, Aufzug) – über die Architektur von HLS und ELT", "Bemessung, Öffnungen", "HOAI Anl. 15 LPH 3 d)", "M03"),
        ("HLS", A, "Konzept", "Welches Versorgungskonzept setzen Sie an (Wärmeerzeugung, Energieträger, Lüftung), und welche Alternativen haben Sie geprüft?", "Objektbeschreibung, Technikflächen, GEG-Nachweis", "HOAI Anl. 15 LPH 3 a), b)", "M03"),
        ("HLS", A, "Technikflächen", "Welche Technikflächen brauchen Sie (Lage, Größe, lichte Höhe, Einbringöffnung, Zugang)?", "Grundrisse, Flächenaufstellung", "HOAI Anl. 15 LPH 3 c)", "M03"),
        ("HLS", A, "Schächte", "Wo und in welcher Größe sind Schächte und Haupttrassen anzunehmen?", "Grundrisse, Tragwerk, Brandschutz", "HOAI Anl. 15 LPH 3 c); BayBO Art. 38", "M03"),
        ("HLS", A, "Aufbauhöhen", "Welche Aufbauhöhen brauchen Sie in Decken und Böden (abgehängte Decken, Fußbodenheizung, Installationsebenen)?", "Geschosshöhen, Schnitte, Bauteilkatalog", "L3.KLA.1-03", "M03"),
        ("HLS", A, "Dach", "Welche Dachaufbauten und Außengeräte sind vorgesehen (Lage, Größe, Schall, Sichtbarkeit)?", "Dachaufsicht, Ansichten, Genehmigungsfähigkeit", "L3.KLA.1-03", "M03"),
        ("HLS", A, "Hausanschlüsse", "Welche Hausanschlüsse sind nötig, wo liegen sie, und welche Abstimmung mit den Versorgern steht an?", "Lageplan, Technikflächen, Kosten KG 200", "HOAI Anl. 15 LPH 3 c), e)", "M03"),
        ("HLS", A, "Entwässerung", "Wie wird entwässert (Schmutz- und Regenwasser, Versickerung, Rückhaltung, Hebeanlage), und was verlangt die Entwässerungssatzung?", "Lageplan, Untergeschoss, Genehmigung", "HOAI Anl. 15 LPH 3 a), e)", "M03"),
        ("HLS", A, "Durchführungen", "Welche Durchführungen und Lasten für die Tragwerksplanung können Sie schon benennen (Grundsatz, noch ohne Schlitz- und Durchbruchsplanung)?", "Tragwerksbemessung", "HOAI Anl. 15 LPH 3 d)", "M03"),
        ("HLS", A, "Bedarfswerte", "Mit welchem jährlichen Energiebedarf und welchen Betriebskosten rechnen Sie (Abschätzung)?", "Objektbeschreibung, Auftraggeber", "HOAI Anl. 15 LPH 3 c)", "M07"),
        ("HLS", A, "Brandschutz", "Welche Anlagen sind brandschutzrelevant (Rauchabzug, Brandschutzklappen, Abschottungen), und sind sie mit dem Brandschutz abgestimmt?", "Brandschutzkonzept, Kosten", "BayBO Art. 38; L3.KLA.1-05", "M03"),
        ("HLS", A, "Kosten", "Liefern Sie die Kostenberechnung der KG 410 bis 430 bis zur 3. Ebene, und mit welchem Preisstand?", "Kostenberechnung", "HOAI Anl. 15 LPH 3 f)", "M07"),
        ("HLS", F, "Raumprogramm", "Raumprogramm mit Nutzung, Belegung und Betriebszeiten; Anforderungen an das Raumklima", "Auslegung der Anlagen", "HOAI Anl. 15 LPH 3 a)", "M01"),
        ("HLS", F, "Zielstandard", "Energetischer Zielstandard und Förderanforderungen des Auftraggebers, soweit festgelegt", "Anlagenkonzept, GEG", "L3.PSV.1", "M01"),
        ("HLS", F, "Ausstattung", "Sanitärausstattung je Raum, Küchen, Sonderanforderungen", "Auslegung, Kosten", "L3.QUA.1", "M01"),
        ("ELT", A, "Technikflächen", "Welche Technikflächen brauchen Sie (Hausanschluss, Niederspannungsverteilung, IT-Verteiler, ggf. Trafo oder Netzersatz)?", "Grundrisse, Flächenaufstellung", "HOAI Anl. 15 LPH 3 c)", "M03"),
        ("ELT", A, "Trassen", "Wo verlaufen Steig- und Haupttrassen, und welchen Platz brauchen sie?", "Grundrisse, Schächte", "HOAI Anl. 15 LPH 3 c)", "M03"),
        ("ELT", A, "Anschlussleistung", "Welche Anschlussleistung ist zu erwarten, und welche Abstimmung mit dem Netzbetreiber ist nötig?", "Hausanschluss, Kosten KG 200", "HOAI Anl. 15 LPH 3 c), e)", "M03"),
        ("ELT", A, "Sicherheitsanlagen", "Welche Sicherheitsanlagen sind erforderlich (Sicherheitsbeleuchtung, Brandmelde- und Alarmierungsanlage, Steuerung des Rauchabzugs)?", "Brandschutzkonzept, Kosten KG 450", "L3.KLA.1-05", "M03"),
        ("ELT", A, "Photovoltaik", "Ist eine Photovoltaikanlage oder ein Speicher vorgesehen – Flächen, Lasten, Aufstellort?", "Dach, Tragwerk, Technikflächen", "L3.KLA.1-03", "M03"),
        ("ELT", A, "Beleuchtung", "Wie teilen sich technische Beleuchtung, Lichtplanung und Architektur die Beleuchtung (Zuständigkeit, Leuchtenauswahl, Deckenspiegel)?", "Lichtkonzept, Schnittstellenmatrix", "L3.LIC.1", "M02"),
        ("ELT", A, "Erdung", "Welche Blitzschutz- und Erdungsmaßnahmen betreffen Tragwerk und Gründung (Fundamenterder)?", "Tragwerk, Gründung", "HOAI Anl. 15 LPH 3 a)", "M03"),
        ("ELT", A, "Gebäudeautomation", "Welcher Umfang der Gebäudeautomation ist vorgesehen, und wer plant sie?", "Schnittstellenmatrix, Kosten KG 480", "HOAI § 53 (Anlagengruppe 8)", "M02"),
        ("ELT", A, "Aufzug", "Wer plant die Förderanlage, und welche Schachtmaße, Unter- und Überfahrt sind anzunehmen?", "Grundrisse, Schnitte, Tragwerk", "HOAI § 53 (Anlagengruppe 6); BayBO Art. 37", "M02"),
        ("ELT", A, "Kosten", "Liefern Sie die Kostenberechnung der KG 440 bis 480 bis zur 3. Ebene, und mit welchem Preisstand?", "Kostenberechnung", "HOAI Anl. 15 LPH 3 f)", "M07"),
        ("ELT", F, "Ausstattung", "Nutzungen und Ausstattungsanforderungen je Raum (Arbeitsplätze, Medien, Sonderanforderungen)", "Auslegung", "HOAI Anl. 15 LPH 3 a)", "M01"),
        ("ELT", F, "Gestaltung", "Gestalterische Vorgaben zu Beleuchtung, Schaltern und Auslässen", "Planung der Auslässe", "L3.LIC.1, L3.QUA.1", "M03"),
        ("BPH", A, "Energie", "Welcher energetische Standard und welches Nachweisverfahren nach GEG sind anzusetzen, und welche Kennwerte (z. B. U-Werte) folgen für die Bauteile?", "Bauteilkatalog, Fenster, Objektbeschreibung", "HOAI Anl. 1 Nr. 1.2.2 LPH 3 a)", "M03"),
        ("BPH", A, "Bauteilkatalog", "Welche Aufbauten schlagen Sie auf Grundlage unserer Aufbauvorgaben vor, mit Dicken und Aufbauhöhen?", "Grundrisse und Schnitte Stand 02 (L3.BTK.2)", "HOAI Anl. 1 Nr. 1.2.2 LPH 3 c); L3.BTK.1", "M03"),
        ("BPH", A, "Schallschutz", "Welche Schallschutzanforderungen legen Sie zugrunde (DIN 4109 oder ein vereinbartes höheres Niveau), und was folgt daraus für Wände, Decken, Türen und Fenster?", "Bauteilkatalog, Entscheidungsvorlage", "HOAI Anl. 1 Nr. 1.2 (Bauakustik)", "M03"),
        ("BPH", A, "Außenlärm", "Ist Schutz gegen Außenlärm nachzuweisen, und welche Fenster- und Lüftungsqualitäten folgen daraus?", "Fenster, Lüftungskonzept, Kosten", "HOAI Anl. 1 Nr. 1.2 (Bauakustik)", "M03"),
        ("BPH", A, "Raumakustik", "Welche Räume brauchen raumakustische Maßnahmen, und in welchem Umfang?", "Decken, Oberflächen, Kosten", "HOAI Anl. 1 Nr. 1.2 (Raumakustik)", "M03"),
        ("BPH", A, "Sommerlicher Wärmeschutz", "Wie wird der sommerliche Wärmeschutz nachgewiesen, und was folgt für Sonnenschutz und Glasanteile?", "Fassade, Ansichten", "HOAI Anl. 1 Nr. 1.2 (Wärmeschutz)", "M03"),
        ("BPH", A, "Leitdetails", "Wo sehen Sie Wärmebrücken- oder Feuchterisiken in den Leitdetails (Sockel, Fensteranschluss, Attika, Deckenanschluss)?", "Leitdetails, Fassade", "L3.BTK.1-05", "M03"),
        ("BPH", A, "Abhängigkeiten", "Welche Angaben brauchen Sie von Tragwerk und Technik, und bis wann?", "Schnittstellenmatrix", "HOAI Anl. 1 Nr. 1.2.2 LPH 3 b)", "M02"),
        ("BPH", A, "Simulationen", "Wären Simulationen sinnvoll (Besondere Leistung), und wofür?", "Entscheidung des Auftraggebers", "HOAI Anl. 1 Nr. 1.2.2, Besondere Leistungen LPH 3", "M03"),
        ("BPH", F, "Aufbauvorgaben", "Aufbauvorgaben: Konstruktionsart, Schichtenfolge, Materialien, angenommene Dicken je Bauteil", "Bauteilkatalog", "L3.BTK.1", "M01"),
        ("BPH", F, "Fenster und Nutzung", "Fensterflächen, Orientierung, Verschattung und Nutzungen je Raum", "Sommerlicher Wärmeschutz, Schallschutz", "L3.PGF.1", "M01"),
        ("BPH", F, "Schallschutzniveau", "Vereinbartes Schallschutzniveau – vom Auftraggeber ausdrücklich zu entscheiden", "Bemessung; Entscheidungspunkt", "L3.ENV.1", "M04"),
        ("BRS", A, "Einstufung", "Welche Gebäudeklasse und welche Einstufung (Sonderbau, Sonderbauverordnung) legen Sie zugrunde?", "Bauteilanforderungen, Prüfpflicht", "BayBO Art. 2 Abs. 3 und 4", "M03"),
        ("BRS", A, "Rettungswege", "Wie sind erster und zweiter Rettungsweg je Geschoss und Nutzungseinheit geführt (notwendige Treppen und Treppenräume, Flure, Anleiterung)?", "Grundrisse, Fenster, Freianlagen", "BayBO Art. 31–34", "M03"),
        ("BRS", A, "Brandabschnitte", "Welche Brandabschnitte, Brandwände und Trennwände sind erforderlich?", "Grundrisse, Bauteilkatalog", "BayBO Art. 27, 28", "M03"),
        ("BRS", A, "Bauteile", "Welche Feuerwiderstands- und Baustoffanforderungen gelten für Tragwerk, Decken, Außenwände und Dach?", "Bauteilkatalog, Tragwerk, Fassade", "BayBO Art. 24–30", "M03"),
        ("BRS", A, "Anlagentechnik", "Welche anlagentechnischen Maßnahmen sind erforderlich (Brandmeldeanlage, Rauchabzug, Sicherheitsbeleuchtung, Löschanlagen)?", "HLS, ELT, Kosten KG 450", "Brandschutzkonzept", "M03"),
        ("BRS", A, "Feuerwehr", "Welche Zufahrten, Aufstell- und Bewegungsflächen für die Feuerwehr sind nötig?", "Lageplan, Freianlagen", "BayBO Art. 5", "M03"),
        ("BRS", A, "Abweichungen", "Zeichnen sich Abweichungen ab, und wie sollen sie kompensiert werden?", "Genehmigungsfähigkeit, Entscheidungsvorlage", "BayBO Art. 63", "M03"),
        ("BRS", A, "Prüfung", "Wird der Brandschutznachweis bescheinigt oder geprüft, und was bedeutet das für Unterlagen und Termine?", "Terminplan LPH 4, Kosten KG 700", "BayBO Art. 62b; Blatt Projekt", "M03"),
        ("BRS", A, "Vorgespräch", "Ist ein Vorgespräch mit Bauaufsicht und Brandschutzdienststelle in der LPH 3 sinnvoll, und mit welchen Unterlagen?", "Genehmigungsfähigkeit (L3.GEN.1)", "HOAI Anl. 10 LPH 3 d)", "M03"),
        ("BRS", F, "Nutzung", "Nutzungen, Personenzahlen und Belegung je Bereich", "Rettungswege, Einstufung", "Brandschutzkonzept", "M01"),
        ("BRS", F, "Geometrie", "Geschossflächen, Höhe nach Art. 2 Abs. 3 BayBO, Grundrisse mit Treppen", "Gebäudeklasse, Rettungswege", "BayBO Art. 2 Abs. 3", "M01"),
        ("GEO", A, "Gutachten", "Liegt ein Baugrundgutachten vor, und deckt es Gründung, Baugrube, Wasserhaltung und Versickerung ab?", "Gründung, Untergeschoss, Entwässerung", "HOAI Anl. 1 Nr. 1.3", "M00"),
        ("GEO", A, "Kennwerte", "Welche Gründungsempfehlung und Bodenkennwerte gelten, und welche Setzungen sind zu erwarten?", "Tragwerk", "HOAI Anl. 1 Nr. 1.3 c)", "M01"),
        ("GEO", A, "Grundwasser", "Wie hoch ist der Bemessungswasserstand, und welche Bauweise oder Abdichtung folgt daraus für Untergeschosse?", "Untergeschoss, Bauteilkatalog, Kosten", "HOAI Anl. 1 Nr. 1.3 b), c)", "M01"),
        ("GEO", A, "Versickerung", "Ist eine Versickerung von Niederschlagswasser möglich?", "Entwässerungskonzept", "HOAI Anl. 1 Nr. 1.3", "M01"),
        ("GEO", A, "Aushub", "Gibt es Hinweise auf belasteten Aushub, und welche Kostenfolgen sind zu erwarten?", "Kostenberechnung KG 310", "HOAI Anl. 1 Nr. 1.3 c)", "M03"),
        ("GEO", A, "Nachbarbebauung", "Welche Auswirkungen hat die Baugrube auf die Nachbarbebauung (Verbau, Unterfangung)?", "Baugrube, Kosten, Termine", "HOAI Anl. 1 Nr. 1.3 c)", "M03"),
        ("VER", A, "Lage- und Höhenplan", "Liegt ein aktueller Lage- und Höhenplan vor (Grenzen, Bestand, Bäume, Leitungen), und auf welchen Höhenbezug bezieht er sich?", "Lageplan, Höhen, Abstandsflächen", "HOAI Anl. 1 Nr. 1.4", "M00"),
        ("VER", A, "Lageplan Bauantrag", "Welche Anforderungen gelten an den Lageplan für den Bauantrag, und wer erstellt ihn?", "Genehmigungsplanung LPH 4", "BauVorlV", "M03"),
        ("VER", A, "Grenzen", "Sind die Grenzpunkte gesichert, und gibt es Abweichungen zwischen Kataster und Örtlichkeit?", "Abstandsflächen, Lageplan", "HOAI Anl. 1 Nr. 1.4", "M01"),
        ("VER", A, "Nachbarbebauung", "Bis wann sind Höhen der Nachbarbebauung bzw. ein Geländemodell lieferbar?", "Abstandsflächen, Ansichten", "HOAI Anl. 1 Nr. 1.4", "M01"),
        ("FRA", A, "Höhen", "Welche Höhen sind an den Gebäudeanschlüssen anzunehmen (Zugänge, Sockel, Barrierefreiheit)?", "EG-Grundriss, Schnitte, Lageplan", "HOAI Anl. 11 LPH 3", "M03"),
        ("FRA", A, "Flächen", "Wie sind Zufahrten, Stellplätze, Fahrradabstellplätze und Feuerwehrflächen angeordnet?", "Lageplan, Genehmigungsfähigkeit", "Stellplatzsatzung; BayBO Art. 5", "M03"),
        ("FRA", A, "Versiegelung", "Welche Flächen werden versiegelt, begrünt oder für die Versickerung genutzt?", "Entwässerung, Genehmigung", "Bebauungsplan, Satzungen", "M03"),
        ("FRA", A, "Bäume", "Welche Bäume sind zu erhalten, und welche Schutzmaßnahmen folgen daraus?", "Lageplan, Baustelleneinrichtung", "Baumschutzverordnung der Gemeinde", "M03"),
        ("FRA", A, "Vorgaben", "Welche Vorgaben aus Bebauungsplan oder Freiflächengestaltungssatzung gelten?", "Genehmigungsfähigkeit", "Bebauungsplan, Satzungen", "M03"),
        ("FRA", A, "Kosten", "In welcher Gliederung liefern Sie die Kosten der KG 500?", "Kostenberechnung", "HOAI Anl. 11 LPH 3", "M07"),
    ]
    r = 7; seq = {}
    for dis, wer, thema, frage, fuer, grund, bis in FR:
        seq[dis] = seq.get(dis, 0) + 1
        put(ws, f"A{r}", f"{dis}-{seq[dis]:02d}", font=F_BOLD)
        put(ws, f"B{r}", dis, font=F_PROP, fill=FILL_IN, align=WRAPC)
        put(ws, f"C{r}", wer, font=F_PROP, fill=FILL_IN)
        put(ws, f"D{r}", thema, font=F_PROP, fill=FILL_IN)
        put(ws, f"E{r}", frage, font=F_PROP, fill=FILL_IN)
        put(ws, f"F{r}", fuer, font=F_PROP, fill=FILL_IN)
        put(ws, f"G{r}", grund, font=F_SUB)
        put(ws, f"H{r}", bis, font=F_PROP, fill=FILL_IN, align=WRAPC)
        put(ws, f"I{r}", ms_date(f"H{r}"), fill=FILL_CALC, fmt=DATE)
        for col in "JKN": put(ws, f"{col}{r}", None, fill=FILL_IN)
        put(ws, f"L{r}", None, fill=FILL_IN, fmt=DATE)
        put(ws, f"M{r}", "offen", font=F_PROP, fill=FILL_IN)
        put(ws, f"O{r}", "Mindestanforderungen sind nicht automatisch der vereinbarte Standard." if thema == "Schallschutzniveau" else None, font=F_PROP, fill=FILL_IN)
        ws.row_dimensions[r].height = 36
        r += 1
    for k in range(15):  # projektbezogene Fragen
        put(ws, f"A{r}", f"P-{k+1:02d}", font=F_BOLD)
        for col in "BCDEFGHJKNO": put(ws, f"{col}{r}", None, fill=FILL_IN)
        put(ws, f"I{r}", ms_date(f"H{r}"), fill=FILL_CALC, fmt=DATE)
        put(ws, f"L{r}", None, fill=FILL_IN, fmt=DATE); put(ws, f"M{r}", None, fill=FILL_IN)
        r += 1
    last = r - 1
    put(ws, "J3", f'="Offen: "&COUNTIF(M7:M{last},"offen")&" · beantwortet: "&COUNTIF(M7:M{last},"beantwortet")&" · entfällt: "&COUNTIF(M7:M{last},"entfällt")', font=F_BOLD, border=False)
    dv_list(ws, L["Disziplin"], f"B7:B{last}")
    dv_list(ws, L["Wer fragt"], f"C7:C{last}", strict=True)
    dv_list(ws, MS, f"H7:H{last}")
    dv_list(ws, L["Status Frage"], f"M7:M{last}")
    dv_date(ws, f"L7:L{last}")
    ws.conditional_formatting.add(f"M7:M{last}", FormulaRule(formula=['M7="offen"'], fill=PatternFill("solid", fgColor="FCE4CC")))
    ws.conditional_formatting.add(f"M7:M{last}", FormulaRule(formula=['M7="beantwortet"'], fill=PatternFill("solid", fgColor="D5E8D4")))
    ws.conditional_formatting.add(f"A7:O{last}", FormulaRule(formula=['$M7="entfällt"'], font=Font(name=ARIAL, size=9, color="A6A6A6", strike=True)))
    ws.auto_filter.ref = f"A6:O{last}"
    ws.freeze_panes = "E7"
    page(ws, "6:6", a3=True)

    # ───────── Eingang (L3.KLA.1-01, L3.KLA.2-02)
    ws = eng
    title(ws, "Eingang der Fachplanungsbeiträge",
          "L3.KLA.1-01 (Eingang Arbeitsstand 01 gegen den vereinbarten Lieferumfang, M03) · L3.KLA.2-02 (Rückmeldung je Disziplin zum integrierten Stand) · Endstand M07", 15)
    put(ws, "A3", PROJEKT, font=F_BOLD, border=False)
    heads = ["Disziplin", "Büro", "Lieferumfang Arbeitsstand 01 (lt. Kick-off)", "erwartet (M03)", "eingegangen am", "Planstand · Index", "vollständig?",
             "fehlt · angemahnt am", "Lieferumfang Endstand (lt. Kick-off)", "erwartet (M07)", "eingegangen am", "Index",
             "Rückmeldung zum integrierten Stand", "Vorbehalt", "Stand"]
    header(ws, 6, heads, [9, 18, 38, 11, 11, 12, 10, 22, 38, 11, 11, 9, 16, 28, 20], height=40)
    EG = [
        ("TWP", "Tragwerkslösung mit Hauptabmessungen und Bauteildicken, Systemskizze, Gründungskonzept", "Abgestimmte Tragwerkslösung, überschlägige Bemessung, Mengen für die Kostenberechnung, Textbeitrag"),
        ("HLS", "Anlagenkonzept, Technikflächen, Schächte und Haupttrassen, Strangschemata (Entwurf)", "Entwurf mit maßbestimmenden Dimensionen, Anlagenliste, Durchführungen und Lasten (Grundsatz), Kostenberechnung KG 410–430 (3. Ebene), Textbeitrag"),
        ("ELT", "Konzept, Technikflächen, Trassen, Sicherheitsanlagen", "Entwurf, Anlagenliste, Kostenberechnung KG 440–480 (3. Ebene), Textbeitrag"),
        ("BPH", "Bauteilkatalog Arbeitsstand 01 auf Grundlage der Aufbauvorgaben (Vorgang t060)", "Bauteilkatalog Endstand nach Bemusterung (t061), Kennwerte, Erläuterungsbericht"),
        ("BRS", "Brandschutzkonzept, Entwurf – sofern beauftragt (t018)", "Abgestimmtes Brandschutzkonzept (t032)"),
        ("FRA", "Freianlagenkonzept, Höhen, Flächen", "Entwurf, Kostenberechnung KG 500, Textbeitrag"),
    ]
    r = 7
    for dis, as01, end in EG + [(None, None, None)] * 3:
        put(ws, f"A{r}", dis, font=F_BOLD if dis else F_BODY, fill=None if dis else FILL_IN)
        put(ws, f"B{r}", None, fill=FILL_IN)
        put(ws, f"C{r}", as01, font=F_PROP, fill=FILL_IN)
        put(ws, f"D{r}", '=IF(Projekt!$C$37="","",Projekt!$C$37)', fill=FILL_CALC, fmt=DATE)
        for col in "EKL": put(ws, f"{col}{r}", None, fill=FILL_IN, fmt=DATE if col in "EK" else None)
        for col in "FGHN": put(ws, f"{col}{r}", None, fill=FILL_IN)
        put(ws, f"I{r}", end, font=F_PROP, fill=FILL_IN)
        put(ws, f"J{r}", '=IF(Projekt!$C$41="","",Projekt!$C$41)', fill=FILL_CALC, fmt=DATE)
        put(ws, f"M{r}", None, fill=FILL_IN)
        put(ws, f"O{r}", f'=IF(A{r}="","",IF(E{r}="",IF(AND(ISNUMBER(D{r}),D{r}<TODAY()),"Arbeitsstand 01 überfällig","Arbeitsstand 01 ausstehend"),'
                         f'IF(G{r}="nein","Arbeitsstand 01 unvollständig",IF(K{r}="",IF(AND(ISNUMBER(J{r}),J{r}<TODAY()),"Endstand überfällig","Endstand ausstehend"),'
                         f'IF(M{r}="stimmt überein","bestätigt",IF(M{r}="Vorbehalt","Vorbehalt","Rückmeldung ausstehend"))))))', fill=FILL_CALC)
        ws.row_dimensions[r].height = 48
        r += 1
    last = r - 1
    dv_list(ws, L["ja/nein"], f"G7:G{last}", strict=True)
    dv_list(ws, L["Bestätigung"], f"M7:M{last}", strict=True)
    dv_date(ws, [f"E7:E{last}", f"K7:K{last}"])
    ws.conditional_formatting.add(f"O7:O{last}", FormulaRule(formula=['ISNUMBER(SEARCH("überfällig",O7))'], fill=PatternFill("solid", fgColor="F8CBAD")))
    ws.conditional_formatting.add(f"O7:O{last}", FormulaRule(formula=['O7="bestätigt"'], fill=PatternFill("solid", fgColor="D5E8D4")))
    put(ws, f"A{last+2}", "Erwartete Termine kommen aus dem Blatt Projekt (M03, M07). Der Lieferumfang ist ein Vorschlag nach HOAI Anlage 14, 15 und Anlage 1 – im Kick-off je Disziplin vereinbaren (L3.A1.ABS-03).", font=F_SUB, border=False)
    ws.freeze_panes = "B7"
    page(ws, "6:6", a3=True)

    # ───────── Klärungsliste (L3.KLA.1 / .2 / .3)
    ws = kla
    title(ws, "Klärungsliste Koordination",
          "L3.KLA.1 (Runde 01) · L3.KLA.2 (Runde 02, Bestätigung je Disziplin) · L3.KLA.3 (geschlossen nach M07) · je Konflikt Ort, Beteiligte, Lösungsvorschlag, Verantwortlicher, Frist (L3.KLA.1-07)", 16)
    put(ws, "A3", PROJEKT, font=F_BOLD, border=False)
    heads = ["Nr", "Runde", "erfasst am", "Disziplinen · Beteiligte", "Ort (Geschoss, Achse, Bauteil)", "Plan · Index", "Sachverhalt · Konflikt",
             "Lösungsvorschlag", "verantwortlich", "Frist", "Status", "Entscheidungspunkt AG?", "Folgen: Kosten, Termine, Gestaltung, Genehmigung",
             "erledigt am", "Protokoll", "überfällig"]
    header(ws, 6, heads, [6, 7, 11, 16, 20, 14, 42, 36, 14, 11, 13, 11, 34, 11, 14, 11], height=40)
    r = 7
    beispiel = ["Bsp.", "01", "=TODAY()-14", "TWP, HLS", "1. OG, Achse C/3–4, Flur", "GR 1.OG Index A",
                "Unterzug (h = 50 cm) kreuzt die Lüftungshaupttrasse; lichte Höhe im Flur unter 2,40 m",
                "Trasse in den nördlichen Flur verlegen oder Unterzug deckengleich ausbilden", "TWP", "=TODAY()-3", "in Klärung", "ja",
                "Deckengleicher Unterzug: Mehrkosten KG 350; keine Terminfolge; Gestaltung: Flurdecke ohne Abkofferung", None, "Koordination 01"]
    for k, v in enumerate(beispiel):
        col = get_column_letter(k + 1)
        put(ws, f"{col}{r}", v, font=F_EX, fill=FILL_IN, fmt=DATE if col in "CJN" else None)
    ws.row_dimensions[r].height = 48
    r += 1
    for k in range(100):
        put(ws, f"A{r}", k + 1, align=WRAPC)
        for col in "BDEFGHIKLMO": put(ws, f"{col}{r}", None, fill=FILL_IN)
        for col in "CJN": put(ws, f"{col}{r}", None, fill=FILL_IN, fmt=DATE)
        r += 1
    last = r - 1
    for rr in range(7, last + 1):
        put(ws, f"P{rr}", f'=IF(OR(J{rr}="",K{rr}="gelöst",K{rr}="entfällt"),"",IF(J{rr}<TODAY(),"überfällig",""))', fill=FILL_CALC)
    put(ws, "G3", f'="Offen oder in Klärung: "&(COUNTIF(K7:K{last},"offen")+COUNTIF(K7:K{last},"in Klärung"))&" · überfällig: "&COUNTIF(P7:P{last},"überfällig")&" · Entscheidungspunkte: "&COUNTIF(L7:L{last},"ja")', font=F_BOLD, border=False)
    put(ws, "M3", "Zeile «Bsp.» ist ein Beispiel – vor Gebrauch löschen.", font=F_EX, border=False)
    dv_list(ws, L["Runde"], f"B7:B{last}")
    dv_list(ws, L["Status Klärung"], f"K7:K{last}")
    dv_list(ws, L["ja/nein"], f"L7:L{last}", strict=True)
    dv_date(ws, [f"C7:C{last}", f"J7:J{last}", f"N7:N{last}"])
    ws.conditional_formatting.add(f"P7:P{last}", FormulaRule(formula=['P7="überfällig"'], fill=PatternFill("solid", fgColor="F8CBAD")))
    ws.conditional_formatting.add(f"A7:O{last}", FormulaRule(formula=['OR($K7="gelöst",$K7="entfällt")'], font=Font(name=ARIAL, size=9, color="A6A6A6")))
    ws.conditional_formatting.add(f"L7:L{last}", FormulaRule(formula=['L7="ja"'], fill=PatternFill("solid", fgColor="E4D7F5")))
    ws.auto_filter.ref = f"A6:P{last}"
    ws.freeze_panes = "G7"
    page(ws, "6:6", a3=True)

    # ───────── Entscheidungen (L3.ENV.1, L3.A3.ABS)
    ws = ent
    title(ws, "Entscheidungsliste",
          "L3.ENV.1 (Entscheidungsvorlage, M04) · L3.A3.ABS (Entscheidungsprotokoll, M05) · jede Entscheidung mit Datum und Entscheider; offene Punkte mit neuer Frist und Annahme für die Weiterplanung", 17)
    put(ws, "A3", PROJEKT, font=F_BOLD, border=False)
    heads = ["Nr", "Herkunft (Klärungsliste, Rückmeldeliste, Baurechts-Check)", "Thema", "Frage an den Auftraggeber", "Optionen", "Empfehlung des Büros",
             "Folgen je Option: Kosten, Termine, Qualität, Genehmigung", "Was danach festliegt", "Entscheidung bis", "vorgelegt am (M04)",
             "entschieden am", "Entscheidung", "Entscheider", "Annahme für die Weiterplanung (falls offen)", "in Textform bestätigt am", "Status", "überfällig"]
    header(ws, 6, heads, [6, 18, 20, 32, 34, 30, 40, 28, 11, 11, 11, 26, 14, 28, 11, 12, 11], height=52)
    r = 7
    beispiel = ["Bsp.", "Fragenliste BPH-12", "Schallschutzniveau Trenndecken und -wände",
                "Welches Schallschutzniveau soll für Trenndecken und Trennwände vereinbart werden?",
                "A: Mindestanforderungen DIN 4109-1 · B: erhöhter Schallschutz nach Vereinbarung (z. B. VDI 4100)",
                "B, weil die Nutzung ruhebedürftig ist und die Mehrkosten gering sind (Beispiel)",
                "A: keine Mehrkosten · B: Decke + 2 cm, höherer Estrichaufbau, Mehrkosten KG 350 lt. Bauphysik; Termine: keine; Genehmigung: keine",
                "Deckenstärke, Bodenaufbauten, Geschosshöhe, Türen", "=TODAY()+10", "=TODAY()-2", None, None, None,
                "Bis zur Entscheidung wird mit B geplant", None, "vorgelegt"]
    for k, v in enumerate(beispiel):
        col = get_column_letter(k + 1)
        put(ws, f"{col}{r}", v, font=F_EX, fill=FILL_IN, fmt=DATE if col in "IJKO" else None)
    ws.row_dimensions[r].height = 60
    r += 1
    for k in range(40):
        put(ws, f"A{r}", k + 1, align=WRAPC)
        for col in "BCDEFGHLMNP": put(ws, f"{col}{r}", None, fill=FILL_IN)
        for col in "IJKO": put(ws, f"{col}{r}", None, fill=FILL_IN, fmt=DATE)
        r += 1
    last = r - 1
    for rr in range(7, last + 1):
        put(ws, f"Q{rr}", f'=IF(OR(I{rr}="",P{rr}="entschieden",P{rr}="entfällt"),"",IF(I{rr}<TODAY(),"überfällig",""))', fill=FILL_CALC)
    put(ws, "E3", f'="Nicht entschieden: "&(COUNTIF(P7:P{last},"vorbereitet")+COUNTIF(P7:P{last},"vorgelegt")+COUNTIF(P7:P{last},"vertagt"))&" · überfällig: "&COUNTIF(Q7:Q{last},"überfällig")', font=F_BOLD, border=False)
    put(ws, "L3", "Zeile «Bsp.» ist ein Beispiel – vor Gebrauch löschen.", font=F_EX, border=False)
    dv_list(ws, L["Status Entscheidung"], f"P7:P{last}")
    dv_date(ws, [f"I7:I{last}", f"J7:J{last}", f"K7:K{last}", f"O7:O{last}"])
    ws.conditional_formatting.add(f"Q7:Q{last}", FormulaRule(formula=['Q7="überfällig"'], fill=PatternFill("solid", fgColor="F8CBAD")))
    ws.conditional_formatting.add(f"A7:P{last}", FormulaRule(formula=['OR($P7="entschieden",$P7="entfällt")'], font=Font(name=ARIAL, size=9, color="7F7F7F")))
    put(ws, f"B{last+2}", "Eine vertiefte Kostenuntersuchung von Varianten ist Besondere Leistung der LPH 3 (HOAI Anlage 10). Die Kostenfolge je Option in der vertraglich vereinbarten Tiefe angeben (L3.ENV.1-03).", font=F_SUB, border=False)
    ws.auto_filter.ref = f"A6:Q{last}"
    ws.freeze_panes = "D7"
    page(ws, "6:6", a3=True)

    # ───────── Anleitung
    ws = anl
    title(ws, "Koordination LPH 3 · Bürovorlage",
          f"Muster für jedes Projekt · Stand {STAND} · gehört zur Aufgabenbibliothek LPH 3 v0.3.4 (Entwurf) und zum Muster-Terminplan LPH 3 v1.6", 4)
    ws.column_dimensions["A"].width = 3; ws.column_dimensions["B"].width = 26; ws.column_dimensions["C"].width = 70; ws.column_dimensions["D"].width = 62
    put(ws, "B4", "So arbeitet die Mappe", font=F_SEC, border=False)
    put(ws, "B5", "Blatt", font=F_HEAD, fill=FILL_HEAD); put(ws, "C5", "Was hier entsteht · Aufgabe im Planner", font=F_HEAD, fill=FILL_HEAD); put(ws, "D5", "Wann", font=F_HEAD, fill=FILL_HEAD)
    ablauf = [
        ("Projekt", "Projektparameter und Termine. Daraus folgen die Prüfpflichten der bautechnischen Nachweise, der Koordinator nach BaustellV und die Mindesttiefe der Kostenberechnung. (L3.PSV.1-07)", "M00 · Projektauftakt"),
        ("Fachplanerbedarf", "Welche Disziplinen das Projekt braucht, wer beauftragt ist, was fehlt; Entscheidungshilfe für den Auftraggeber. (L3.FPB.1)", "vor M00A"),
        ("Schnittstellen", "Wer plant, wer wirkt mit, wer liefert Angaben – je Thema genau eine planende Stelle; Liefertermine an M01, M03, M07 gekoppelt. v0 geht mit dem Paket hinaus. (L3.SSM.1)", "vor M01"),
        ("Fragenliste", "Fragen je Disziplin für das Planungsgrundlagen-Paket und was die Fachplanungen von uns brauchen. Im Kick-off beantwortet oder terminiert. (L3.PGF.1-06, L3.A1.ABS-06)", "M01 und M02"),
        ("Schnittstellen v1", "Im Kick-off Punkt für Punkt durchgehen, offene Zuständigkeiten (?) entscheiden, Version auf v1 setzen; gilt nach der Widerspruchsfrist des Protokolls. (L3.A1.ABS-05)", "M02 · Kick-off"),
        ("Eingang", "Eingang je Disziplin gegen den vereinbarten Lieferumfang; Rückmeldung zum integrierten Stand. (L3.KLA.1-01, L3.KLA.2-02)", "M03 und M07"),
        ("Klärungsliste", "Jeder Konflikt mit Ort, Beteiligten, Lösungsvorschlag, Verantwortlichem und Frist; Punkte mit Kosten-, Termin- oder Gestaltungsfolgen als Entscheidungspunkt markieren. (L3.KLA.1, L3.KLA.2)", "M03 bis M07"),
        ("Entscheidungen", "Entscheidungspunkte gesammelt vorlegen; Entscheidung, Datum, Entscheider und Bestätigung in Textform festhalten. Zur Vorlage gehört das Word-Muster «Entscheidungsvorlage». (L3.ENV.1, L3.A3.ABS)", "M04 und M05"),
    ]
    r = 6
    for blatt, was, wann in ablauf:
        put(ws, f"B{r}", blatt, font=F_BOLD); put(ws, f"C{r}", was); put(ws, f"D{r}", wann)
        ws.row_dimensions[r].height = 40; r += 1
    r += 1
    put(ws, f"B{r}", "Farben", font=F_SEC, border=False); r += 1
    for txt, font, fill, expl in [
        ("Eingabe", F_BODY, FILL_IN, "Gelbes Feld: hier eintragen."),
        ("Vorschlag", F_PROP, FILL_IN, "Blaue Schrift: Vorschlag des Musters – prüfen und überschreiben, nicht ungeprüft übernehmen."),
        ("Formel", F_BODY, FILL_CALC, "Graues Feld: wird berechnet – nicht überschreiben."),
        ("Beispiel", F_EX, FILL_IN, "Graue kursive Zeile «Bsp.»: zeigt, wie eine Zeile aussieht – vor Gebrauch löschen."),
    ]:
        put(ws, f"B{r}", txt, font=font, fill=fill); put(ws, f"C{r}", expl); r += 1
    r += 1
    put(ws, f"B{r}", "Zuständigkeit (Legende nach ByAK-Merkblatt M13)", font=F_SEC, border=False); r += 1
    for code, bed in [("V", "Verantwortung"), ("G", "Planung als Grundleistung – «plant»"), ("B", "Planung als Besondere Leistung – «plant», gesondert zu beauftragen"),
                      ("K", "Koordination und Integration – in der Regel die Objektplanung"), ("M", "Mitwirkung, fachliche Bearbeitung – «wirkt mit»"),
                      ("F", "Festlegung spezieller Anforderungen – «liefert Angaben»"), ("?", "Zuständigkeit offen – im Kick-off klären (L3.SSM.1-06)")]:
        put(ws, f"B{r}", code, font=F_BOLD, align=WRAPC); put(ws, f"C{r}", bed); r += 1
    put(ws, f"C{r}", "Die Vorbelegung der Matrix ist ein Vorschlag des Büros, nicht der Inhalt des ByAK-Katalogs. In der Aufgabenbibliothek heißen die Rollen «plant / wirkt mit / liefert Angaben» (L3.SSM.1).", font=F_SUB, border=False)
    ws.row_dimensions[r].height = 26; r += 2
    put(ws, f"B{r}", "Grenze der Koordination", font=F_SEC, border=False); r += 1
    put(ws, f"C{r}", "«Eine fachliche Kontrolle der Inhalte fachfremder Planungen kann und muss der Architekt nicht leisten.» (ByAK-Merkblatt M08, 01/2021). Die Klärungsliste prüft Schnittstellen – Geometrie, Platz, Abhängigkeiten, Termine –, nicht die Richtigkeit fremder Berechnungen.")
    ws.merge_cells(f"C{r}:D{r}"); ws.row_dimensions[r].height = 40; r += 2
    put(ws, f"B{r}", "Für die KI", font=F_SEC, border=False); r += 1
    put(ws, f"C{r}", "Die ausgefüllte Mappe im Schreibtisch des Projekts ablegen (Work). Die KI liest Excel-Dateien und kann daraus offene Fragen, überfällige Punkte und anstehende Entscheidungen nennen. Ansprechpartner mit Firma und Rolle genügen; private Daten gehören nicht hinein.")
    ws.merge_cells(f"C{r}:D{r}"); ws.row_dimensions[r].height = 40; r += 2
    quellen_rows(ws, r)
    page(ws, None, landscape=False)

    wb.properties.creator = "TBA Office"; wb.properties.title = "Koordination LPH 3 · Bürovorlage"
    p = OUT / "LPH3_3_Koordination.xlsx"
    wb.save(p)
    return p


# ════════════════════════════════════════════════════════════ Planliste
def planliste():
    global PL_PROJEKT
    PL_PROJEKT = '="Projekt: "&IF(Anleitung!C5="","(in der Anleitung eintragen)",Anleitung!C5)'
    wb = Workbook()
    anl = wb.active; anl.title = "Anleitung"
    pl = wb.create_sheet("Planliste")
    dok = wb.create_sheet("Dokumente")
    aus = wb.create_sheet("Ausgaben")
    ver = wb.create_sheet("Verteiler")
    tau = wb.create_sheet("Austausch")
    abl = wb.create_sheet("Ablage")
    L = lists_sheet(wb, {
        "Planart": ["LP", "GR", "SC", "AN", "DT", "TH", "SO"],
        "Status Plan": ["in Bearbeitung", "Teilstand (vorläufig)", "Arbeitsstand 01", "Stand 02", "Endstand LPH 3", "ersetzt", "entfällt"],
        "Format": ["A0", "A1", "A2", "A3", "A4", "Sonderformat"],
        "Übergabe": ["PDF", "PDF + DWG", "PDF + IFC", "PDF + DWG + IFC", "–"],
        "ja/nein": ["ja", "nein"],
        "Meilenstein": ["M00", "M00A", "M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M08A", "M09", "M10", "M11"],
    })

    # Anleitung (mit Planschlüssel-Einstellungen, auf die die Planliste verweist)
    ws = anl
    title(ws, "Planliste und Dokumentenstruktur · Bürovorlage",
          f"L3.PLI.1 · Muster für jedes Projekt · Stand {STAND} · wird mit jeder Ausgabe nachgeführt und in L3.DOK.1 zum Abgabeverzeichnis", 4)
    ws.column_dimensions["A"].width = 3; ws.column_dimensions["B"].width = 30; ws.column_dimensions["C"].width = 64; ws.column_dimensions["D"].width = 60
    put(ws, "B4", "Projekt und Planschlüssel (gilt für Spalte B der Planliste)", font=F_SEC, border=False)
    put(ws, "B5", "Projekt", font=F_BOLD); put(ws, "C5", None, fill=FILL_IN); put(ws, "D5", "Kurzname wie im Office", font=F_SUB)
    put(ws, "B6", "Projektkürzel", font=F_BOLD); put(ws, "C6", None, fill=FILL_IN); put(ws, "D6", "z. B. drei Buchstaben, wie im Büro üblich", font=F_SUB)
    put(ws, "B7", "Leistungsphase", font=F_BOLD); put(ws, "C7", "3", font=F_PROP, fill=FILL_IN); put(ws, "D7", "", font=F_SUB)
    put(ws, "B8", "Trennzeichen", font=F_BOLD); put(ws, "C8", "-", font=F_PROP, fill=FILL_IN); put(ws, "D8", "", font=F_SUB)
    put(ws, "B9", "Ergebnis (Beispiel)", font=F_BOLD)
    put(ws, "C9", '=IF(C6="","(Kürzel)",C6)&C8&C7&C8&"GR"&C8&"EG"&C8&"01"', fill=FILL_CALC)
    put(ws, "D9", "Projektkürzel – Leistungsphase – Planart – Geschoss/Bereich – laufende Nummer. Vorschlag; gilt ein Bürostandard, die Formel in Spalte B der Planliste anpassen (L3.PLI.1-02).", font=F_SUB)
    ws.row_dimensions[9].height = 36
    r = 11
    put(ws, f"B{r}", "Regeln (Vorschlag, bis der Bürostandard sie ersetzt)", font=F_SEC, border=False); r += 1
    for k, v in [
        ("Index", "Ein Index wird vergeben, sobald ein Plan das Büro verlässt – nicht erst, wenn er sich inhaltlich ändert. Jede Änderung zum letzten Index steht in der Spalte «Änderung»."),
        ("Teilstände", "Teilstände für die Fachplaner tragen «vorläufig – kein freigegebener Entwurf» mit Datum und Index (L3.PGF.1-01)."),
        ("Ausgaben", "Ein Ordner je Ausgabe, mit Datum und Anlass im Namen. Eine Ausgabe wird nachträglich nicht verändert."),
        ("Maßstäbe", "HOAI Anlage 10 LPH 3 a): zeichnerische Darstellung zum Beispiel bei Gebäuden im Maßstab 1:100, bei Innenräumen 1:50 bis 1:20."),
        ("Abgabeverzeichnis", "Die Planliste wird mit jeder Ausgabe nachgeführt; am Ende der Phase entsteht daraus das Abgabeverzeichnis (L3.DOK.1)."),
    ]:
        put(ws, f"B{r}", k, font=F_BOLD); put(ws, f"C{r}", v); ws.merge_cells(f"C{r}:D{r}"); ws.row_dimensions[r].height = 30; r += 1
    r += 1
    put(ws, f"B{r}", "Blätter", font=F_SEC, border=False); r += 1
    for k, v in [("Planliste", "Alle vorgesehenen Pläne mit Nummer, Maßstab, Index und Status; je Ausgabe der ausgegebene Index (L3.PLI.1-01, -02)."),
                 ("Dokumente", "Die übrigen Ergebnisse der LPH 3 aus dem Ergebnisregister der Aufgabenbibliothek, mit Stand und Index."),
                 ("Ausgaben", "Jede Ausgabe mit Datum, Anlass, Empfängern, Formaten und Nachweis (L3.A1.AUS-04)."),
                 ("Verteiler", "Wer erhält was in welchem Format (L3.PLI.1-05)."),
                 ("Austausch", "Dateiformat, Nullpunkt, Höhenbezug, Layer- und Modellstruktur je Fachplanung (L3.PLI.1-06)."),
                 ("Ablage", "Projektbezogene Ordnerstruktur für Eingang und Ausgang, Fachplaner, Behörden, Protokolle (L3.PLI.1-04) – und was davon ins Office gehört.")]:
        put(ws, f"B{r}", k, font=F_BOLD); put(ws, f"C{r}", v); ws.merge_cells(f"C{r}:D{r}"); ws.row_dimensions[r].height = 28; r += 1
    r += 1
    quellen_rows(ws, r, ids={"HOAI-A10", "TBA-BIB", "ByAK-SSL"})
    page(ws, None, landscape=False)

    # Ausgaben (vor der Planliste gebaut, weil diese darauf verweist)
    ws = aus
    title(ws, "Ausgaben · Versandnachweis", "L3.A1.AUS-04 (Versand dokumentiert: Datum, Verteiler, Index) · je Ausgabe eine Zeile; die Planliste liest Datum und Anlass von hier", 10)
    put(ws, "A3", PL_PROJEKT, font=F_BOLD, border=False)
    header(ws, 6, ["Nr", "Datum", "Anlass", "Meilenstein · PSP", "Empfänger", "Formate", "Pläne und Dokumente (mit Index)", "Versandweg", "Nachweis (Ablageort)", "Bemerkung"],
           [5, 11, 36, 14, 30, 14, 40, 16, 26, 26])
    ausgaben = [
        ("Planungsgrundlagen an die Fachplaner (vorläufig)", "M01 · 01.07", "alle beauftragten Fachplaner", "PDF + DWG"),
        ("Planpaket Arbeitsstand 01 an den Auftraggeber", "01.03", "Auftraggeber", "PDF"),
        ("Planpaket Vorabzug 02 an den Auftraggeber", "01.08", "Auftraggeber", "PDF"),
        ("Bemusterungsunterlagen", "04.04", "Auftraggeber", "PDF"),
        ("Entscheidungsvorlage", "M04 · 03.04", "Auftraggeber", "PDF"),
        ("Maßgeblicher Planstand für die Endbeiträge der Fachplaner", "L3.KLA.2-05", "alle Fachplaner", "PDF + DWG"),
        ("Kostenberechnung", "M08 · 06.03", "Auftraggeber", "PDF"),
        ("Entwurfsdokumentation LPH 3", "M10 · 09.02", "Auftraggeber", "PDF"),
    ]
    for i in range(10):
        r = 7 + i
        put(ws, f"A{r}", i + 1, align=WRAPC)
        put(ws, f"B{r}", None, fill=FILL_IN, fmt=DATE)
        a = ausgaben[i] if i < len(ausgaben) else (None, None, None, None)
        put(ws, f"C{r}", a[0], font=F_PROP, fill=FILL_IN); put(ws, f"D{r}", a[1], font=F_PROP, fill=FILL_IN)
        put(ws, f"E{r}", a[2], font=F_PROP, fill=FILL_IN); put(ws, f"F{r}", a[3], font=F_PROP, fill=FILL_IN)
        for col in "GHIJ": put(ws, f"{col}{r}", None, fill=FILL_IN)
        ws.row_dimensions[r].height = 30
    for k in range(10, 30):
        r = 7 + k
        put(ws, f"A{r}", k + 1, align=WRAPC); put(ws, f"B{r}", None, fill=FILL_IN, fmt=DATE)
        for col in "CDEFGHIJ": put(ws, f"{col}{r}", None, fill=FILL_IN)
    dv_date(ws, "B7:B36")
    dv_list(ws, L["Übergabe"], "F7:F36")
    put(ws, "C38", "Die Planliste zeigt die ersten zehn Ausgaben als Spalten. Weitere Ausgaben hier fortführen und in der Planliste eine Spalte ergänzen.", font=F_SUB, border=False)
    ws.freeze_panes = "C7"
    page(ws, "6:6")

    # Planliste
    ws = pl
    title(ws, "Planliste", "L3.PLI.1 · alle vorgesehenen Pläne der LPH 3 · Plannummer aus dem Planschlüssel (Anleitung) · je Ausgabe der ausgegebene Index", 23)
    put(ws, "A3", PL_PROJEKT, font=F_BOLD, border=False)
    heads = ["Nr", "Plannummer", "Planart", "Geschoss · Bereich", "lfd. Nr", "Plantitel", "Maßstab", "Format", "zuständig", "Status", "Index",
             "Indexdatum", "Änderung zum letzten Index", "Bemerkung"]
    widths = [5, 18, 7, 9, 6, 34, 8, 8, 12, 16, 6, 11, 30, 22]
    for i in range(10):
        heads.append(f"Ausgabe {i+1}"); widths.append(9)
    header(ws, 6, heads, widths, height=30)
    # Kopfzeilen 4/5: Datum und Anlass der Ausgabe
    put(ws, "N4", "Datum der Ausgabe →", font=F_SUB, border=False, align=Alignment(horizontal="right"))
    put(ws, "N5", "Anlass →", font=F_SUB, border=False, align=Alignment(horizontal="right"))
    for i in range(10):
        col = get_column_letter(15 + i)
        put(ws, f"{col}4", f'=IF(Ausgaben!B{7+i}="","",Ausgaben!B{7+i})', fill=FILL_CALC, fmt="DD.MM.YY", align=WRAPC)
        put(ws, f"{col}5", f'=IF(Ausgaben!C{7+i}="","",Ausgaben!C{7+i})', font=Font(name=ARIAL, size=7, color=MUTED), fill=FILL_CALC, align=Alignment(wrap_text=True, vertical="top", horizontal="center"))
    ws.row_dimensions[5].height = 54
    plaene = [
        ("LP", "–", 1, "Lageplan", "1:500", ""),
        ("GR", "UG", 1, "Grundriss Untergeschoss", "1:100", "Geschosse je Projekt anpassen"),
        ("GR", "EG", 1, "Grundriss Erdgeschoss", "1:100", ""),
        ("GR", "1OG", 1, "Grundriss 1. Obergeschoss", "1:100", ""),
        ("GR", "DG", 1, "Grundriss Dachgeschoss", "1:100", ""),
        ("GR", "DA", 1, "Dachaufsicht", "1:100", ""),
        ("SC", "AA", 1, "Schnitt A-A", "1:100", ""),
        ("SC", "BB", 1, "Schnitt B-B", "1:100", ""),
        ("AN", "N", 1, "Ansicht Nord", "1:100", ""),
        ("AN", "O", 1, "Ansicht Ost", "1:100", ""),
        ("AN", "S", 1, "Ansicht Süd", "1:100", ""),
        ("AN", "W", 1, "Ansicht West", "1:100", ""),
        ("DT", "FAS", 1, "Fassade · Prinzipschnitt (L3.FAS.1)", "1:20", "bedingt: Themenpaket FAS"),
        ("TH", "BAD", 1, "Themenplan Bäder (L3.BAD.1)", "1:50", "bedingt: Themenpaket BAD"),
        ("TH", "TRE", 1, "Themenplan Treppen (L3.TRE.1)", "1:50", "bedingt: Themenpaket TRE"),
        ("TH", "LIC", 1, "Lichtkonzept (L3.LIC.1)", "1:100", "bedingt: Themenpaket LIC"),
        ("TH", "BOD", 1, "Belagsplan (L3.BOD.1)", "1:100", "bedingt: Themenpaket BOD"),
        ("TH", "MAP", 1, "Material- und Ausstattungsübersicht (L3.MAP.1)", "1:100", "Bemusterung"),
    ]
    r = 7
    for i, (art, ges, nr, titel, mst, bem) in enumerate(plaene + [(None,) * 6] * 22, start=1):
        put(ws, f"A{r}", i, align=WRAPC)
        put(ws, f"B{r}", f'=IF(F{r}="","",IF(Anleitung!$C$6="","(Kürzel)",Anleitung!$C$6)&Anleitung!$C$8&Anleitung!$C$7&Anleitung!$C$8&C{r}&IF(OR(D{r}="",D{r}="–"),"",Anleitung!$C$8&D{r})&Anleitung!$C$8&TEXT(E{r},"00"))', fill=FILL_CALC)
        put(ws, f"C{r}", art, font=F_PROP, fill=FILL_IN, align=WRAPC); put(ws, f"D{r}", ges, font=F_PROP, fill=FILL_IN, align=WRAPC)
        put(ws, f"E{r}", nr, font=F_PROP, fill=FILL_IN, align=WRAPC); put(ws, f"F{r}", titel, font=F_PROP, fill=FILL_IN)
        put(ws, f"G{r}", mst, font=F_PROP, fill=FILL_IN, align=WRAPC)
        for col in "HIKM": put(ws, f"{col}{r}", None, fill=FILL_IN)
        put(ws, f"J{r}", "in Bearbeitung" if art else None, font=F_PROP, fill=FILL_IN)
        put(ws, f"L{r}", None, fill=FILL_IN, fmt=DATE)
        put(ws, f"N{r}", bem or None, font=F_PROP, fill=FILL_IN)
        for k in range(10): put(ws, f"{get_column_letter(15+k)}{r}", None, fill=FILL_IN, align=WRAPC)
        r += 1
    last = r - 1
    dv_list(ws, L["Planart"], f"C7:C{last}")
    dv_list(ws, L["Status Plan"], f"J7:J{last}")
    dv_list(ws, L["Format"], f"H7:H{last}")
    dv_date(ws, f"L7:L{last}")
    ws.conditional_formatting.add(f"A7:N{last}", FormulaRule(formula=['OR($J7="ersetzt",$J7="entfällt")'], font=Font(name=ARIAL, size=9, color="A6A6A6", strike=True)))
    put(ws, f"F{last+2}", "Die Zeilen sind ein Vorschlag für eine typische LPH 3 (Lageplan, Grundrisse je Ebene, Schnitte, Ansichten, Themenpläne – L3.PLI.1-01). Nicht benötigte Pläne auf «entfällt» setzen.", font=F_SUB, border=False)
    ws.auto_filter.ref = f"A6:{get_column_letter(24)}{last}"
    ws.freeze_panes = "G7"
    page(ws, "4:6", a3=True)

    # Dokumente (Ergebnisregister der Bibliothek ohne Pläne)
    ws = dok
    title(ws, "Dokumente der LPH 3", "Ergebnisregister der Aufgabenbibliothek LPH 3 v0.3.4 ohne Pläne – je Ergebnis Stand, Index und Ablageort", 10)
    header(ws, 6, ["Code", "Ergebnis", "Zustände laut Bibliothek", "erzeugt durch", "Format", "zuständig", "aktueller Stand", "Index · Datum", "Ablageort", "Bemerkung"],
           [7, 36, 46, 22, 12, 14, 22, 14, 26, 24])
    plan_codes = {"GRU", "SCH", "ANS", "LAG", "BAD", "TRE", "FAS", "LIC", "BOD", "MAP"}
    r = 7
    for res in BIB["results"]:
        if res["code"] in plan_codes: continue
        states = " · ".join(f"{k}: {v}" for k, v in res["states"].items()) or "–"
        by = ", ".join(res["producedBy"].values()) or "–"
        put(ws, f"A{r}", res["code"], font=F_BOLD); put(ws, f"B{r}", res["name"]); put(ws, f"C{r}", states, font=F_SUB); put(ws, f"D{r}", by, font=F_SUB)
        for col in "EFGHIJ": put(ws, f"{col}{r}", None, fill=FILL_IN)
        ws.row_dimensions[r].height = 30; r += 1
    put(ws, f"B{r+1}", "Aus app/data/muster-planner-lph3-v0.3.json erzeugt. Ändert sich die Bibliothek, die Vorlage neu bauen (scripts/muster-lph3/build_xlsx.py).", font=F_SUB, border=False)
    ws.freeze_panes = "C7"
    page(ws, "6:6")

    # Verteiler
    ws = ver
    title(ws, "Verteiler", "L3.PLI.1-05 · wer erhält was in welchem Format · Spalten = Ausgaben aus dem Blatt Ausgaben", 10)
    header(ws, 6, ["Empfänger", "Büro · Rolle"] + [f"Ausgabe {i+1}" for i in range(8)], [22, 26] + [16] * 8, height=24)
    for i in range(8):
        col = get_column_letter(3 + i)
        put(ws, f"{col}5", f'=IF(Ausgaben!C{7+i}="","",Ausgaben!C{7+i})', font=Font(name=ARIAL, size=8, color=MUTED), fill=FILL_CALC, align=Alignment(wrap_text=True, vertical="top"))
    ws.row_dimensions[5].height = 54
    empf = [("Auftraggeber", ["–", "PDF", "PDF", "PDF", "PDF", "–", "PDF", "PDF"]),
            ("Tragwerksplanung (TWP)", ["PDF + DWG", "–", "PDF", "–", "–", "PDF + DWG", "–", "PDF"]),
            ("HLS", ["PDF + DWG", "–", "PDF", "–", "–", "PDF + DWG", "–", "PDF"]),
            ("ELT", ["PDF + DWG", "–", "PDF", "–", "–", "PDF + DWG", "–", "PDF"]),
            ("Bauphysik (BPH)", ["PDF + DWG", "–", "PDF", "PDF", "–", "PDF + DWG", "–", "PDF"]),
            ("Brandschutz (BRS)", ["PDF", "–", "PDF", "–", "–", "PDF", "–", "PDF"]),
            ("Freianlagen (FRA)", ["PDF + DWG", "–", "PDF", "–", "–", "PDF + DWG", "–", "PDF"]),
            ("Behörde (Vorabstimmung)", ["–", "–", "–", "–", "–", "–", "–", "–"]),
            ("Intern (Ablage)", ["PDF + DWG"] * 8)]
    r = 7
    for name, vals in empf + [(None, [None] * 8)] * 4:
        put(ws, f"A{r}", name, font=F_BOLD if name else F_BODY, fill=None if name else FILL_IN)
        put(ws, f"B{r}", None, fill=FILL_IN)
        for i, v in enumerate(vals):
            put(ws, f"{get_column_letter(3+i)}{r}", v, font=F_PROP, fill=FILL_IN, align=WRAPC)
        r += 1
    dv_list(ws, L["Übergabe"], f"C7:J{r-1}")
    put(ws, f"A{r+1}", "Vorschlag nach Muster-Terminplan LPH 3: Die Fachplaner erhalten Teilstände mit Austauschdatei (M01) und den maßgeblichen Planstand für ihre Endbeiträge (L3.KLA.2-05); der Auftraggeber erhält Prüfstände als PDF.", font=F_SUB, border=False)
    ws.freeze_panes = "C7"
    page(ws, "5:6")

    # Austausch
    ws = tau
    title(ws, "Austauschformate", "L3.PLI.1-06 · Dateiformat, Nullpunkt, Layer- bzw. Modellstruktur je Fachplanung · im Kick-off festlegen (Fragenliste ALLE-05)", 10)
    header(ws, 6, ["Fachplanung", "Dateiformat", "Version · Software", "Koordinaten · Nullpunkt (Lage)", "Höhenbezug ±0,00 = … m ü. NHN", "Layer- · Modellstruktur",
                   "Einheiten", "Übergabeweg (Plattform)", "vereinbart am", "Bemerkung"], [18, 14, 18, 28, 22, 28, 10, 22, 11, 26])
    r = 7
    for name in ["Architektur (Bezug für alle)", "Tragwerksplanung (TWP)", "HLS", "ELT", "Bauphysik (BPH)", "Brandschutz (BRS)", "Freianlagen (FRA)", "Vermessung (VER)", None, None]:
        put(ws, f"A{r}", name, font=F_BOLD if name else F_BODY, fill=None if name else FILL_IN)
        for col in "BCDEFGHJ": put(ws, f"{col}{r}", None, fill=FILL_IN)
        put(ws, f"I{r}", None, fill=FILL_IN, fmt=DATE)
        r += 1
    put(ws, "B7", "DWG und PDF; IFC bei Modellarbeit", font=F_PROP, fill=FILL_IN)
    put(ws, "D7", "Projektnullpunkt in Gebäudeachse A/1; Landeskoordinaten aus dem Lageplan", font=F_PROP, fill=FILL_IN)
    put(ws, "E7", "±0,00 = OK Fertigfußboden EG", font=F_PROP, fill=FILL_IN)
    put(ws, "G7", "m (Lageplan), cm (Pläne)", font=F_PROP, fill=FILL_IN)
    dv_date(ws, "I7:I16")
    ws.freeze_panes = "B7"
    page(ws, "6:6")

    # Ablage
    ws = abl
    title(ws, "Ablagestruktur des Projekts", "L3.PLI.1-04 · Eingang und Ausgang, Fachplaner, Behörden, Protokolle · Vorschlag, bis der Bürostandard ihn ersetzt", 5)
    header(ws, 6, ["Ordner", "Inhalt", "Regel", "ins Office (die KI liest mit)?", "Bemerkung"], [30, 46, 46, 16, 30])
    ablage = [
        ("01_Grundlagen", "Was von außen kommt: Vermessung, Baugrund, Bestand, Bebauungsplan, Satzungen, Raumprogramm", "Original unverändert ablegen; Eingangsdatum im Dateinamen", "ja"),
        ("02_Planung_Architektur/Arbeitsstand", "Laufende Planung (CAD, Arbeitsdateien)", "Nur intern; nicht versenden", "nein"),
        ("02_Planung_Architektur/Ausgang/JJMMTT_Anlass", "Je Ausgabe ein Ordner: Pläne als PDF und Austauschdatei, Anschreiben", "Nachträglich nicht verändern; Eintrag im Blatt Ausgaben", "ja"),
        ("03_Fachplaner/<Disziplin>/Eingang", "Beiträge der Fachplaner je Disziplin", "Eingangsdatum und Index im Dateinamen; Eintrag im Blatt Eingang der Koordinationsmappe", "ja"),
        ("03_Fachplaner/<Disziplin>/Ausgang", "Was an die Fachplaner ging", "Verweis auf die Ausgabe statt Kopie", "ja"),
        ("04_Behörden", "Vorabstimmungen, Stellungnahmen, Bescheide", "Ein Dokument je Vorgang mit Datum", "ja"),
        ("05_Protokolle", "Ein Protokoll je Termin: Projektauftakt, Kick-off, Koordination, Entscheidungsbesprechung", "Dateiname JJMMTT_Termin", "ja"),
        ("06_Schriftverkehr", "Projektbezogener Schriftverkehr, nach Beteiligten", "Entscheidungen und Fristen daraus in die Klärungs- bzw. Entscheidungsliste", "ja"),
        ("07_Kosten", "Kostenschätzung, Mengen, Kostenberechnung", "Stand und Datum im Dateinamen", "ja"),
        ("08_Termine", "Terminplan-Stände", "Der laufende Terminplan liegt im Office (Werkzeuge · Terminplan)", "ja"),
        ("09_Bemusterung", "Qualitäten, Produktvergleiche, Muster", "", "ja"),
        ("10_Vertrag_Honorar", "Verträge, Honorar, Nachträge", "Gehört nicht ins Office", "nein"),
    ]
    r = 7
    for ordner, inhalt, regel, office in ablage:
        put(ws, f"A{r}", ordner, font=F_PROP, fill=FILL_IN); put(ws, f"B{r}", inhalt, font=F_PROP, fill=FILL_IN)
        put(ws, f"C{r}", regel, font=F_PROP, fill=FILL_IN); put(ws, f"D{r}", office, font=F_PROP, fill=FILL_IN, align=WRAPC)
        put(ws, f"E{r}", None, fill=FILL_IN); ws.row_dimensions[r].height = 30; r += 1
    dv_list(ws, L["ja/nein"], f"D7:D{r-1}", strict=True)
    put(ws, f"A{r+1}", "«ins Office»: was im Schreibtisch des Projekts liegt, kann die KI lesen und daraus Fristen, Entscheidungen und offene Punkte vorschlagen. Vertragliches und Honorar gehören nicht hinein (projektstart.html, Kapitel 1).", font=F_SUB, border=False)
    page(ws, "6:6")

    wb.properties.creator = "TBA Office"; wb.properties.title = "Planliste LPH 3 · Bürovorlage"
    p = OUT / "LPH3_2_Planliste.xlsx"
    wb.save(p)
    return p


if __name__ == "__main__":
    for p in (koordination(), planliste()):
        print("geschrieben:", p.relative_to(REPO))
