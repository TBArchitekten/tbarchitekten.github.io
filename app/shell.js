const navIcon = paths => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+paths+'</svg>';
const NAV_ICONS = ({
  feed:navIcon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>'),
  assistant:navIcon('<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>'),
  calendar:navIcon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>'),
  work:navIcon('<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/>'),
  readings:navIcon('<path d="M12 21V5a4 4 0 0 0-4-2H3v16h5a4 4 0 0 1 4 2zm0 0V5a4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2z"/>'),
  thoughts:navIcon('<path d="m12 2 9 5-9 5-9-5 9-5zM3 7v10l9 5 9-5V7M12 12v10"/>'),
  bandeja:navIcon('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>')
});
// TBA Office: Window's frame in German. Chat, Eingang, Lecturas and Thoughts stay in the page (the copied code
// expects their elements) but are hidden until the office has an assistant. Tools links to the office tools.
NAV_ICONS.tools='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
// Produktbibliothek: Musterfächer, im Strich der übrigen Symbole.
NAV_ICONS.produkte='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z"/><path d="M16.7 13H19a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7"/><path d="M7 17h.01"/><path d="m11 8 2.3-2.3a2.4 2.4 0 0 1 3.4 0l1.9 1.9a2.4 2.4 0 0 1 0 3.4L9.9 19.8"/></svg>';
// Herstellerkatalog: Kontaktkarte, im Strich der übrigen Symbole.
NAV_ICONS.hersteller='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17a3.5 3.5 0 0 1 7 0"/><path d="M15 9h3"/><path d="M15 13h3"/></svg>';
// Mustermappe: Blätter mit Bild, im Strich der übrigen Symbole.
NAV_ICONS.mappe='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.3-1.3a2.4 2.4 0 0 0-3.4 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/></svg>';
// Controlling: Kurve über der Achse, im Strich der übrigen Symbole.
NAV_ICONS.controlling='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m7 14 4-4 4 4 5-5"/></svg>';
// Kostenberechnung: Rechner, im Strich der übrigen Symbole.
NAV_ICONS.kosten='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>';
// Only «Zu bestätigen» carries a number; the web and the iPhone show the same count.
const bandejaBadge='<span class="nav-badge hidden" data-bandeja-badge aria-hidden="true"></span>';

document.body.innerHTML = `
<div class="app" id="app">
  <header class="topbar">
    <div class="topbar-brand"><div class="eyebrow">TBA OFFICE</div></div>
    <div class="top-actions"><button id="menuButton" class="dots" aria-label="Menü">•••</button></div>
  </header>

  <nav id="desktopLenses" class="desktop-lenses" aria-label="Office">
    <div class="lenses-heading">ANSICHTEN</div>
    <button class="lens-nav-item" data-nav="assistant" aria-label="Romy"><span class="lens-glyph" aria-hidden="true">${NAV_ICONS.assistant}</span><span class="lens-copy"><strong>Romy</strong><small>Persönliche Assistentin</small></span></button>
    <button class="lens-nav-item active" data-nav="feed" aria-label="Heute"><span class="lens-glyph" aria-hidden="true">${NAV_ICONS.feed}</span><span class="lens-copy"><strong>Heute</strong><small>Ihr Tag</small></span></button>
    <button class="lens-nav-item" data-nav="calendar" aria-label="Kalender"><span class="lens-glyph" aria-hidden="true">${NAV_ICONS.calendar}</span><span class="lens-copy"><strong>Kalender</strong><small>Termine und Aufgaben</small></span></button>
    <button class="lens-nav-item" data-nav="work" aria-label="Work"><span class="lens-glyph" aria-hidden="true">${NAV_ICONS.work}</span><span class="lens-copy"><strong>Work</strong><small>Projekte</small></span></button>
    <button class="lens-nav-item office-link" data-nav="tools" aria-label="Tools"><span class="lens-glyph" aria-hidden="true">${NAV_ICONS.tools}</span><span class="lens-copy"><strong>Tools</strong><small>Terminplan und Muster</small></span></button>
    <button class="lens-nav-item" data-nav="bandeja" aria-label="Eingang" hidden><span class="lens-glyph" aria-hidden="true">${NAV_ICONS.bandeja}${bandejaBadge}</span><span class="lens-copy"><strong>Eingang</strong><small>Vorschläge</small></span></button>
    <button class="lens-nav-item" data-nav="readings" aria-label="Lektüren" hidden><span class="lens-glyph" aria-hidden="true">${NAV_ICONS.readings}</span><span class="lens-copy"><strong>Lecturas</strong><small></small></span></button>
    <button class="lens-nav-item" data-nav="thoughts" aria-label="Thoughts" hidden><span class="lens-glyph" aria-hidden="true">${NAV_ICONS.thoughts}</span><span class="lens-copy"><strong>Thoughts</strong><small></small></span></button>
    <div class="minds-menu-slot lens-menu-slot" data-menu-slot="sidebar"></div>
    <div class="lenses-foot">Titus Bernhard Architekten</div>
  </nav>

  <main id="swipeArea" class="swipe-area">
    <section id="assistantScreen" class="screen active" data-screen="assistant">
      <div class="assistant-scroll">
        <button id="todayCard" class="today-card"><span class="today-title">Heute</span><span id="todaySummary" class="today-summary">0 Termine · 0 Aufgaben</span><span id="todayNext" class="today-next">Kein nächster Termin</span><span class="chevron">›</span></button>
        <div id="messages" class="messages" aria-live="polite"></div>
      </div>
      <div class="composer-wrap">
        <div id="chatReplyPreview" class="chat-reply-preview hidden"></div>
        <div id="chatAttachmentPreview" class="chat-attachment-preview hidden"></div>
        <div class="composer">
          <button id="attachButton" class="attach" aria-label="Datei anhängen" title="Datei anhängen"><svg class="chat-ui-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg></button>
          <input id="chatImageInput" class="hidden" type="file" accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.eml" multiple>
          <button id="micButton" class="mic" aria-label="Sprechen" title="Sprechen"><svg class="chat-ui-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg></button>
          <textarea id="chatInput" rows="1" placeholder="Nachricht an Romy …"></textarea>
          <button id="sendButton" class="send" aria-label="Senden" title="Nachricht senden"><svg class="chat-ui-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button>
        </div>
      </div>
    </section>

    <section id="feedScreen" class="screen surface-screen ahora-screen" data-screen="feed" aria-label="Heute">
      <div class="surface-scroll ahora-scroll">
        <div class="pull-refresh-indicator" data-pull-indicator="feed" aria-hidden="true"><span>Zum Aktualisieren ziehen</span></div>
        <header class="ahora-head">
          <div class="ahora-title"><span id="ahoraDate" class="ahora-date"></span><h1>Heute</h1></div>
          <div class="ahora-head-tools"><div id="situationWeather" class="ahora-weather"></div><span class="minds-menu-slot" data-menu-slot="feed"></span></div>
        </header>
        <div id="ahoraWeatherWeek" class="ahora-weather-week hidden"></div>
        <section id="ahoraInbox" class="ahora-section ahora-inbox hidden" aria-labelledby="ahoraInboxTitle"></section>
        <div id="situationLedger" class="situation-ledger" aria-live="polite"></div>
        <section id="ahoraDay" class="ahora-section" aria-labelledby="ahoraDayTitle"></section>
        <section id="ahoraBald" class="ahora-section hidden" aria-labelledby="ahoraBaldTitle"></section>
        <section id="ahoraUeberfaellig" class="ahora-section hidden" aria-labelledby="ahoraUeberfaelligTitle"></section>
        <section id="ahoraNext" class="ahora-section hidden" aria-labelledby="ahoraNextTitle"></section>
      </div>
    </section>

    <section id="bandejaScreen" class="screen surface-screen bandeja-screen" data-screen="bandeja" aria-label="Eingang">
      <div class="surface-scroll bandeja-scroll">
        <div class="pull-refresh-indicator" data-pull-indicator="bandeja" aria-hidden="true"><span>Zum Aktualisieren ziehen</span></div>
        <header class="bandeja-head">
          <div><h1>Eingang</h1><p>Was Romy vorschlägt — für wenn du Zeit hast.</p></div>
          <span class="minds-menu-slot" data-menu-slot="bandeja"></span>
        </header>
        <div class="bandeja-tabs" role="tablist" aria-label="Ansicht des Eingangs">
          <button type="button" role="tab" class="active" aria-selected="true" aria-controls="bandejaConfirm" data-bandeja-view="confirm">Zu bestätigen</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="bandejaSuggest" data-bandeja-view="suggest" hidden>Vorschläge</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="ideasScreen" data-bandeja-view="ideas" hidden>Ideen</button>
        </div>
        <div id="bandejaConfirm" class="bandeja-panel" role="tabpanel" data-bandeja-panel="confirm"><div class="surface-loading">Lese, was auf Bestätigung wartet …</div></div>
        <div id="bandejaSuggest" class="bandeja-panel hidden" role="tabpanel" data-bandeja-panel="suggest">
          <div class="bandeja-tools"><span id="feedRefreshStatus" class="surface-refresh-status" aria-live="polite"></span></div>
          <div id="feedList" class="surface-list"><div class="surface-loading">Lese die Lage …</div></div>
        </div>
        <div id="ideasScreen" class="bandeja-panel hidden" role="tabpanel" data-bandeja-panel="ideas" data-screen-alias="ideas">
          <div class="bandeja-tools"><button type="button" id="generateIdeas" class="surface-text-action">Neue Ideen erkunden</button></div>
          <div id="ideasList" class="surface-list"><div class="surface-loading">Suche etwas, das sich zu produzieren lohnt …</div></div>
        </div>
      </div>
    </section>

    <section id="toolsScreen" class="screen office-tools-screen" data-screen="tools" aria-label="Werkzeuge">
      <div class="office-tools-scroll">
        <div class="office-tools-head"><span class="minds-menu-slot" data-menu-slot="tools"></span><p>TOOLS</p><h1>Werkzeuge</h1>
        <p>Wiederverwendbare Werkzeuge und Office-Muster für die Projektarbeit.</p></div>
        <button type="button" class="office-tools-card" id="officeToolsPlans" aria-label="Terminplan öffnen">
          <span class="office-tools-symbol" aria-hidden="true">${NAV_ICONS.tools}</span>
          <span><strong>Terminplan</strong><small>Projekt auswählen, LPH 3 oder LPH 5 als Muster instanziieren und fortschreiben.</small></span>
          <span class="office-tools-arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="office-tools-card" id="officeToolsKosten" aria-label="Kostenberechnung öffnen">
          <span class="office-tools-symbol" aria-hidden="true">${NAV_ICONS.kosten}</span>
          <span><strong>Kostenberechnung</strong><small>Nach DIN 276 bis zur 3. Ebene: Mengen aus Archicad, Kennwerte mit Herkunft, Vergleich mit der Kostenschätzung und Bericht für die Kostenbesprechung.</small></span>
          <span class="office-tools-arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="office-tools-card" id="officeToolsControlling" aria-label="Controlling öffnen">
          <span class="office-tools-symbol" aria-hidden="true">${NAV_ICONS.controlling}</span>
          <span><strong>Controlling</strong><small>Honorar laut Vertrag gegen die Stunden: Stundenbudget zum Kalkulationssatz, Leistungsstand, Zahlungen und Prognose je Projekt. Sätze und Gehälter sehen nur Admins.</small></span>
          <span class="office-tools-arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="office-tools-card" id="officeToolsProdukte" aria-label="Produktbibliothek öffnen">
          <span class="office-tools-symbol" aria-hidden="true">${NAV_ICONS.produkte}</span>
          <span><strong>Produktbibliothek</strong><small>Materialien einmal erfassen, in jedem Projekt verwenden: Herstellerdatenblatt mit Seitenangabe, Preise mit Herkunft und die Projekte, in denen sie stecken.</small></span>
          <span class="office-tools-arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="office-tools-card" id="officeToolsHersteller" aria-label="Herstellerkatalog öffnen">
          <span class="office-tools-symbol" aria-hidden="true">${NAV_ICONS.hersteller}</span>
          <span><strong>Herstellerkatalog</strong><small>Firmen mit Kontakt für das ganze Büro: was sie anbieten, wie man sie erreicht und wer im Büro in welchem Projekt schon Kontakt hatte.</small></span>
          <span class="office-tools-arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="office-tools-card" id="officeToolsMappe" aria-label="Mustermappe öffnen">
          <span class="office-tools-symbol" aria-hidden="true">${NAV_ICONS.mappe}</span>
          <span><strong>Mustermappe</strong><small>Je Themenpaket eine Mappe A3 quer: Positionen aus dem Plan, Kandidaten aus der Produktbibliothek. Vorgestellt im Bemusterungstermin, entschieden in der Entscheidungsliste.</small></span>
          <span class="office-tools-arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="office-tools-card" id="officeToolsStart" aria-label="Projektstart öffnen">
          <span class="office-tools-symbol" aria-hidden="true">${NAV_ICONS.work}</span>
          <span><strong>Projektstart</strong><small>Die Bürovorlagen LPH 3 als Dokumente des Projekts: Klärungsliste, Entscheidungsliste und Entscheidungsvorlagen im Office bearbeiten und als Excel, Word oder PDF ausgeben. Dazu das Muster mit fünf Bürovorlagen für die LPH 3.</small></span>
          <span class="office-tools-arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="office-tools-card office-tools-projects" id="officeToolsManage" aria-label="Projekte verwalten">
          <span class="office-tools-symbol" aria-hidden="true">${NAV_ICONS.work}</span>
          <span><strong>Projekte verwalten</strong><small>Projekte anlegen, Mitglieder gemeinsam verwalten und Terminpläne verknüpfen.</small></span>
          <span class="office-tools-arrow" aria-hidden="true">›</span>
        </button>
      </div>
    </section>
    <section id="plansScreen" class="screen office-projects-screen" data-screen="plans" aria-label="Terminpläne">
      <div class="office-projects-scroll">
        <button type="button" id="officePlansBack" class="office-projects-back">‹ Werkzeuge</button>
        <div class="office-projects-head"><div><p>OFFICE · TERMINPLAN</p><h1>Terminpläne</h1>
          <p>Unveränderliche LPH-Muster ansehen und Projektterminpläne unabhängig davon bearbeiten.</p></div></div>
        <div id="officePlansStatus" class="office-projects-status" role="status" aria-live="polite"></div>
        <h2 class="office-plan-library-heading">Muster · nur Ansicht</h2>
        <div id="officePlansTemplates" class="office-projects-list"></div>
        <h2 class="office-plan-library-heading">Projektterminpläne</h2>
        <div id="officePlansInstances" class="office-projects-list"></div>
      </div>
    </section>
    <section id="projectsScreen" class="screen office-projects-screen" data-screen="projects" aria-label="Projekte">
      <div class="office-projects-scroll">
        <button type="button" id="officeProjectsBack" class="office-projects-back">‹ Werkzeuge</button>
        <div class="office-projects-head"><div><p>OFFICE · VERWALTUNG</p><h1>Projekte verwalten</h1><p>Projekte anlegen, Mitglieder, Nummer und Name ändern, archivieren. Gearbeitet wird in Work.</p></div>
          <button type="button" id="officeProjectsNew" class="office-projects-new" hidden>+ Neues Projekt</button>
        </div>
        <div id="officeProjectsStatus" class="office-projects-status" role="status" aria-live="polite"></div>
        <div id="officeProjectsList" class="office-projects-list"></div>
      </div>
    </section>
    <!-- Administration (27.11.2026): Seiten der App statt der alten Startseite; office-verwaltung.js füllt sie. -->
    <section id="kinutzungScreen" class="screen office-verwaltung-screen" data-screen="kinutzung" aria-label="KI-Nutzung">
      <div class="office-verwaltung-scroll"><div id="officeKiNutzung" class="office-verwaltung office-verwaltung-breit"></div></div>
    </section>
    <section id="systemstatusScreen" class="screen office-verwaltung-screen" data-screen="systemstatus" aria-label="Systemstatus">
      <div class="office-verwaltung-scroll"><div id="officeSystemstatus" class="office-verwaltung"></div></div>
    </section>
    <section id="mitgliederScreen" class="screen office-verwaltung-screen" data-screen="mitglieder" aria-label="Mitglieder">
      <div class="office-verwaltung-scroll"><div id="officeMitglieder" class="office-verwaltung"></div></div>
    </section>
    <section id="workScreen" class="screen work-screen" data-screen="work">
      <div class="work-shell">
        <div class="work-head">
          <div><h1 id="workProjectTitle">Work</h1></div>
          <div class="work-project-switch" aria-label="Bereich">
            <span class="small">Lade Projekte …</span>
          </div>
          <span class="minds-menu-slot" data-menu-slot="work"></span>
        </div>
        <div class="work-tabs" role="tablist">
          <button data-work-view="overview" class="active">Panorama</button>
          <button data-work-view="knowledge" hidden>Wissen</button>
          <button data-work-view="desktop">Desktop</button>
          <button data-work-view="planner">Planner</button>
          <button data-work-view="listen" hidden>Listen</button>
          <button data-work-view="terminplan" hidden>Terminplan</button>
          <button data-work-view="kosten" hidden>Kostenberechnung</button>
          <button data-work-view="controlling" hidden>Controlling</button>
          <button data-work-view="mustermappe" hidden>Mustermappe</button>
          <button data-work-view="produkte" hidden>Produkte</button>
          <button data-work-view="hersteller" hidden>Hersteller</button>
          <button data-work-view="threads">Threads</button>
          <button type="button" class="work-tab-plus" data-work-abschnitte aria-label="Abschnitt hinzufügen" title="Abschnitt hinzufügen" aria-haspopup="dialog" aria-expanded="false" hidden><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M8 3v10M3 8h10"/></svg></button>
        </div>
        <div id="workStatus" class="work-status" aria-live="polite"></div>
        <div id="workBody" class="work-body"><div class="surface-loading">Öffne Work …</div></div>
        <div id="workToolHost" class="work-tool-host" hidden></div>
        <input id="workFileInput" class="hidden" type="file" multiple>
      </div>
    </section>

    <section id="calendarScreen" class="screen" data-screen="calendar">
      <div class="cal-toolbar"><button id="backButton" class="text-btn" hidden>‹</button><div class="segments"><button data-view="day">Tag</button><button data-view="week">Woche</button><button class="active" data-view="month">Monat</button></div><div class="cal-toolbar-right"><button id="todayButton" class="text-btn right">Heute</button><span class="minds-menu-slot" data-menu-slot="calendar"></span></div></div>
      <div class="cal-nav"><button id="prevButton" class="round">‹</button><div id="calTitle" class="cal-title"></div><button id="nextButton" class="round">›</button></div>
      <div id="calendarContent" class="calendar-content"></div>
    </section>

    <section id="readingsScreen" class="screen readings-screen" data-screen="readings">
      <div class="readings-topline"><div><span class="readings-agent">SOFÍA</span><span class="readings-title">Readings</span></div><div class="readings-top-actions"><button id="openSofiaButton" class="sofia-button">Hablar con Sofía</button><span class="minds-menu-slot" data-menu-slot="readings"></span></div></div>
      <iframe id="readingsFrame" class="readings-frame" title="MINDS Readings · Sofía" loading="lazy"></iframe>
    </section>

    <section id="thoughtsScreen" class="screen thoughts-screen" data-screen="thoughts" aria-label="Dear: Thoughts">
      <div id="thoughtsHost" class="thoughts-host">
        <div id="thoughtsLoadStatus" class="thoughts-load-status" role="status">Abriendo Thoughts…</div>
        <div id="thoughtsFrameError" class="thoughts-load-error hidden" role="alert">
          Thoughts konnte nicht geladen werden. <a href="https://gari01234.github.io/architectures/dear_thoughts.html" target="_blank" rel="noopener noreferrer">Das Original öffnen</a>
        </div>
      </div>
    </section>
  </main>

  <section id="feedDetail" class="feed-detail hidden" aria-hidden="true">
    <div class="feed-detail-head"><div class="eyebrow">MINDS · FEED</div><button id="closeFeedDetail" class="round" aria-label="Cerrar">×</button></div>
    <div id="feedDetailScroll" class="feed-detail-scroll">
      <div id="feedDetailMeta" class="feed-detail-meta"></div>
      <h1 id="feedDetailTitle"></h1>
      <div id="feedDetailMedia" class="feed-detail-media"></div>
      <p id="feedDetailSummary" class="feed-detail-summary"></p>
      <div id="feedDetailArticle" class="feed-detail-article"></div>
      <div id="feedDetailFollow" class="feed-detail-follow"></div>
      <div id="feedThreadLog" class="feed-thread-log"></div>
    </div>
    <form id="feedThreadForm" class="feed-thread-form">
      <textarea id="feedThreadInput" rows="1" placeholder="Dazu etwas fragen …"></textarea>
      <button class="send" aria-label="Senden"><svg class="chat-ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button>
    </form>
  </section>

  <section id="ideaWorkspace" class="idea-workspace hidden" aria-hidden="true">
    <div class="idea-workspace-head">
      <div><div class="eyebrow">MINDS · TRABAJO</div><div id="ideaWorkspaceStatus" class="idea-workspace-status">EN PRODUCCIÓN</div></div>
      <button id="closeIdeaWorkspace" class="round" aria-label="Cerrar">×</button>
    </div>
    <div id="ideaWorkspaceScroll" class="idea-workspace-scroll">
      <h1 id="ideaWorkspaceTitle"></h1>
      <p id="ideaWorkspaceBrief" class="idea-workspace-brief"></p>
      <div id="ideaWorkspaceArtifact" class="idea-workspace-artifact hidden"></div>
      <div id="ideaWorkspaceThread" class="idea-workspace-thread"></div>
    </div>
    <form id="ideaWorkspaceForm" class="idea-workspace-form">
      <textarea id="ideaWorkspaceInput" rows="1" placeholder="An dieser Idee weiterarbeiten …"></textarea>
      <button class="send" aria-label="Senden"><svg class="chat-ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button>
    </form>
  </section>

  <nav id="mainNav" class="main-nav" aria-label="MINDS">
    <button class="main-nav-item" data-nav="assistant" aria-label="Romy"><span class="nav-icon">${NAV_ICONS.assistant}</span></button>
    <button class="main-nav-item active" data-nav="feed" aria-label="Heute"><span class="nav-icon">${NAV_ICONS.feed}</span></button>
    <button class="main-nav-item" data-nav="calendar" aria-label="Kalender"><span class="nav-icon">${NAV_ICONS.calendar}</span></button>
    <button class="main-nav-item" data-nav="work" aria-label="Work"><span class="nav-icon">${NAV_ICONS.work}</span></button>
    <button class="main-nav-item office-link" data-nav="tools" aria-label="Tools"><span class="nav-icon">${NAV_ICONS.tools}</span></button>
    <button class="main-nav-item" data-nav="bandeja" aria-label="Eingang" hidden><span class="nav-icon">${NAV_ICONS.bandeja}${bandejaBadge}</span></button>
  </nav>

  <div id="drawerBackdrop" class="backdrop hidden"></div>
  <aside id="drawer" class="drawer hidden"><div class="drawer-head"><div><div class="eyebrow">TBA OFFICE</div><div class="drawer-title">Mehr</div></div><button id="closeDrawer" class="round">×</button></div><a class="drawer-link" id="officeProjectsDrawer" href="#section=projects">Projekte verwalten</a><a class="drawer-link" href="#section=mitglieder" data-office-verwaltung="mitglieder" data-office-admin hidden>Mitglieder</a><a class="drawer-link" href="#section=kinutzung" data-office-verwaltung="kinutzung" data-office-admin hidden>KI-Nutzung</a><a class="drawer-link" href="#section=systemstatus" data-office-verwaltung="systemstatus" data-office-admin hidden>Systemstatus</a><button data-action="new">Neu anlegen</button><button data-action="tasks">Aufgaben</button><a class="drawer-link" href="../#password" data-office-verwaltung="passwort">Passwort ändern</a><button id="officeSwitchAccount" type="button" hidden>Zu Persönlich wechseln</button><button id="officeSignOut">Abmelden</button><button id="authButton" hidden>Synchronisieren</button><button id="refreshViewAction" data-action="refreshview" class="hidden">Ansicht aktualisieren</button><div class="office-hidden-actions" hidden><button data-shell-nav="readings">Lecturas</button><button data-shell-nav="thoughts">Thoughts</button><button data-action="memory"></button><button data-action="assistantprefs"></button><button data-action="push"></button><button data-action="permissions"></button><button data-action="reviews"></button><button data-action="routines"></button><button data-action="intents"></button><button data-action="continuity"></button><button data-action="skills"></button><button data-action="doctor"></button><button data-action="feedprefs"></button><button data-action="artifacts"></button><button data-action="aiusage"></button></div><div id="syncStatus" class="drawer-note">Verbinde mit dem Office …</div><div id="currentBuildInfo" class="drawer-note">TBA Office · auf Basis von Window</div></aside>
  <div id="focusMode" class="focus hidden" role="dialog" aria-modal="true"><div class="focus-head"><div class="focus-name">Romy</div><button id="focusClose" class="round">×</button></div><div class="focus-center"><div class="wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div id="focusStatus" class="focus-status">Höre zu …</div><textarea id="focusTranscript" class="focus-transcript" rows="5" readonly placeholder="Hier erscheint die Transkription."></textarea></div><label class="focus-voice-option"><input id="focusSpeakReply" type="checkbox"><span>Antwort anhören</span></label><a id="focusLiveLink" class="focus-live-link" href="./live/" aria-label="Live mit Romy sprechen">Live sprechen</a><div class="focus-actions"><button id="focusKeyboard">Abbrechen</button><button id="focusStop" class="dark">Stopp</button></div></div>
  <div id="liveSheet" class="live-sheet hidden" role="dialog" aria-modal="false" aria-label="Live-Gespräch mit Romy"><div class="live-sheet-head"><span class="live-sheet-title">Live · Romy</span><button id="liveSheetClose" class="round" type="button" aria-label="Live-Gespräch schließen">×</button></div><iframe id="liveFrame" class="live-frame" title="Live-Gespräch mit Romy" allow="microphone; autoplay"></iframe></div>
  <div id="modalBackdrop" class="backdrop hidden"></div><div id="modal" class="modal hidden"><div class="modal-head"><div id="modalTitle" class="modal-title"></div><button id="closeModal" class="round">×</button></div><div id="modalBody"></div></div>
</div>`;

// Office menu: admins see Mitglieder; Abmelden ends the office session for all office pages.
window.addEventListener('office:member',e=>{
  document.querySelectorAll('[data-office-admin]').forEach(el=>{el.hidden=e.detail?.role!=='admin'});
});
document.getElementById('officeSignOut')?.addEventListener('click',async()=>{
  try{localStorage.removeItem('tba-office-window-v1')}catch{}
  try{await window.MINDS_SUPABASE?.auth.signOut()}catch{}
  // In the Window app, signing out ends the app's office session and the app shows its sign-in.
  if(window.WINDOW_NATIVE?.available)return;
  location.replace('../');
});
// Window iPhone app: switch to the personal account, like changing users on GitHub.
(async()=>{
  const native=window.WINDOW_NATIVE;if(!native?.available)return;
  const info=await native.call('app.info');
  if(!(info?.app?.capabilities||[]).includes('account.switch'))return;
  const button=document.getElementById('officeSwitchAccount');if(!button)return;
  button.hidden=false;
  button.onclick=()=>void native.call('account.switch',{to:'personal'});
})();
