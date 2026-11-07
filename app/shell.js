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
// TBA Office: Window's frame in German. Chat, Bandeja, Lecturas and Thoughts stay in the page (the copied code
// expects their elements) but are hidden until the office has an assistant. Tools links to the office tools.
NAV_ICONS.tools='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
// Only «Por confirmar» carries a number; the web and the iPhone show the same count.
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
    <button class="lens-nav-item" data-nav="readings" aria-label="Lecturas" hidden><span class="lens-glyph" aria-hidden="true">${NAV_ICONS.readings}</span><span class="lens-copy"><strong>Lecturas</strong><small></small></span></button>
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
        <button type="button" id="ahoraBandejaLink" class="ahora-bandeja-link hidden"></button>
        <div id="situationLedger" class="situation-ledger" aria-live="polite"></div>
        <section id="ahoraNext" class="ahora-section hidden" aria-labelledby="ahoraNextTitle"></section>
        <section id="ahoraDay" class="ahora-section" aria-labelledby="ahoraDayTitle"></section>
      </div>
    </section>

    <section id="bandejaScreen" class="screen surface-screen bandeja-screen" data-screen="bandeja" aria-label="Bandeja">
      <div class="surface-scroll bandeja-scroll">
        <div class="pull-refresh-indicator" data-pull-indicator="bandeja" aria-hidden="true"><span>Desliza para actualizar</span></div>
        <header class="bandeja-head">
          <div><h1>Bandeja</h1><p>Lo que Isabella propone, para cuando tengas tiempo.</p></div>
          <span class="minds-menu-slot" data-menu-slot="bandeja"></span>
        </header>
        <div class="bandeja-tabs" role="tablist" aria-label="Vista de la Bandeja">
          <button type="button" role="tab" class="active" aria-selected="true" aria-controls="bandejaConfirm" data-bandeja-view="confirm">Por confirmar</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="bandejaSuggest" data-bandeja-view="suggest">Sugerencias</button>
          <button type="button" role="tab" aria-selected="false" aria-controls="ideasScreen" data-bandeja-view="ideas">Ideas</button>
        </div>
        <div id="bandejaConfirm" class="bandeja-panel" role="tabpanel" data-bandeja-panel="confirm"><div class="surface-loading">Leyendo lo que espera tu confirmación…</div></div>
        <div id="bandejaSuggest" class="bandeja-panel hidden" role="tabpanel" data-bandeja-panel="suggest">
          <div class="bandeja-tools"><span id="feedRefreshStatus" class="surface-refresh-status" aria-live="polite"></span></div>
          <div id="feedList" class="surface-list"><div class="surface-loading">Leyendo tu situación…</div></div>
        </div>
        <div id="ideasScreen" class="bandeja-panel hidden" role="tabpanel" data-bandeja-panel="ideas" data-screen-alias="ideas">
          <div class="bandeja-tools"><button type="button" id="generateIdeas" class="surface-text-action">Explorar nuevas ideas</button></div>
          <div id="ideasList" class="surface-list"><div class="surface-loading">Buscando algo que valga la pena producir…</div></div>
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
        <button type="button" class="office-tools-card office-tools-projects" id="officeToolsManage" aria-label="Projekte öffnen">
          <span class="office-tools-symbol" aria-hidden="true">${NAV_ICONS.work}</span>
          <span><strong>Projekte</strong><small>Projekte anlegen, Mitglieder gemeinsam verwalten und Terminpläne verknüpfen.</small></span>
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
        <div class="office-projects-head"><div><p>OFFICE</p><h1>Projekte</h1><p>Projekte und zugehörige Terminpläne an einem Ort.</p></div>
          <button type="button" id="officeProjectsNew" class="office-projects-new" hidden>+ Neues Projekt</button>
        </div>
        <div id="officeProjectsStatus" class="office-projects-status" role="status" aria-live="polite"></div>
        <div id="officeProjectsList" class="office-projects-list"></div>
      </div>
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
          <button data-work-view="desktop">Desktop</button>
          <button data-work-view="planner">Planner</button>
          <button data-work-view="knowledge" hidden>Wissen</button>
          <button data-work-view="threads">Threads</button>
        </div>
        <div id="workStatus" class="work-status" aria-live="polite"></div>
        <div id="workBody" class="work-body"><div class="surface-loading">Öffne Work …</div></div>
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
          No pude cargar Thoughts. <a href="https://gari01234.github.io/architectures/dear_thoughts.html" target="_blank" rel="noopener noreferrer">Abrir la obra original</a>
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
      <textarea id="feedThreadInput" rows="1" placeholder="Preguntar sobre esto..."></textarea>
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
      <textarea id="ideaWorkspaceInput" rows="1" placeholder="Seguir trabajando en esta idea..."></textarea>
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
  <aside id="drawer" class="drawer hidden"><div class="drawer-head"><div><div class="eyebrow">TBA OFFICE</div><div class="drawer-title">Mehr</div></div><button id="closeDrawer" class="round">×</button></div><a class="drawer-link" id="officeProjectsDrawer" href="#section=projects">Projekte verwalten</a><button class="drawer-link" type="button" id="officePlansDrawer">Terminplan-Muster</button><a class="drawer-link" href="../#members" data-office-admin hidden>Mitglieder</a><button data-action="new">Neu anlegen</button><button data-action="tasks">Aufgaben</button><button data-action="categories">Kategorien</button><a class="drawer-link" href="../#password">Passwort ändern</a><button id="officeSwitchAccount" type="button" hidden>Zu Persönlich wechseln</button><button id="officeSignOut">Abmelden</button><button id="authButton" hidden>Synchronisieren</button><button id="refreshViewAction" data-action="refreshview" class="hidden">Ansicht aktualisieren</button><div class="office-hidden-actions" hidden><button data-shell-nav="readings">Lecturas</button><button data-shell-nav="thoughts">Thoughts</button><button data-action="memory"></button><button data-action="assistantprefs"></button><button data-action="push"></button><button data-action="permissions"></button><button data-action="reviews"></button><button data-action="routines"></button><button data-action="intents"></button><button data-action="continuity"></button><button data-action="skills"></button><button data-action="doctor"></button><button data-action="feedprefs"></button><button data-action="artifacts"></button><button data-action="aiusage"></button></div><div id="syncStatus" class="drawer-note">Verbinde mit dem Office …</div><div id="currentBuildInfo" class="drawer-note">TBA Office · auf Basis von Window</div></aside>
  <div id="focusMode" class="focus hidden" role="dialog" aria-modal="true"><div class="focus-head"><div class="focus-name">Romy</div><button id="focusClose" class="round">×</button></div><div class="focus-center"><div class="wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div id="focusStatus" class="focus-status">Hört zu …</div><textarea id="focusTranscript" class="focus-transcript" rows="5" readonly placeholder="Tu transcripción aparecerá aquí."></textarea></div><div class="focus-actions"><button id="focusKeyboard">Abbrechen</button><button id="focusStop" class="dark">Stopp</button></div></div>
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
