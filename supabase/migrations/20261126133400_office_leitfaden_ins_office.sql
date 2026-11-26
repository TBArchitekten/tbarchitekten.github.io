-- TBA Office · Leitfaden «Was darf ins TBA Office?» (26.11.2026, Claude; Wunsch von Gari am 26.11.2026).
-- Die KI liest nicht nur den Desktop, sondern alles, was ins Office kommt: der Leitfaden gilt jetzt dafür. Neuer
-- Stand 2026-11-26; der Text steht in app/office-leitfaden.js. Der interne Schlüssel 'desktop' bleibt. Der Leitfaden
-- ist noch ausgeschaltet und niemand hat ihn bestätigt; ein neuer Stand verlangt ohnehin eine neue Bestätigung.
-- Nichts wird gelöscht.
update public.office_leitfaeden set version = '2026-11-26' where leitfaden = 'desktop' and version = '2026-11-25';
