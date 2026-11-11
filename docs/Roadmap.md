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
- [ ] Harness: Lint, Typen, `node:test`, Coverage, CI auf drei Plattformen
- [x] ~`harness/build` (App bündeln, Module für Unit-Tests bündeln)~

### MD_Calendar

- [x] ~ES-Module + esbuild, `npm run build` / `verify`~
- [x] ~SortableJS + dayjs über npm, `vendor/` bereinigen~
- [x] ~Hinweis bei fehlendem Build, Architektur-Checker auf `import`-Pfade~
- [x] ~Architecture, D8 + README aktualisieren~

### MD_Manager

- [x] ~ES-Module + esbuild, `npm run build` / `verify`~
- [x] ~SortableJS über npm~
- [ ] Release-Workflow: erst bauen, dann HTML, CSS, `res/` + `dist/` zippen => Release-Zip läuft weiter ohne Node
- [x] ~Gemerkte Dateien bleiben erhalten, E2E + Baselines unverändert grün~
- [x] ~README aktualisieren~

## Applikationskern

#Version
- 0.2.0

#Date
- 11.11.2026

#Info
Logik ohne DOM: Undo, Speichern, Dateizugriff, Suche, Daten.
Jedes Modul aus dem MD_Manager-Code, erst in MD_Calendar, dann in MD_Manager.

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

#Pin
## UI und Harness

#Version
- 0.3.0

#Date
- 11.11.2026

#Info
DOM-Bausteine mit puren Kernen und der gemeinsame Test-Harness.

### UI

- [ ] `ui/notifications` + `ui/tooltips`
- [ ] `platform/audio` (Arpeggio + Sweep-Duo als Presets)
- [ ] `ui/keymap` (Kürzel, Escape-Stapel, Hilfe) + `ui/dom`
- [ ] `ui/sortable` + `ui/drag`
- [ ] `ui/menu`

### Harness

- [ ] Architektur-Checker, Icon-Test + ESLint-Config auslagern

### Integration

- [ ] MD_Calendar umstellen, CSS an die gemeinsame Struktur anpassen
- [ ] MD_Manager umstellen, E2E + Baselines unverändert grün

### Release

- [ ] Zeilenbilanz messen
- [ ] Docs + README aller drei Repos aktualisieren