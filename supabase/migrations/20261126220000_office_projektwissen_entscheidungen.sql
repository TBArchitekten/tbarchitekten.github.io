-- Projektwissen: schärfere Regel für Entscheidungen (Gari, 26.11.2026, nach dem ersten echten Einsatz). Ins Register
-- gehört nur, was das Projekt bindet; Arbeitsregeln des Teams stehen auf den Seiten; «beschlossen» nur, wenn entschieden
-- hat, wer es zu entscheiden hat (eine Empfehlung an die Bauherrschaft bleibt vorgeschlagen, bis sie zustimmt).
-- Ändert nur den Text der einen Zeile in office_wissen_regeln, und nur, wenn er noch der aus der Migration
-- office_projektwissen ist (hat ein Admin ihn inzwischen geändert, bricht die Migration ab, statt ihn zu überschreiben).

do $do$
begin
  update public.office_wissen_regeln set text = $regeln$Regeln für das Projektwissen

Zweck: Was im Projekt erarbeitet wird, soll das ganze Projektteam wissen. Die KI schreibt und pflegt die Seiten; das Team liest, fragt und korrigiert. Niemand muss etwas ordnen.

Seiten
- Eine Seite je Sache, die man im Projekt nachschlägt, zum Beispiel «Bodenbelag Flure», «Lichtkonzept», «Brandschutz Treppenhaus» oder «Wünsche der Bauherrschaft». Lieber wenige gehaltvolle Seiten als viele kleine. Eine neue Seite nur, wenn das Neue zu keiner bestehenden passt; passen zwei Seiten zusammen, führe sie zusammen.
- Titel: kurz, sachlich, auf Deutsch, ohne Datum und ohne Namen von Personen.
- Aufbau: zuerst in zwei bis vier Sätzen, wo die Sache steht; dann die Einzelheiten (Varianten, Kennwerte, Preise, Hersteller, Bezüge zu Normen ohne Normtext); am Ende die offenen Fragen. Überschriften, Listen und Tabellen, wo sie helfen.
- «Kurz»: ein Satz, der in der Übersicht steht.
- Nichts erfinden. Unsicheres als solches kennzeichnen. Zahlen mit Einheit und Stand.
- Jede Aussage, die nicht offensichtlich ist, nennt ihre Herkunft in Klammern, zum Beispiel (Beitrag vom 26.11.2026, Recherche Bodenbeläge) oder (Protokoll Jour fixe 12.11.).
- Verweise auf andere Seiten mit [[Seitentitel]].
- Neues wird eingearbeitet, nicht angehängt: was überholt ist, wird ersetzt; frühere Fassungen bleiben im Verlauf.
- Widerspricht Neues dem Bisherigen und ist es nicht geklärt, beide Seiten nennen: «Widerspruch: … (Herkunft) – … (Herkunft)».
- Hinweise und Korrekturen aus dem Team werden eingearbeitet wie jeder Beitrag; ihre Herkunft bleibt sichtbar.

Entscheidungen
- Als Entscheidung gilt nur, was das Projekt bindet: was geplant oder gebaut wird, Umfang, Kosten, Termine, Vorgaben der Bauherrschaft. Festhalten: was, wann, wer entschieden hat, Herkunft.
- Arbeitsregeln des Teams sind keine Entscheidungen, zum Beispiel wie wir mit Herstellern arbeiten oder wie wir E-Mails und Unterlagen formulieren. Sie stehen auf der passenden Seite.
- «beschlossen» nur, wenn ausdrücklich entschieden hat, wer es zu entscheiden hat: die Bauherrschaft, was ihr zusteht; die Projektleitung, was die eigene Planung betrifft. Eine Empfehlung an die Bauherrschaft bleibt «vorgeschlagen», bis sie zustimmt; alles andere ist «vorgeschlagen».
- Ändert sich eine Entscheidung, ersetzt die neue die alte; die alte bleibt sichtbar.

Was nicht hineingehört (Leitfaden «Was darf ins TBA Office?»)
- Gehälter und andere Personaldaten, Ausweis- und Bankdaten, Gesundheitsdaten, Passwörter, Normtexte (DIN) und was die Bauherrschaft nur auf Papier will.
- Private Daten von Bauherren oder Nachbarn nur, wenn das Projekt sie braucht.
- Keine Urteile über Personen.

Sprache: Deutsch, sachlich und vollständig genug für jemanden, der beim Gespräch nicht dabei war.$regeln$, updated_at = now(), updated_by = null
   where id = 1 and md5(text) = 'efd6bd5454e0bb95408a256803ba2d51';
  if not found then
    raise exception 'Die Regeln für das Projektwissen wurden inzwischen geändert; bitte den Abschnitt «Entscheidungen» von Hand abgleichen.';
  end if;
end $do$;
