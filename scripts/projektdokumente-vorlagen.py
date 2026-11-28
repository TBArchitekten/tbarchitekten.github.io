#!/usr/bin/env python3
"""TBA Office · Vorbelegung der Projektlisten aus den Bürovorlagen LPH 3 (28.11.2026, Claude, Auftrag Gari: die Listen
des Projektstarts im Projekt bearbeiten wie die Entscheidungsliste, statt ein Excel herunterzuladen).

Liest muster/lph3/LPH3_3_Koordination.xlsx und LPH3_2_Planliste.xlsx und schreibt projektdokumente-vorlagen.js: die
Zeilen, mit denen eine Liste im Projekt angelegt wird (Fragenliste, Fachplanerbedarf, Schnittstellen, Eingang; Planliste,
Dokumente, Ausgaben, Verteiler, Austausch, Ablage). Nur Werte, keine Formeln: was die Vorlage aus anderen Blättern
rechnet, rechnet die Liste im Office selbst (Termine aus den Meilensteinen des Terminplans, «Zuständigkeit eindeutig?»,
«Stand», die Plannummer aus dem Planschlüssel). Wo eine Formel einen Text aus den Projektparametern zusammensetzt, steht
hier die allgemeine Regel, die die Formel anwendet.

Aufruf: python3 scripts/projektdokumente-vorlagen.py  (aus dem Wurzelverzeichnis des Repos)
"""
import json, re, sys
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
KOORD = ROOT / 'muster/lph3/LPH3_3_Koordination.xlsx'
PLAN = ROOT / 'muster/lph3/LPH3_2_Planliste.xlsx'
ZIEL = ROOT / 'projektdokumente-vorlagen.js'


def text(v):
    if v is None:
        return ''
    if isinstance(v, str) and v.startswith('='):
        raise ValueError('Formel statt Wert: ' + v[:80])
    return str(v).strip()


def wert(v):
    """Wert einer Zelle, Formeln ergeben leer."""
    if isinstance(v, str) and v.startswith('='):
        return ''
    return text(v)


def fragenliste(wb):
    ws = wb['Fragenliste']
    zeilen = []
    for r in range(7, ws.max_row + 1):
        frage = wert(ws.cell(r, 5).value)
        if not frage:
            continue
        zeilen.append({
            'code': text(ws.cell(r, 1).value), 'disziplin': text(ws.cell(r, 2).value), 'wer': text(ws.cell(r, 3).value),
            'thema': text(ws.cell(r, 4).value), 'frage': frage, 'zweck': text(ws.cell(r, 6).value),
            'grundlage': text(ws.cell(r, 7).value), 'bis': text(ws.cell(r, 8).value), 'status': text(ws.cell(r, 13).value) or 'offen',
        })
    return zeilen


# Was die Formeln in «In der Regel erforderlich, wenn …» aus dem Blatt «Projekt» ergänzen, als allgemeine Regel.
FPB_REGEL = {
    'TWP': 'Bei Neubau und Eingriffen ins Tragwerk praktisch immer. Nachweis: bei Wohngebäuden der Gebäudeklassen 1 und 2 '
           'weder Bescheinigung noch Prüfung; ab Gebäudeklasse 4 Bescheinigung durch Prüfsachverständige, bei Sonderbau '
           'Prüfung; in Gebäudeklasse 3 nach dem Kriterienkatalog (Anlage 2 BauVorlV) (Art. 62a Abs. 2 BayBO).',
    'BRS': 'Sonderbau, GK 5, Mittel- oder Großgarage: Nachweis wird geprüft oder bescheinigt. Sonst kann die Objektplanung '
           'den Nachweis als Bauvorlageberechtigte erstellen.',
    'PRÜF': 'Standsicherheit nach Art. 62a Abs. 2, Brandschutz nach Art. 62b Abs. 2 BayBO, je nach Gebäudeklasse, '
            'Sonderbau und Garage.',
    'SIG': 'Wenn Beschäftigte mehrerer Arbeitgeber auf der Baustelle zu erwarten sind: Der Bauherr bestellt einen '
           'Koordinator, schon für die Planung der Ausführung (SiGe-Plan, Unterlage für spätere Arbeiten).',
}


def fachplanerbedarf(wb):
    ws = wb['Fachplanerbedarf']
    zeilen = []
    for r in range(7, ws.max_row + 1):
        disziplin = text(ws.cell(r, 2).value)
        # Nur die nummerierten Zeilen; darunter steht eine Fußnote zur Spalte O.
        if not disziplin or not isinstance(ws.cell(r, 1).value, (int, float)):
            continue
        kuerzel = text(ws.cell(r, 3).value)
        regel = ws.cell(r, 5).value
        if isinstance(regel, str) and regel.startswith('='):
            if kuerzel not in FPB_REGEL:
                raise ValueError('Regel fehlt für ' + kuerzel)
            regel = FPB_REGEL[kuerzel]
        zeilen.append({
            'disziplin': disziplin, 'kuerzel': kuerzel, 'leistungsbild': text(ws.cell(r, 4).value), 'regel': text(regel),
            'erforderlich': wert(ws.cell(r, 6).value), 'begruendung': wert(ws.cell(r, 7).value), 'beauftragt': wert(ws.cell(r, 8).value),
            'buero': wert(ws.cell(r, 9).value), 'lph': wert(ws.cell(r, 10).value), 'umfang': text(ws.cell(r, 11).value),
            'abgrenzung': wert(ws.cell(r, 12).value), 'bewertung': wert(ws.cell(r, 14).value),
            # Die Vorlage nimmt das Datum von M00A («Erforderliche Fachplaner beauftragt»).
            'bis': 'M00A', 'status': text(ws.cell(r, 16).value) or 'offen',
        })
    return zeilen


SSM_SPALTEN = {4: 'z_ag', 5: 'z_beh', 6: 'z_arch', 7: 'z_twp', 8: 'z_hls', 9: 'z_elt', 10: 'z_bph', 11: 'z_brs', 12: 'z_geo', 13: 'z_ver', 14: 'z_fra'}


def schnittstellen(wb):
    ws = wb['Schnittstellen']
    zeilen, gruppe = [], ''
    for r in range(7, ws.max_row + 1):
        a, thema = ws.cell(r, 1).value, text(ws.cell(r, 2).value)
        if not thema:
            if isinstance(a, str) and re.match(r'^[A-Z] · ', a):
                gruppe = re.split(r' – | \(', a)[0].strip()
            continue
        z = {'gruppe': gruppe, 'thema': thema, 'kg': text(ws.cell(r, 3).value)}
        for c, key in SSM_SPALTEN.items():
            z[key] = text(ws.cell(r, c).value)
        # «Zuständigkeit eindeutig?» rechnet die Vorlage nur für die Themen und Bauteile; bei Grundlagen und Zuarbeit
        # steht «–» (dort liefern oder planen mehrere, das ist gewollt).
        if ws.cell(r, 15).value == '–':
            z['eindeutig'] = '–'
        z.update({'liefert': text(ws.cell(r, 16).value), 'format': text(ws.cell(r, 17).value), 'lieferung1': text(ws.cell(r, 18).value),
                  'lieferung2': text(ws.cell(r, 20).value), 'zweck': text(ws.cell(r, 22).value), 'grundlage': text(ws.cell(r, 23).value),
                  'status': text(ws.cell(r, 24).value) or 'v0 Vorschlag', 'bemerkung': text(ws.cell(r, 25).value)})
        zeilen.append(z)
    return zeilen


def eingang(wb):
    ws = wb['Eingang']
    zeilen = []
    for r in range(7, ws.max_row + 1):
        disziplin = text(ws.cell(r, 1).value)
        # Nur Zeilen mit einem Kürzel der Disziplin; darunter steht ein Hinweis zur Vorlage.
        if not re.match(r'^[A-ZÄÖÜ]{2,5}$', disziplin):
            continue
        zeilen.append({'disziplin': disziplin, 'buero': wert(ws.cell(r, 2).value), 'umfang01': text(ws.cell(r, 3).value),
                       'erwartet01': 'M03', 'umfang_end': text(ws.cell(r, 9).value), 'erwartet_end': 'M07'})
    return zeilen


def zeilen_aus(ws, spalten, pflicht, erste=7):
    """Zeilen eines Blatts ab Zeile 7: je Spalte (Nummer) ein Feld; nur Zeilen, in denen das Pflichtfeld steht."""
    out = []
    for r in range(erste, ws.max_row + 1):
        z = {key: wert(ws.cell(r, c).value) for c, key in spalten.items()}
        if not z[pflicht]:
            continue
        out.append(z)
    return out


def planliste(wb):
    ws = wb['Planliste']
    # Die Plannummer (Spalte B) ist eine Formel aus dem Planschlüssel; die Liste rechnet sie selbst.
    # Nur Zeilen mit Planart; darunter steht ein Hinweis zur Vorlage.
    zeilen = zeilen_aus(ws, {3: 'planart', 4: 'geschoss', 5: 'lfd', 6: 'titel', 7: 'massstab', 8: 'format', 9: 'zustaendig', 10: 'status',
                             11: 'index', 13: 'aenderung', 14: 'bemerkung'}, 'planart')
    for z in zeilen:
        z['status'] = z['status'] or 'in Bearbeitung'
    return zeilen


def dokumente(wb):
    return zeilen_aus(wb['Dokumente'], {1: 'code', 2: 'ergebnis', 3: 'zustaende', 4: 'erzeugt', 5: 'format', 6: 'zustaendig', 7: 'stand',
                                        8: 'index', 9: 'ablageort', 10: 'bemerkung'}, 'code')


def ausgaben(wb):
    ws = wb['Ausgaben']
    # Nur nummerierte Zeilen mit Anlass; darunter steht ein Hinweis zur Vorlage.
    return [z for r, z in ((r, {key: wert(ws.cell(r, c).value) for c, key in {3: 'anlass', 4: 'meilenstein', 5: 'empfaenger', 6: 'formate',
            7: 'inhalt', 8: 'versandweg', 9: 'nachweis', 10: 'bemerkung'}.items()}) for r in range(7, ws.max_row + 1))
            if z['anlass'] and isinstance(ws.cell(r, 1).value, (int, float))]


def verteiler(wb):
    ws = wb['Verteiler']
    spalten = {1: 'empfaenger', 2: 'buero', **{3 + i: 'a' + str(i + 1) for i in range(8)}}
    # Nur die Empfänger; darunter steht ein Hinweis zur Vorlage (eine Zeile ohne Ausgaben).
    return [z for z in zeilen_aus(ws, spalten, 'empfaenger') if any(z['a' + str(i + 1)] for i in range(8))]


def austausch(wb):
    return zeilen_aus(wb['Austausch'], {1: 'fachplanung', 2: 'dateiformat', 3: 'version', 4: 'nullpunkt', 5: 'hoehe', 6: 'struktur',
                                        7: 'einheiten', 8: 'weg', 10: 'bemerkung'}, 'fachplanung')


def ablage(wb):
    # Nur Zeilen mit einer Angabe «ins Office»; darunter steht ein Hinweis zur Vorlage.
    return [z for z in zeilen_aus(wb['Ablage'], {1: 'ordner', 2: 'inhalt', 3: 'regel', 4: 'office', 5: 'bemerkung'}, 'ordner') if z['office']]


def main():
    wb = openpyxl.load_workbook(KOORD)
    pl = openpyxl.load_workbook(PLAN)
    daten = {'fragenliste': fragenliste(wb), 'fachplanerbedarf': fachplanerbedarf(wb),
             'schnittstellen': schnittstellen(wb), 'eingang': eingang(wb),
             'planliste': planliste(pl), 'dokumente': dokumente(pl), 'ausgaben': ausgaben(pl), 'verteiler': verteiler(pl),
             'austausch': austausch(pl), 'ablage': ablage(pl)}
    for art, z in daten.items():
        for zeile in z:
            for k, v in zeile.items():
                if isinstance(v, str) and v.startswith('='):
                    sys.exit('Formel in ' + art + '.' + k)
    kopf = ('/* TBA Office · Vorbelegung der Projektlisten aus den Bürovorlagen LPH 3. Erzeugt von\n'
            '   scripts/projektdokumente-vorlagen.py aus muster/lph3/LPH3_3_Koordination.xlsx und LPH3_2_Planliste.xlsx;\n'
            '   nicht von Hand ändern.\n'
            '   Eine Liste im Projekt wird auf Wunsch mit diesen Zeilen angelegt; danach gehört sie dem Projekt. */\n')
    teile = []
    for art, z in daten.items():
        teile.append(json.dumps(art) + ':[\n' + ',\n'.join(json.dumps(x, ensure_ascii=False, separators=(',', ':')) for x in z) + '\n]')
    js = kopf + '(function(root,daten){if(typeof module===\'object\'&&module.exports)module.exports=daten;else root.TBA_PD_VORLAGEN=daten})(typeof self!==\'undefined\'?self:this,{\n' + \
        ',\n'.join(teile) + '\n});\n'
    ZIEL.write_text(js, encoding='utf-8')
    print({k: len(v) for k, v in daten.items()})


if __name__ == '__main__':
    main()
