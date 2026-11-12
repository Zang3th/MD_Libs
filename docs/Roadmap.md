# MD_Libs

## Build und Grundgerüst

#Version
- 0.1.0

#Date
- 11.11.2026

#Info
Beide Apps bauen mit esbuild, MD_Libs existiert als Paket. Noch kein Code ausgelagert.

### MD_Libs

- [x] ~Repo anlegen => `@zang3th/md-libs`~
- [x] ~Initialisieren => README.md, AGENTS.md~
- [x] ~Harness: Lint, Typen, `node:test`, Coverage, CI auf drei Plattformen~
- [x] ~`harness/build` (App bündeln, Module für Unit-Tests bündeln)~

### MD_Calendar

- [x] ~ES-Module + esbuild, `npm run build` / `verify`~
- [x] ~SortableJS + dayjs über npm, `vendor/` bereinigen~
- [x] ~Hinweis bei fehlendem Build, Architektur-Checker auf `import`-Pfade~
- [x] ~Architecture, D8 + README aktualisieren~

### MD_Manager

- [x] ~ES-Module + esbuild, `npm run build` / `verify`~
- [x] ~SortableJS über npm~
- [x] ~Gemerkte Dateien bleiben erhalten, E2E + Baselines unverändert grün~
- [x] ~README aktualisieren~

## Applikationskern

#Version
- 0.2.0

#Date
- 11.11.2026

#Info
Logik ohne DOM: Undo, Speichern, Dateizugriff, Suche, Daten.

### Undo und Speichern

- [x] ~`core/history` + `core/controls`~
- [x] ~`platform/storage` mit Vertragssuite + Fakes~
- [x] ~`platform/handles` + `platform/startup`~
- [x] ~`platform/session` (Speichern, externe Änderungen, Konflikte)~

### Suche und Daten

- [x] ~`core/search` + `core/inline` mit Differenztest gegen MD_Manager~
- [x] ~`core/dates`~
- [x] ~`core/text` + `core/markdown`, Calendar-Parser umstellen (Golden Files bitgleich)~

### Integration

- [x] ~MD_Calendar umstellen + doppelte Tests entfernen~
- [x] ~MD_Manager umstellen, E2E + Baselines unverändert grün~

## UI und Harness

#Version
- 0.3.0

#Date
- 11.11.2026

#Info
DOM-Bausteine mit puren Kernen und der gemeinsame Test-Harness.

### UI

- [x] ~`ui/notifications` + `ui/tooltips`~
- [x] ~`platform/audio` (Arpeggio + Sweep-Duo als Presets)~
- [x] ~`ui/keymap` (Kürzel als Daten) + `ui/dom`~
- [x] ~`ui/sortable`~
- [x] ~`ui/popover` (Platzierung schwebender Elemente)~

### Harness

- [x] ~Architektur-Checker, Icon-Test + ESLint-Config auslagern~

### Integration

- [x] ~MD_Calendar umstellen, CSS an die gemeinsame Struktur anpassen~
- [x] ~MD_Manager umstellen, E2E + Baselines unverändert grün~

### Release

- [x] ~Zeilenbilanz messen~
- [x] ~Docs + README aller drei Repos aktualisieren~

#Pin
## Einheitliche Schnittstellen

#Version
- 0.4.0

#Date
- 11.11.2026 - 12.11.2026

### Schnittstellen

- [x] ~Alles mit Zustand über `create(options)` => `search.create`, `audio.create`, `sortable.create`~
- [x] ~Werkzeuge der App im Options-Objekt => `build({ esbuild, root })`, `createChecker({ ts, root })`, `storageContract({ name, setup })`~
- [x] ~`startup.missingApis({ window, apis })`: Funktionen ausdrücklich als `name()` statt Namensraten~
- [x] ~Klänge raus aus MD_Libs, die Apps definieren ihre eigenen~

### Module

- [x] ~`core/controls` => `history.controls`~
- [x] ~`core/text` + `core/inline` => `core/markdown`~
- [x] ~`ui/dom` intern, `search.prepare`/`score`, `storage.stampOf` + `sortable.defaults` nicht mehr öffentlich~
- [x] ~Harness: sieben Einstiegspunkte => `build`, `testing`, `checks`~

### Verschiedenes

- [x] ~`ui/popover` schließen: Klick außerhalb, Escape, `aria-expanded`~
- [x] ~`platform/session` prüft selbst auf externe Änderungen (Intervall, Fokus, Sichtbarkeit) und liest die Dateien beim Öffnen~
- [x] ~`platform/session` warnt vor dem Verlassen, in MD_Manager nur per Option~
- [x] ~`core/markdown`: Prüfung auf ungültige Zeichen aus MD_Manager übernehmen~
- [x] ~Gemeinsame jsconfig-Basis für beide Apps~
- [x] ~`core/dates`: Zeiträume (Anfang + nächster Zeitraum für Tag, Woche, Monat, Quartal, Jahr mit Schrittweite) aus dem Archiv von MD_Manager~
- [x] ~MD_Manager: eigenes `escapeHtml` in `ui/search.js` durch `markdown.escapeHtml` ersetzen~
- [x] ~Typprüfung eines `checkJs`-Konsumenten (Plan 5.1.9)~
- [x] ~Plan: `maxNodeModuleJsDepth` korrigieren, leeren Abschnitt 4 entfernen~

### Integration

- [x] ~MD_Calendar + MD_Manager umstellen~
- [x] ~README, Plan + AGENTS aktualisieren~
- [x] ~Weitere Punkte in MD_Calendar + MD_Manager umstellen, E2E + Baselines unverändert grün~