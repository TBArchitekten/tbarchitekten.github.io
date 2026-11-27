-- TBA Office · Projektwissen: der Stand jeder Quelle (Gari, 27.11.2026, zu Dokumenten aus dem Desktop im Wissen:
-- «1. manda la fecha del contenido; 2. si la fecha no se sabe, se pregunta»). Ein altes Protokoll darf neueres Wissen
-- nicht überschreiben. Die Regeln gehen bei jedem Teilen an Claude und an die nächtliche Pflege; der neue Abschnitt
-- steht vor «Entscheidungen». Nur ergänzt, nichts entfernt; ein zweiter Lauf ändert nichts.
update public.office_wissen_regeln
   set text = replace(text, E'\n\nEntscheidungen\n', E'\n\nStand der Quellen\n'
     || E'- Es zählt das Datum des Inhalts, nicht das des Hochladens oder Teilens: das Datum des Protokolls, der E-Mail oder des Angebots, der Index und das Datum eines Plans. Nenne es in der Herkunft, zum Beispiel (Protokoll Jour fixe vom 12.11.2026) oder (Plan A-201, Index c vom 03.11.2026).\n'
     || E'- Eine ältere Quelle überschreibt nie eine neuere. Sagt ein älteres Dokument etwas anderes als eine neuere Aussage, bleibt die neuere stehen; die ältere erscheint höchstens als früherer Stand, zum Beispiel «bis 12.11.2026: …». Ein Widerspruch ist es nur, wenn beide gleich alt sind oder die Reihenfolge nicht feststeht.\n'
     || E'- Ist das Datum einer Quelle nicht zu erkennen: nicht raten. Die Aussage steht mit «Stand unklar» bei den offenen Fragen, und wer die Quelle teilt, wird gefragt, von wann sie ist.\n'
     || E'\nEntscheidungen\n'),
       updated_at = now()
 where id = 1 and position('Stand der Quellen' in text) = 0;
