# -*- coding: utf-8 -*-
"""Prüft die Aufgabenbibliothek LPH 3 gegen den Muster-Terminplan (Seed) und schreibt JSON (Seitenformat) und Excel-Matrix."""
import json, re, sys, datetime as dt
from collections import defaultdict, Counter
from lib import ERG, PARAM, BLOCKS, ABG, TASKS, C01_TITLES, G01_TITLES, C01_ENTFALLEN, M021_ENTFALLEN, G01_ENTFALLEN

# Aufruf aus dem Repo: python3 scripts/lph3-bibliothek/build.py [Ausgabeordner für Excel/Statistik]
# Schreibt app/data/muster-planner-lph3-v0.3.json und bricht bei jedem FEHLER der Prüfungen ab.
import os, pathlib, tempfile
REPO = str(pathlib.Path(__file__).resolve().parents[2])
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="lph3-bibliothek-")
os.makedirs(OUT, exist_ok=True)
VERSION, STAND = "0.3.1-draft", "2026-11-14"
TPL = "1.3"

# ───────── Muster-Terminplan (Seed der Seite)
tpl = [x for x in json.load(open(f"{REPO}/supabase/seed/terminplan-templates.json", encoding="utf-8")) if x["phase"] == "LPH3" and x["version"] == TPL][0]["state"]
gi = {g["id"]: g for g in tpl["groups"]}
cnt = Counter(); V = {}
for t in tpl["tasks"]:
    cnt[t["group"]] += 1
    m = re.match(r"(M\d+A?) · ", t["name"])
    V[t["id"]] = dict(id=t["id"], psp=f"{gi[t['group']]['wbs']}.{cnt[t['group']]:02d}", name=t["name"], typ=t["type"], owner=t["owner"],
                      start=dt.date.fromisoformat(t["start"]), end=dt.date.fromisoformat(t["end"]), ms=m.group(1) if m else None)
ORDER = [t["id"] for t in tpl["tasks"]]
muster = json.load(open(f"{REPO}/app/data/muster-planner-lph3-v0.2.json", encoding="utf-8"))
M021_TITLES = {t["id"]: t["title"] for b in muster["buckets"] for t in b["tasks"]}

def label(tid):
    v = V[tid]; return f"{v['psp']} ({v['ms']})" if v["ms"] else v["psp"]

# ───────── abgeleitete Felder
TB = {t["id"]: t for t in TASKS}
prod = {}
dup = []
for t in TASKS:
    for e in t["erzeugt"]:
        if e in prod: dup.append((e, prod[e], t["id"]))
        prod[e] = t["id"]
for t in TASKS:
    refs = list(t["vorgang"]) + list(t["wartet"]) + ([t["anker"][0]] if t["anker"] else [])
    t["bezug"] = sorted(set(refs), key=ORDER.index)
    t["psp"] = [V[r]["psp"] for r in t["bezug"]]
    if t["anker"]:
        v = V[t["anker"][0]]; t["ende"] = v[t["anker"][1]]
        t["beginn"] = min([V[x]["start"] for x in t["vorgang"]], default=None)
    else:
        t["ende"] = max(V[x]["end"] for x in t["vorgang"]); t["beginn"] = min(V[x]["start"] for x in t["vorgang"])
    t["bedingt"] = bool(t["bed"]) and not t["bed"].startswith("P-DIS")
used_by = defaultdict(list)
for t in TASKS:
    for b in t["braucht"]: used_by[b].append(t["id"])

# ───────── Prüfungen
P = []   # (Prüfung, Ergebnis, Detail)
def chk(name, bad, ok_detail="", info=False):
    P.append((name, "Hinweis" if (bad and info) else ("FEHLER" if bad else "OK"), "; ".join(map(str, bad)) if bad else ok_detail))

pat = re.compile(r"^L3\.([A-Z]{3}\.[1-3]|A[1-7]\.(PRF|AUS|ABS))$")
chk("Codes eindeutig und formgerecht (L3.<Objekt>.<Zustand>)", [t["id"] for t in TASKS if not pat.match(t["id"])] + [k for k, c in Counter(t["id"] for t in TASKS).items() if c > 1], f"{len(TASKS)} Codes")
ergdef = {f"{c}.{s}" for c, n, st, a in ERG for s in st}
abgst = {t["kurz"] for t in TASKS if t["schritt"] != "E"}
chk("Jeder erzeugte Ergebnisstand ist im Ergebnisregister definiert", [e for e in prod if e not in ergdef and e not in abgst], f"{len([e for e in prod if e in ergdef])} Ergebnisstände, {len(abgst)} Abgabe-Zustände")
chk("Jeder Ergebnisstand wird von genau einer Aufgabe erzeugt", dup + [e for e in ergdef if e not in prod], "kein Stand doppelt, keiner ohne Aufgabe")
chk("Jede Voraussetzung verweist auf einen erzeugten Ergebnisstand", [(t["id"], b) for t in TASKS for b in t["braucht"] if b not in prod], f"{sum(len(t['braucht']) for t in TASKS)} Verweise aufgelöst")
# Zyklen
color = {}
cyc = []
def dfs(u, path):
    color[u] = 1
    for b in TB[u]["braucht"]:
        w = prod.get(b)
        if not w or w == u: continue
        if color.get(w) == 1: cyc.append(" → ".join(path + [u, w]))
        elif w not in color: dfs(w, path + [u])
    color[u] = 2
for t in TASKS:
    if t["id"] not in color: dfs(t["id"], [])
chk("Abhängigkeiten ohne Zirkelbezug", cyc, "Graph ist zyklenfrei")
late = [f"{t['id']} ({t['ende']:%d.%m.}) braucht {b} aus {prod[b]} ({TB[prod[b]]['ende']:%d.%m.})" for t in TASKS for b in t["braucht"] if b in prod and TB[prod[b]]["ende"] > t["ende"]]
chk("Zeitliche Konsistenz: kein Ergebnis wird früher gebraucht, als es laut Muster-Terminplan fertig ist", late, "alle Voraussetzungen liegen terminlich vor dem Verbraucher")
waitlate = [f"{t['id']} ({t['ende']:%d.%m.}) wartet auf {w} ({V[w]['end']:%d.%m.})" for t in TASKS for w in t["wartet"] if V[w]["end"] > t["ende"]]
chk("Wartezeiten enden vor der Fälligkeit der wartenden Aufgabe", waitlate, "alle externen Vorgänge enden rechtzeitig")
cov = defaultdict(lambda: dict(aus=[], wartet=[], anker=[]))
for t in TASKS:
    for x in t["vorgang"]: cov[x]["aus"].append(t["id"])
    for x in t["wartet"]: cov[x]["wartet"].append(t["id"])
    if t["anker"]: cov[t["anker"][0]]["anker"].append(t["id"])
chk(f"Alle {len(ORDER)} Vorgänge des Muster-Terminplans sind einer Aufgabe zugeordnet (ausgeführt, Wartezeit oder Anker)", [f"{x} {V[x]['psp']}" for x in ORDER if x not in cov], f"{len(ORDER)} Vorgänge zugeordnet")
EXT = re.compile(r"^(Auftraggeber|Fachplaner|BRS|ELT|HLS|TWP)$")
chk("Vorgänge Dritter sind nie als Büroarbeit verknüpft", [f"{x} {V[x]['psp']} ({V[x]['owner']}) in {cov[x]['aus']}" for x in ORDER if EXT.match(V[x]["owner"]) and cov[x]["aus"] and x != "t001"],
    "nur 00.02 (t001) ist als fachliche Zuarbeit an den Auftraggeber verknüpft (L3.FPB.1)")
anat = []
for a in ABG:
    ts = [t for t in TASKS if t["abg"] == a["id"]]
    aus = [t for t in ts if t["schritt"] == "AUS"]; ab = [t for t in ts if t["schritt"] == "ABS"]; pr = [t for t in ts if t["schritt"] == "PRF"]
    if len(aus) != 1 or len(ab) != 1: anat.append(f"{a['id']}: AUS {len(aus)}, ABS {len(ab)}")
    if bool(a["pruefung"]) != bool(pr): anat.append(f"{a['id']}: PRF")
    if aus and a["ausgabe"] not in aus[0]["vorgang"]: anat.append(f"{a['id']}: Ausgabe-Meilenstein nicht in AUS")
    if ab and a["abschluss"] not in ab[0]["bezug"]: anat.append(f"{a['id']}: Abschluss-Meilenstein nicht in ABS")
    for e in a["liefer"] + a["abschluss_erg"]:
        if TB[prod[e]]["abg"] != a["id"]: anat.append(f"{a['id']}: {e} wird in {TB[prod[e]]['abg']} erzeugt")
chk("Jede Abgabe hat genau eine Ausgabe- und eine Abschluss-Karte; ihr Lieferumfang entsteht im eigenen Bucket", anat, "7 Abgaben mit gleicher Anatomie")
hoai = defaultdict(list)
for t in TASKS:
    for h in t["hoai"]: hoai[h].append(t["id"])
chk("HOAI Anlage 10 LPH 3: jede Grundleistung a) bis g) ist mindestens einer Aufgabe zugeordnet", [h for h in "abcdefg" if not hoai[h]], ", ".join(f"{h}) {len(hoai[h])}" for h in "abcdefg"))
nc = [len(t["checks"]) for t in TASKS]
chk("Checklisten: Länge nach Bedarf, höchstens 10 Punkte", [t["id"] for t in TASKS if len(t["checks"]) > 10], f"{sum(nc)} Prüfpunkte, je Karte {min(nc)} bis {max(nc)}; Verteilung {dict(sorted(Counter(nc).items()))}")
def old_cov(titles, key, entf):
    m = defaultdict(list)
    for t in TASKS:
        for o in t[key]: m[o].append(t["id"])
    return m, [o for o in titles if o not in m and o not in entf] + [o for o in m if o not in titles]
mc, bc = old_cov(C01_TITLES, "c01", C01_ENTFALLEN); mm, bm = old_cov(M021_TITLES, "m021", M021_ENTFALLEN); mg, bg = old_cov(G01_TITLES, "g01", G01_ENTFALLEN)
chk("Konkordanz vollständig: jede Karte der drei Vorversionen ist zugeordnet oder begründet entfallen", bc + bm + bg, f"Claude v0.1: {len(C01_TITLES)}, Muster v0.2.1: {len(M021_TITLES)}, ChatGPT v0.1: {len(G01_TITLES)}")
lue = [t["id"] for t in TASKS if t["luecke"]]
chk("Aufgaben ohne eigenen Vorgang im Muster-Terminplan (Lücke – Vorschlag: Vorgang ergänzen)", lue, "keine", info=True)
unused = sorted(e for e in prod if e in ergdef and e not in used_by and not any(e in a["liefer"] + a["abschluss_erg"] for a in ABG))
chk("Ergebnisstände, die weder Lieferumfang noch Voraussetzung sind (reine Arbeitsstände oder Abschlüsse)", unused, info=True)

errors = [p for p in P if p[1] == "FEHLER"]
for p in P: print(f"[{p[1]:7}] {p[0]}\n          {p[2][:400]}")
print("Karten", len(TASKS), "| Prüfpunkte", sum(nc), "| bedingt", sum(t["bedingt"] for t in TASKS), "| je Bucket", dict(Counter(t["abg"] for t in TASKS)))
if errors: sys.exit("FEHLER in der Bibliothek")

# ───────── JSON im Format der Seite (app/data/muster-planner-lph3-*.json) + Verknüpfungsfelder
SRC = {"E": "TBA-eigene Arbeit", "PRF": "TBA-eigene Prüfung und Freigabe", "AUS": "TBA-eigene Prüfung und Ausgabe", "ABS": "TBA-eigene Nachbereitung und Abschluss"}
STEP = {"E": "Erarbeiten", "PRF": "Prüfen", "AUS": "Ausgeben", "ABS": "Abschließen"}
def ref(tid, role):
    v = V[tid]; d = dict(taskId=tid, psp=v["psp"], role=role, name=v["name"], type=v["typ"])
    if v["typ"] == "milestone": d["date"] = v["end"].isoformat()
    else: d["dateStart"], d["dateEnd"] = v["start"].isoformat(), v["end"].isoformat()
    return d
jb = []
for a in ABG:
    refs = [ref(a["ausgabe"], "Ausgabe")] + ([ref(a["pruefung"], "Interne Prüfung")] if a["pruefung"] else []) + [ref(x, "Weiterer Meilenstein" if V[x]["typ"] == "milestone" else "Weiterer Vorgang") for x in a["weitere"]] + [ref(a["abschluss"], "Abschluss")]
    gate = "PSP " + " / ".join(([label(a["pruefung"])] if a["pruefung"] else []) + [label(a["ausgabe"])] + [label(x) for x in a["weitere"]] + [label(a["abschluss"])])
    jt = []
    for t in [t for t in TASKS if t["abg"] == a["id"]]:
        jt.append(dict(id=t["id"], title=t["title"], result=t["result"], checks=[c for c, b in t["checks"]],
            checkCodes=[f"{t['id']}-{i:02d}" for i in range(1, len(t["checks"]) + 1)], checkBlocks=[b for c, b in t["checks"]],
            psp=t["psp"], scope=t["scope"], owner=t["owner"], review=t["review"], participants=t["bet"], basis=t["basis"], effortHours=None,
            effortDrivers=t["treiber"], sourceType=SRC[t["schritt"]], step=STEP[t["schritt"]], labels=["Abgabe"] if t["schritt"] == "AUS" else [],
            produces=t["erzeugt"], requires=t["braucht"], hoai=t["hoai"], condition=t["bed"] or None, doneWhen=t["fertig"],
            schedule=dict(executes=t["vorgang"], waitsFor=t["wartet"], anchor=(dict(taskId=t["anker"][0], edge=t["anker"][1]) if t["anker"] else None),
                          templateStart=t["beginn"].isoformat() if t["beginn"] else None, templateEnd=t["ende"].isoformat(), noOwnActivity=t["luecke"]),
            origin=dict(claude_v01=t["c01"], muster_v021=t["m021"], chatgpt_v01=t["g01"], note=t["neu"])))
    jb.append(dict(id=a["id"], code="L3." + a["id"], title=a["title"], gate=gate, kind="Abgabe", recipient=a["empfaenger"], summary=a["summary"],
        plannerDescription=a["summary"], scheduleReferences=refs, deliverables=a["liefer"], closingResults=a["abschluss_erg"], note=a.get("hinweis"), tasks=jt))
lib = dict(id="tba-lph3-aufgabenbibliothek", version=VERSION, draft=True, phase="LPH3", updated=STAND,
    status="Entwurf zur gemeinsamen Prüfung · nicht freigegeben",
    reference=f"Muster-Terminplan LPH 3 v{TPL} / Claude v0.1 / ChatGPT v0.1 / Muster-Planner v0.2.1 / Entscheidungen Gari 13. und 14.11.2026",
    warning="Jeder Bucket ist eine Abgabe des Muster-Terminplans. Nur TBA-eigene Arbeit; Leistungen der Fachplaner und Prüfzeiten des Auftraggebers sind Wartezeit. Keine Stundenwerte. Termine des Musters sind keine Vertragsfristen.",
    coding=dict(pattern="L3.<Objekt>.<Zustand>", checkpoint="<Aufgabe>-NN", object="Arbeitsergebnis (3 Buchstaben, phasenunabhängig) oder Abgabe (A1 … A7)",
                state="Stand des Ergebnisses (1, 2, 3) oder Schritt der Abgabe (PRF, AUS, ABS)", rule="Eine Aufgabe trägt den Code des Ergebnisstands, den sie erzeugt. Codes werden nie neu vergeben."),
    steps=STEP, blocks=BLOCKS,
    results=[dict(code=c, name=n, states={str(s): b for s, b in st.items()}, toolHook=a,
                  producedBy={str(s): prod.get(f"{c}.{s}") for s in st}) for c, n, st, a in ERG],
    parameters=[dict(code=c, name=n, values=v, effect=e) for c, n, v, e in PARAM],
    retired=dict(claude_v01=C01_ENTFALLEN, muster_v021=M021_ENTFALLEN, chatgpt_v01=G01_ENTFALLEN),
    validation=[dict(check=n, result=r, detail=d) for n, r, d in P], buckets=jb)
json.dump(lib, open(f"{REPO}/app/data/muster-planner-lph3-v0.3.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# Gegenprobe: Loader der Seite (app/work.js renderPlanner, Vorschau) nachgebildet
assert lib["phase"] == "LPH3" and lib["draft"] is True and all(b["kind"] == "Abgabe" and b["gate"] for b in lib["buckets"])
for b in lib["buckets"]:
    for t in b["tasks"]:
        assert t["id"] and t["title"] and t["result"] and t["basis"] and t["owner"] and t["scope"] and t["psp"] and t["effortHours"] is None
        assert all(isinstance(s, str) and s.strip() for s in t["checks"]) and "TBA-eigene" in t["sourceType"]
print("JSON ok")

# ───────── Excel
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter as L
F = "Arial"
fn, fb, fh = Font(name=F, size=10), Font(name=F, size=10, bold=True), Font(name=F, size=10, bold=True, color="FFFFFF")
ft = Font(name=F, size=14, bold=True, color="1F3A5F")
fill_h, fill_r, fill_g = PatternFill("solid", fgColor="1F3A5F"), PatternFill("solid", fgColor="FFF2CC"), PatternFill("solid", fgColor="F2F2F2")
thin = Side(style="thin", color="BFBFBF"); box = Border(left=thin, right=thin, top=thin, bottom=thin)
wrap = Alignment(wrap_text=True, vertical="top")
ENT = '"Behalten,Ändern,Streichen,Bedingt"'
wb = Workbook()
def sheet(name, head, rows, widths, review=(), freeze="A2", dv=(), datecols=()):
    ws = wb.create_sheet(name); ws.append(head)
    for c in range(1, len(head) + 1):
        x = ws.cell(1, c); x.font, x.fill, x.alignment, x.border = fh, fill_h, Alignment(wrap_text=True, vertical="center"), box
    for r in rows: ws.append(r)
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=len(head)):
        for x in row:
            x.font, x.alignment, x.border = fn, wrap, box
            if x.column in review: x.fill = fill_r
            if x.column in datecols: x.number_format = "DD.MM.YY"
    for i, w in enumerate(widths, 1): ws.column_dimensions[L(i)].width = w
    ws.row_dimensions[1].height = 32; ws.freeze_panes = freeze; ws.auto_filter.ref = f"A1:{L(len(head))}{ws.max_row}"
    for c in dv:
        d = DataValidation(type="list", formula1=ENT, allow_blank=True); ws.add_data_validation(d); d.add(f"{L(c)}2:{L(c)}{ws.max_row}")
    return ws
J = lambda xs: ", ".join(xs) if xs else "–"
full = lambda e: ("L3." + e)
def who(e): return prod[e]

# System
ws = wb.active; ws.title = "System"
ws["A1"] = f"TBA Office · Aufgabenbibliothek LPH 3 · v{VERSION.split('-')[0]}"; ws["A1"].font = ft
rows = [
 ("Stand", f"{dt.date.fromisoformat(STAND):%d.%m.%Y} · {VERSION} · Entwurf zur Prüfung – nicht freigegeben. Verknüpft mit Muster-Terminplan LPH 3 v{TPL}. Ersetzt Claude v0.1, ChatGPT v0.1 und Muster-Planner v0.2.1."),
 ("Kette", "Terminplan-Vorgang → Abgabe (= Bucket) → Aufgabe → Prüfpunkt. Quer dazu das Ergebnisregister: Jede Aufgabe erzeugt Ergebnisstände und braucht Ergebnisstände anderer Aufgaben."),
 ("Kodierung", "L3.<Objekt>.<Zustand> – Objekt ist ein Arbeitsergebnis (3 Buchstaben, z. B. GRU = Grundrisse) oder eine Abgabe (A1 … A7). Zustand ist der Stand des Ergebnisses (1 = Arbeitsstand 01, 2 = Stand 02, 3 = Endstand; bei anderen Ergebnissen fortlaufend) oder der Schritt der Abgabe (PRF = intern prüfen, AUS = ausgeben, ABS = abschließen). Prüfpunkt: <Aufgabe>-NN, z. B. L3.GRU.1-03."),
 ("Regel 1", "Eine Aufgabe trägt den Code des Ergebnisstands, den sie erzeugt. L3.GRU.2 ist die Aufgabe „Grundrisse auf Stand 02 fortschreiben“ und zugleich deren Ergebnis."),
 ("Regel 2", "Jede Abgabe hat dieselbe Anatomie: Erarbeiten (mehrere Karten) → Ausgeben (genau eine Karte, Label „Abgabe“) → Abschließen (genau eine Karte). Eine Karte endet mit der letzten Handlung des Büros; Prüfzeiten Dritter sind Wartezeit und stehen als Voraussetzung an der folgenden Karte."),
 ("Regel 3", "Eine Aufgabe liegt in dem Bucket, dessen Abgabe ihr Ergebnis zuerst enthält. Spätere Abgaben verwenden den Ergebnisstand über „braucht“, ohne die Aufgabe zu wiederholen."),
 ("Regel 4", "Pläne werden nach Planart geteilt (Grundrisse, Schnitte, Ansichten, Lageplan), Vertiefungen nach Thema (Bäder, Treppen, Fassade, Licht …): ein Thema, eine Person."),
 ("Regel 5", "Checklisten haben so viele Punkte wie nötig (hier 4 bis 10). Wiederkehrende Routinen sind als Baustein markiert und werden zentral gepflegt."),
 ("Regel 6", "Codes sind stabil: Sie hängen nicht am Bucket, an der Reihenfolge oder an der PSP-Nummer. Ein gestrichener Code wird nicht neu vergeben. Neue Codes vergibt nur die Bibliothek, nie ein Projekt."),
 ("Regel 7", "Der Terminplan wird über die Vorgangs-ID (t…) verknüpft, nicht über PSP oder Titel. Je Aufgabe: „führt aus“ (eigener Vorgang), „wartet auf“ (Vorgang Dritter) und Fälligkeit."),
 ("Prüfen", "Gelbe Spalten: Behalten, Ändern, Streichen oder Bedingt wählen; Wortlaut oder Bedingung daneben. Blatt „Prüfprotokoll“ zeigt die maschinelle Prüfung der Verknüpfungen."),
]
for i, (k, v) in enumerate(rows, 3):
    ws.cell(i, 1, k).font = fb; c = ws.cell(i, 2, v); c.font = fn; c.alignment = wrap; ws.cell(i, 1).alignment = wrap
    ws.merge_cells(start_row=i, start_column=2, end_row=i, end_column=8)
    ws.row_dimensions[i].height = 15 * max(1, -(-len(v) // 150))
ws.column_dimensions["A"].width = 16
for col in "BCDEFGH": ws.column_dimensions[col].width = 24
r0 = 3 + len(rows) + 1
nT, nC = len(TASKS), sum(nc)
ws.cell(r0, 1, "Stand der Prüfung").font = fb
for j, h in enumerate(["Ebene", "Anzahl", "Behalten", "Ändern", "Streichen", "Bedingt", "offen"]):
    c = ws.cell(r0 + 1, 1 + j, h); c.font, c.fill, c.border = fh, fill_h, box
for i, (lab, sh, col, n) in enumerate([("Abgaben / Buckets", "Abgaben", "L", len(ABG)), ("Aufgaben", "Aufgaben", "Y", nT), ("Prüfpunkte", "Checklisten", "F", nC)]):
    r = r0 + 2 + i
    ws.cell(r, 1, lab); ws.cell(r, 2, f"=COUNTA('{sh}'!A2:A{n + 1})")
    for j, val in enumerate(["Behalten", "Ändern", "Streichen", "Bedingt"]): ws.cell(r, 3 + j, f"=COUNTIF('{sh}'!{col}2:{col}{n + 1},\"{val}\")")
    ws.cell(r, 7, f"=B{r}-SUM(C{r}:F{r})")
    for j in range(1, 8): ws.cell(r, j).font, ws.cell(r, j).border = fn, box
r1 = r0 + 7
ws.cell(r1, 1, "Kennzahlen").font = fb
for j, h in enumerate(["Abgabe", "Karten", "mit Bedingung", "Prüfpunkte"]):
    c = ws.cell(r1 + 1, 1 + j, h); c.font, c.fill, c.border = fh, fill_h, box
for i, a in enumerate(ABG):
    r = r1 + 2 + i
    ws.cell(r, 1, a["id"]); ws.cell(r, 2, f"=COUNTIF(Aufgaben!$B$2:$B${nT + 1},A{r})")
    ws.cell(r, 3, f"=COUNTIFS(Aufgaben!$B$2:$B${nT + 1},A{r},Aufgaben!$T$2:$T${nT + 1},\"<>\")")
    ws.cell(r, 4, f"=SUMIF(Aufgaben!$B$2:$B${nT + 1},A{r},Aufgaben!$AA$2:$AA${nT + 1})")
    for j in range(1, 5): ws.cell(r, j).font, ws.cell(r, j).border = fn, box
r = r1 + 2 + len(ABG)
ws.cell(r, 1, "Summe"); ws.cell(r, 2, f"=SUM(B{r1 + 2}:B{r - 1})"); ws.cell(r, 3, f"=SUM(C{r1 + 2}:C{r - 1})"); ws.cell(r, 4, f"=SUM(D{r1 + 2}:D{r - 1})")
for j in range(1, 5): ws.cell(r, j).font, ws.cell(r, j).border = fb, box
opt = [t["kurz"] for t in TASKS if t["bedingt"]]; dis = sum(1 for t in TASKS if t["bed"].startswith("P-DIS"))
ws.cell(r + 1, 1, f"Mit Bedingung: Die Karte wird nur angelegt, wenn der Projektparameter zutrifft. {dis} Karten hängen nur an P-DIS (Fachplaner beteiligt) und sind im Regelfall aktiv; {len(opt)} Karten sind echte Optionen ({', '.join(opt)}).").font = Font(name=F, size=9, italic=True)

# Abgaben
rows = []
for a in ABG:
    ts = [t for t in TASKS if t["abg"] == a["id"]]
    rows.append(["L3." + a["id"], a["id"] + " · " + a["title"], a["empfaenger"],
        f"{label(a['ausgabe'])} · {a['ausgabe']}", V[a["ausgabe"]]["end"] if V[a["ausgabe"]]["typ"] == "milestone" else V[a["ausgabe"]]["start"],
        f"{label(a['abschluss'])} · {a['abschluss']}", V[a["abschluss"]]["end"],
        (f"{label(a['pruefung'])} · {a['pruefung']}" if a["pruefung"] else "–"),
        J(a["liefer"]), J(a["abschluss_erg"]), a["summary"] + (" – " + a["hinweis"] if a.get("hinweis") else ""), None, None, len(ts), sum(len(t["checks"]) for t in ts)])
sheet("Abgaben", ["Abgabe-Code", "Bucket", "Empfänger", "Ausgabe (PSP · Vorgangs-ID)", "Ausgabe Mustertermin", "Abschluss (PSP · Vorgangs-ID)", "Abschluss Mustertermin",
      "Interne Prüfung", "Lieferumfang (Ergebnisstände)", "Ergebnis des Abschlusses", "Beschreibung / Hinweis", "Entscheidung", "Änderung / Kommentar", "Karten", "Prüfpunkte"],
      rows, [12, 40, 18, 22, 12, 22, 12, 18, 40, 20, 70, 14, 40, 8, 11], review=(12, 13), dv=(12,), datecols=(5, 7))

# Aufgaben
rows = []
for t in TASKS:
    rows.append([t["id"], t["abg"], STEP[t["schritt"]], t["title"], t["result"], J(t["erzeugt"]), J(t["braucht"]),
        J([prod[b] for b in t["braucht"]]), J(t["vorgang"]), J([V[x]["psp"] for x in t["vorgang"]]), J(t["wartet"]), J([V[x]["psp"] for x in t["wartet"]]),
        t["beginn"], t["ende"], "ja – Vorgang ergänzen" if t["luecke"] else "", J([h + ")" for h in t["hoai"]]), t["owner"], t["review"], t["bet"],
        t["bed"], t["scope"], t["fertig"], t["treiber"], t["basis"], None, None, len(t["checks"]),
        J(t["c01"]), J(t["m021"]), J(t["g01"]), t["neu"] or ""])
sheet("Aufgaben", ["Code", "Abgabe", "Schritt", "Aufgabe", "Arbeitsergebnis", "erzeugt (Ergebnisstände)", "braucht (Ergebnisstände)", "braucht – erzeugt durch",
      "führt aus (Vorgangs-ID)", "führt aus (PSP)", "wartet auf (Vorgangs-ID)", "wartet auf (PSP)", "Beginn laut Muster", "Fällig laut Muster", "Lücke im Terminplan",
      "HOAI LPH 3", "Verantwortlich", "Prüfung / Freigabe", "Beteiligte", "Bedingung (Projektparameter)", "Anwendbarkeit", "Fertigstellungskriterium",
      "Aufwandstreiber", "Fundierung (R/H/V/E/I)", "Entscheidung", "Änderung / Kommentar", "Prüfpunkte", "war in Claude v0.1", "war im Muster v0.2.1", "war in ChatGPT v0.1", "Hinweis"],
      rows, [12, 8, 12, 46, 50, 22, 26, 30, 14, 12, 16, 14, 11, 11, 16, 10, 26, 22, 26, 20, 30, 50, 36, 50, 14, 40, 10, 22, 26, 26, 22],
      review=(25, 26), freeze="E2", dv=(25,), datecols=(13, 14))

# Checklisten
rows = [[f"{t['id']}-{i:02d}", t["id"], t["title"], c, b or "", None, None, t["abg"], STEP[t["schritt"]]] for t in TASKS for i, (c, b) in enumerate(t["checks"], 1)]
sheet("Checklisten", ["Prüfpunkt-Code", "Aufgabe", "Aufgabentitel", "Prüfpunkt", "Baustein", "Entscheidung", "Änderung / Kommentar", "Abgabe", "Schritt"],
      rows, [16, 12, 44, 92, 10, 14, 46, 8, 12], review=(6, 7), freeze="D2", dv=(6,))

# Ergebnisse
rows = []
for c, n, st, a in ERG:
    if not st: rows.append([c, c, n, "laufend", "ein datierter Stand je Ausgabe", "alle Ausgabe- und Abschluss-Karten", "A1–A7", "–", "–", a, None]); continue
    for s, bez in st.items():
        e = f"{c}.{s}"; p = prod[e]
        rows.append([full(e), c, n, s, bez, p, TB[p]["abg"], J(used_by.get(e, [])), J([x["id"] for x in ABG if e in x["liefer"] + x["abschluss_erg"]]), a, None])
ws = sheet("Ergebnisse", ["Ergebnisstand", "Ergebnis", "Bezeichnung", "Stand", "Bedeutung des Stands", "erzeugt durch", "in Abgabe", "gebraucht von", "Lieferumfang von", "Andockpunkt für Werkzeuge (Vorschlag)", "Kommentar"],
      rows, [14, 9, 44, 8, 44, 14, 10, 50, 14, 34, 36], review=(11,))

# Terminplan
rows = []
for x in ORDER:
    v = V[x]; c = cov[x]
    role = ("Abgabe: Ausgabe " + J([a["id"] for a in ABG if a["ausgabe"] == x]) if any(a["ausgabe"] == x for a in ABG) else
            "Abgabe: Abschluss " + J([a["id"] for a in ABG if a["abschluss"] == x]) if any(a["abschluss"] == x for a in ABG) else
            "Büro führt aus" if c["aus"] else "Wartezeit (Dritte)" if c["wartet"] else "Fälligkeitsanker")
    rows.append([x, v["psp"], v["name"], "Meilenstein" if v["typ"] == "milestone" else "Vorgang", v["owner"], v["start"], v["end"], role, J(c["aus"]), J(c["wartet"] + c["anker"]), None])
sheet("Terminplan", ["Vorgangs-ID", "PSP", f"Vorgang (Muster-Terminplan v{TPL})", "Typ", "Verantwortlich", "Anfang", "Ende", "Rolle im System", "ausgeführt durch (Aufgaben)", "Voraussetzung / Anker für", "Kommentar"],
      rows, [11, 8, 66, 12, 24, 11, 11, 24, 40, 34, 34], review=(11,), datecols=(6, 7))

# Konkordanz
KEY = {"Claude v0.1": "c01", "Muster-Planner v0.2.1": "m021", "ChatGPT v0.1": "g01"}
rows = []
for src, titles, m, entf in [("Claude v0.1", C01_TITLES, mc, C01_ENTFALLEN), ("Muster-Planner v0.2.1", M021_TITLES, mm, M021_ENTFALLEN), ("ChatGPT v0.1", G01_TITLES, mg, G01_ENTFALLEN)]:
    for o, ti in titles.items():
        new = m.get(o, []); key = KEY[src]
        if o in entf: art, bem = "entfallen", entf[o]
        elif len(new) > 1: art, bem = "geteilt", ""
        else:
            mit = [x for x in TB[new[0]][key] if x != o]
            art, bem = ("1 : 1", "") if not mit else ("zusammengeführt", "zusammen mit " + ", ".join(mit))
        rows.append([src, o, ti, J(new), art, bem])
sheet("Konkordanz", ["Vorversion", "Alte ID", "Alter Titel", "Neue Codes v0.3", "Art", "Bemerkung"], rows, [22, 12, 70, 44, 16, 70])

# Parameter, Bausteine
rows = [[c, n, v, e, J([t["id"] for t in TASKS if c in t["bed"]])] for c, n, v, e in PARAM]
ws = sheet("Parameter", ["Parameter", "Bezeichnung", "Werte", "Wirkung", "Karten mit dieser Bedingung"], rows, [10, 44, 28, 80, 50])
n = ws.max_row + 2
ws.cell(n, 1, "Checklisten-Bausteine").font = fb
for i, (k, v) in enumerate(BLOCKS.items(), 1):
    ws.cell(n + i, 1, k).font = fb; ws.cell(n + i, 2, v).font = fn
    ws.cell(n + i, 3, f"=COUNTIF(Checklisten!$E$2:$E${nC + 1},A{n + i})").font = fn; ws.cell(n + i, 4, "Prüfpunkte mit diesem Baustein (Spalte C)").font = Font(name=F, size=9, italic=True)

# Prüfprotokoll
sheet("Prüfprotokoll", ["Maschinelle Prüfung", "Ergebnis", "Detail"], [list(p) for p in P], [80, 12, 120])
wb.save(f"{OUT}/TBA_Aufgabenbibliothek_LPH3_v0.3.1_Matrix.xlsx")
json.dump(dict(n_tasks=nT, n_checks=nC, per_bucket=dict(Counter(t["abg"] for t in TASKS)), checks_per_bucket={a["id"]: sum(len(t["checks"]) for t in TASKS if t["abg"] == a["id"]) for a in ABG},
               bedingt=[t["id"] for t in TASKS if t["bedingt"]], dist=dict(sorted(Counter(nc).items())), validation=P), open(f"{OUT}/stats.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)
print("xlsx ok:", OUT)
