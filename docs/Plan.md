# MD_Libs – Plan

**Ziel:** Dopplungen zwischen MD_Manager und MD_Calendar beseitigen und einen getesteten Applikationskern als Bibliothek bereitstellen. Was keine Dopplung beseitigt und den Kern nicht stärkt, gehört nicht nach MD_Libs.

Versionen und Arbeitspakete: [Roadmap](Roadmap.md).

---

## 1. Leitregeln

1. **MD_Manager ist die Referenz.** Für seine Nutzer ändert sich nichts: Aussehen, Texte, Bedienung, Zeitpunkte, Tastatur, Drag and Drop, Suchergebnisse, Dateiinhalt und Dateibehandlung. Interna, Schnittstellen und DOM-Struktur dürfen sich ändern, solange das gilt.
2. **Module entstehen aus dem MD_Manager-Code** und werden dabei verallgemeinert. Zusätzliche Fähigkeiten von MD_Calendar kommen als Optionen hinzu; der Standardwert ist das MD_Manager-Verhalten.
3. **Was sich nicht verhaltensgleich herauslösen lässt, bleibt in MD_Manager.** Derzeit: der Parser `io/markdown.js`.
4. **Abnahme in MD_Manager:** E2E-Assertions und visuelle Baselines bleiben unverändert grün; Baselines werden nie neu erzeugt. Wo eine Verallgemeinerung nutzerrelevante Ergebnisse berühren kann (Ranking, Serialisierung, Speicherentscheidungen, Index-Rechnung beim Ziehen), sichert ein Differenztest gegen den bisherigen MD_Manager-Code ab.
5. **Bleibt in den Apps:** Domänenmodelle, Dateiformate und Golden Files, Wiederholungsregeln, ICS/vCard, Rendering der Ansichten, CSS, Texte, Fehlercodes (`MDM-`, `MDC-`).

---

## 2. Laufzeit und Einbindung

- Beide Apps bündeln mit esbuild `app.js` und alle Imports zu `dist/app.js`, einem klassischen Skript mit Source Map; es läuft unter `file://`. `dist/` ist nicht eingecheckt.
- Produktionsdateien der Apps sind ES-Module mit gemeinsamem Namespace (`window.MDManager`, `window.MDCalendar`). Nur `app.js` importiert Produktionsmodule, einmal und in der Reihenfolge domain, io, ui. Library-Module werden explizit importiert.
- MD_Libs ist ein ESM-Paket ohne eigenen Build; Harness-Module sind CommonJS (`.cjs`). Die Apps beziehen den aktuellen `master` als Git-Abhängigkeit `github:Zang3th/MD_Libs#master`; `package-lock.json` hält den Commit fest, `npm update @zang3th/md-libs` holt den neuesten. Lokal `npm link ../MD_Libs`.
- SortableJS: UMD-Build `sortablejs/Sortable.min.js`, von `app.js` zuerst importiert. dayjs (nur MD_Calendar) über npm.
- Fehlt `dist/app.js`, zeigt die HTML-Datei über `onerror` am Skript-Tag nur den Hinweis, `npm ci` und `npm run build` auszuführen.
- Typen: JSDoc mit `tsc --checkJs` strict. Produktion `moduleResolution: Bundler`, `maxNodeModuleJsDepth: 0`; Harness `NodeNext`, `maxNodeModuleJsDepth: 1`.

| Befehl | Wirkung |
|---|---|
| `npm run build` | baut `dist/`; nach jedem `git pull` nötig |
| `npm run verify` | baut, dann Typen, Lint, Architektur, Unit-Tests, E2E gegen den Build |

Release von MD_Manager: `release.yml` baut und packt HTML, `styles.css`, `res/`, `data/templates/`, README, LICENSE und `dist/`.

**Schichtregeln der Apps** (Architektur-Checker, anhand der `import`-Pfade):

| App-Schicht | darf importieren |
|---|---|
| `domain/` | `@zang3th/md-libs/core` |
| `io/` | `core`, `platform` |
| `ui/` | `core`, `ui`; SortableJS |
| `app.js` | alles |

Exporte und dynamische Importe in Produktionsdateien sind verboten; die HTML-Datei lädt nur `dist/app.js`.

---

## 3. Bibliothek

### 3.1 Grundsätze

1. Einzige Laufzeitabhängigkeit ist `sortablejs`, nur in `ui/sortable`.
2. Keine Seiteneffekte beim Import (`"sideEffects": false`). Listener, Timer und Observer entstehen in `create…()`, jedes Objekt hat `destroy()`.
3. Jede Entscheidung ist eine pure Funktion über Plain Data. Code mit DOM, Layout, Web Audio, IndexedDB oder File System Access enthält keine eigene Verzweigungslogik; Browser-Objekte werden übergeben.
4. Texte, Icons, Uhr/Timer und Speicher-Adapter werden injiziert. Standardtexte Englisch.
5. Öffentliche Typen mit Präfix `MDL`; Fehlerklassen mit `name` und `code` (`MDL_STORAGE_CONFLICT`). App-Fehlercodes vergibt die App.
6. Kein CSS. UI-Module erzeugen die DOM-Struktur und Klassen von MD_Manager; MD_Calendar passt sein CSS an.
7. Keine Releases: `master` ist der Stand, den die Apps beziehen, und muss jederzeit grün sein. Eine Änderung an einer öffentlichen Schnittstelle passt beide Apps im selben Zug an.

### 3.2 Struktur

```text
src/core/        pur: kein DOM, keine Browser- oder Node-APIs
src/platform/    Browser-APIs ohne Rendering (File System Access, IndexedDB, Web Audio)
src/ui/          DOM-Komponenten
src/harness/     Node-Werkzeuge für die Apps (.cjs), nie gebündelt
test/            node:test; reference/ = eingefrorener MD_Manager-Code für Differenztests
docs/            Plan.md, Roadmap.md
```

Einstiegspunkte: `@zang3th/md-libs/core`, `/platform`, `/ui`, `/harness/<name>`.

### 3.3 Module

#### core/history

Basis MD_Manager: `execute` (No-op bei `redo() === false`, Rollback bei Fehler), `commit`, `replaceCurrent`, `clear`, View-State vor/nach, Grenzen 100 Einträge / 8 MiB. Zusätzlich der Gespeichert-Abstand aus MD_Calendar.

```js
const h = history.create({ maxEntries, maxBytes });
h.execute(action)  h.commit(action)  h.replaceCurrent(action)  h.clear()
h.undo() / h.redo()               // → { label, viewState } | null
h.canUndo  h.canRedo  h.undoLabel  h.redoLabel
h.markSaved(position?)  h.unsaved // übersteht Trim und verworfene Redo-Zweige
h.subscribe(listener)             // → unsubscribe
```

#### core/controls

Zustand der Knöpfe Speichern, Undo, Redo aus `history` und `session`.

```js
controls.state({ history, session }, strings)
// → { undo: { disabled, label }, redo: { disabled, label }, save: { dirty, count, label, conflict } }
```

#### core/text

```js
text.split(source)              // → { lines, newline, bom, finalNewline }
text.join(doc)                  // exakte Umkehrung von split
text.findInvalidCharacter(src)  // → { line, column } | null
text.escapeHtml(value)
class MDLFormatError { line, column, code }   /** MDLFormatWarning: { line, kind, text } */
```

#### core/markdown

Zeilenscanner für den gemeinsamen Dialekt; kein CommonMark. Unbekannte Zeilen bleiben erhalten. Serializer bleiben in den Apps.

```js
markdown.scan(lines)              // → heading | task | item | marker | blank | text, je mit Zeilennummer
markdown.trailingTag(text)        // "Arzt #health" → { text: "Arzt", tag: "health" }
markdown.keyBlocks(tokens, schema)// #Key-Blöcke: { Start: "single", Except: "list", Note: "prose" }
markdown.sections(tokens, level)
```

#### core/inline

```js
inline.parse(text)             // → text | strong | em | strike | code | link
inline.plainText(text)         // ohne Markierungen; schneller Pfad ohne Marker
inline.render(tokens, document)// DocumentFragment ohne innerHTML; Links nur http(s), mailto, tel
```

#### core/search

Scorer von MD_Manager (Teilfolge, Wortgrenzen, Smart Case, Positionen, Top-K mit Schwelle). Optionen für MD_Calendar: Diakritika, Mehrwortsuche. Die App liefert Felder, Gewichte und Tiebreak.

```js
const index = search.createIndex(items, { fields: [{ get, weight }], normalize: "case" | "diacritics" });
index.update(items)
index.query(text, { limit, tieBreak })   // → [{ item, score, field, positions }]
```

#### core/dates

Tagesschlüssel `YYYY-MM-DD`, keine Zeitzonen, keine Abhängigkeit.

```js
dates.parse("10.11.2026")  format(key)  addDays(key, n)  diff(a, b)
dates.isoWeek(key)  weekStart(key)  periodStart(key, "week" | "month" | "quarter" | "year")
dates.parseRange("10.11.2026 - TBD")     // → { start, end | null }
```

#### platform/storage

```js
/** MDLStorageAdapter: { name, list(), read(file) → { text, stamp } | null, stat(file) → stamp | null,
 *                       write(file, text, expected) → stamp } */
storage.folder(directoryHandle, { files })
storage.file(fileHandle)          // Einzeldatei (MD_Manager)
storage.memory(files)             // Tests
storage.missingApis(names)  storage.ensurePermission(handle, mode, { prompt })
class MDLStorageConflictError { file, text, stamp }
```

Schreibvorgänge eines Adapters laufen über eine serialisierte Schlange. Stempel sind opake Strings; später `drive()`, `webdav()`.

#### platform/handles

Gemerkte Handles in IndexedDB; gleiches Handle per `isSameEntry` zusammengeführt.

```js
const store = handles.create({ database, limit });   // MD_Manager 5, MD_Calendar 1
store.list()  store.get(id)  store.remember(handle, data)  store.forget(id)
```

#### platform/session

Speichern, externe Änderungen, Konflikte. Reine Logik mit injiziertem Adapter, Scheduler und Serialisierern.

```js
const s = session.create({
  adapter, history,
  files: { "Calendar.md": { writable: true, serialize, load }, "Holidays.md": { writable: false, load } },
  writeOrder, pollInterval: 2000, isBusy, scheduler,
  dirty: "history" | "content"      // MD_Calendar | MD_Manager
});
s.open()  s.save({ force })  s.check()  s.reload()  s.overwrite()  s.destroy()
s.hasConflict  s.unsaved
s.on("reloaded" | "conflict" | "saved" | "error", listener)
s.installLeaveGuard()
```

Regeln: erneuter Versuch, wenn sich nur der Stempel änderte; gelöschte Datei ist immer ein Konflikt; nur lesbare Dateien werden immer neu geladen; neuer Verlauf nach Reload; Sitzungs-Token gegen veraltete Antworten; unveränderter Inhalt gilt als gespeichert. Später: `rebase()` für Mehrgeräte-Konflikte.

#### platform/startup

```js
startup.check({ apis, cssToken, fonts, images })   // → { apis: [], resources: [] }
```

Die App ordnet das Ergebnis ihren Fehlercodes zu und ruft `notifications.fatal`.

#### platform/audio

```js
const synth = audio.createSynth({ masterGain, dry, wet, plate: { seconds, seed } });
synth.play(voices)   synth.muted = true   synth.destroy()
audio.presets.sweepDuo   audio.presets.arpeggio
```

#### ui/notifications

```js
const n = notifications.create({ container, codePrefix, duration, maxTextLength, strings, icons, symbols });
n.show(severity, title, body, { code, details, persistent, actions, symbol })   // → { dismiss(), isOpen() }
n.fatal(title, body, { details, code, block })
n.installGlobalErrorReporting({ codes, title, body })
```

#### ui/tooltips

```js
tooltips.create({ element, attribute: "data-tooltip", delay: 350, touch: true, focusVisibleOnly: false })   // MD_Calendar: touch false, focusVisibleOnly true
```

#### ui/keymap

Eine Quelle für Kürzel und Hilfe; Escape als Stapel.

```js
const k = keymap.create({ target: document });
k.bind("mod+s", save, { group, label, whenEditable })
k.pushEscape(close)   // → release
k.helpModel()
keymap.isEditableTarget(target)
```

#### ui/dom

```js
dom.frame(callback)                          // → { schedule(), cancel() }, ein rAF
dom.place(element, point | { anchor, side }, { margin })
dom.dismissable(element, { onDismiss })
dom.writeClipboard(text)                     // mit Fallback
```

#### ui/sortable

Dünne Schicht über SortableJS mit den Optionen beider Apps. Standardwerte wie MD_Manager.

```js
const list = sortable.create(element, {
  group, items, handle, ignore, fixed, animation, easing, emptyInsertThreshold, fallback,
  touch: { delay, tolerance }, classes: { ghost, chosen, drag },
  accept, onStart, onHover, onDrop: ({ item, fromList, fromIndex, toList, toIndex, revert }) => {}
});
```

Purer Kern: `insertionIndex(…)` (Rechnung von MD_Manager) und `entryPosition(siblings, skip)` (MD_Calendar).

#### ui/drag

Ziehen ohne Liste (Mehrtagesbalken, Lasso).

```js
drag.create(element, { threshold, hold, capture, onStart, onMove, onEnd, onCancel })
// state: { startX, startY, x, y, dx, dy, pointerType, target }
```

Purer Kern: Zustandsmaschine `idle → pressed → dragging → ended | cancelled`.

#### ui/menu

Kontextmenü mit `menu`/`menuitem`, Pfeiltasten, Fokusrückgabe, Long-Press.

#### Pure Kerne mit Browser-Anteil

| Modul | Kern | Kleber |
|---|---|---|
| notifications | `planTrim`, `compactText`, `copyText`, Zustandsmaschine | Elemente bauen, Höhen messen |
| tooltips | Zustandsmaschine, `placeTooltip` | Listener, Rects lesen, Position schreiben |
| dom, menu | `clampToViewport`, `placeBelow`, Fokuslogik | Rect lesen, Style schreiben, `focus()` |
| keymap | `parseCombo`, `match`, Escape-Stapel, `helpModel` | ein `keydown`-Listener |
| audio | `schedule`, `plateImpulse` | Knoten erzeugen und trennen |
| storage | Konfliktentscheidung, Schreibschlange | Handles, `createWritable` |
| handles | Recent-Liste | IndexedDB-Transaktion |
| startup | Ergebnis aus Messwerten | `getComputedStyle`, Fonts, Bilder |

#### harness

| Modul | Inhalt | Status |
|---|---|---|
| `build` | `build(esbuild, { root })`, `bundleForTests(esbuild, { root, files, prelude })` | vorhanden |
| `load-classic` | lädt Produktionsmodule für Unit-Tests in einen `vm`-Kontext | geplant |
| `fakes` | Memory-Adapter, Scheduler/Uhr, FS-Access-Handles, IndexedDB, AudioContext | geplant |
| `storage-contract` | Vertragssuite für jeden Speicher-Adapter | geplant |
| `architecture` | Regel-Engine des Architektur-Checkers; Apps liefern ihre Regeln | geplant |
| `icons` | Abgleich Icon-Sprite ↔ SVG-Dateien | geplant |
| `eslint` | Flat-Config-Fabrik inkl. Verbot von `.only`/`.skip` | geplant |

Kein Playwright in MD_Libs. E2E-Fixtures (Konsolenfehler-Wächter, statischer Server, OPFS-Ordnerauswahl) bleiben in den Apps.

---

## 4. Umbauten in den Apps

Verhaltensneutral, jeweils direkt vor dem Herauslösen des betroffenen Moduls.

| Umbau | App | Ziel |
|---|---|---|
| Speichern und externe Änderungen aus `app.js` lösen | beide | `platform/session` |
| `undoSystem` → `history` | MD_Manager | `core/history`, gleiche Semantik |
| Zustand der Kopfzeilen-Knöpfe (`ui/header.js`, `updateUndoSystemControls`) | beide | `core/controls` |
| Kürzel, Escape-Handler, Hilfe-Liste | beide | `ui/keymap` |
| Platzierung schwebender Elemente | MD_Calendar | `ui/dom` |
| rAF-Bündelung | beide | `dom.frame` |
| Format-Parser (`*-format.js`) | MD_Calendar | `core/text` + `core/markdown`, Golden Files bitgleich |
| Datumshilfen | beide | `core/dates` |
| Suche | beide | `core/search` |
| `Sortable.create` + Index-Rechnung | beide | `ui/sortable` |
| Balken-Ziehen, Lasso | MD_Calendar | `ui/drag` |
| Zwischenablage | beide | `dom.writeClipboard` |

---

## 5. Tests

### 5.1 Regeln

1. Ein Verhalten wird genau einmal getestet: im Repo, dem der Code gehört, auf der billigsten Ebene.
2. MD_Libs testet nur mit `node:test`, mit Coverage-Schwellen (95 % Zeilen und Funktionen, 90 % Zweige). Kein Playwright, keine Browser-, keine visuellen Tests.
3. Randfälle und Wettläufe (Speichern während einer Prüfung, veraltete Prüfung nach Reload, viele Meldungen, Gleichstände) laufen in MD_Libs vollständig mit Fakes.
4. Die Apps testen MD_Libs nicht nach. Pro gemeinsamem System bleibt ein E2E-Pfad, der Verdrahtung und Browser-Kleber beweist.
5. App-Unit-Tests nutzen `harness/fakes` statt eigener Fakes.
6. Jeder Speicher-Adapter besteht `harness/storage-contract`.
7. Differenztests (`test/reference/`) werden gelöscht, sobald das Modul in MD_Manager integriert und dort grün ist.
8. Golden-File-Round-Trips bleiben in den Apps. MD_Libs testet den Scanner mit eigenem Korpus (BOM, CRLF, ohne Endzeilenumbruch, unbekannte Zeilen).
9. In MD_Libs zusätzlich: Export-Snapshot je Einstiegspunkt, `core` ohne DOM-Zugriff beim Import, Typprüfung eines `checkJs`-Konsumenten, CI auf Linux, Windows und macOS.

### 5.2 Konsolidierung

| Heute | Tests | Künftig | Version |
|---|---|---|---|
| MD_Manager `undo-system.test.js`, MD_Calendar `history.test.js` | 3 + 3 | `core/history`; beide App-Dateien entfallen | 0.2.0 |
| MD_Manager `files.test.js`, `file-conflicts.test.js` | 7 + 3 | `platform/storage`, `platform/handles`, Vertragssuite; in MD_Manager bleiben die app-eigenen Recent-Daten (Feature-Breite, Archiv-Optionen) | 0.2.0 |
| MD_Calendar `storage.spec.js` | 1 E2E | Vertragssuite; entfällt | 0.2.0 |
| MD_Manager `review-persistence.spec.js`, `external-changes.spec.js`, MD_Calendar `week.spec.js` (Konflikt, Reload) | 9 + 4 + 2 E2E | `platform/session`; je App bleiben ein Konfliktpfad (Reload/Overwrite) und ein Pfad für stilles Neuladen | 0.2.0 |
| MD_Manager `search.test.js`, generischer Teil | ~10 | `core/search`; Index-Aufbau bleibt in MD_Manager | 0.2.0 |
| MD_Calendar `search-import.test.js`, Suche | 1 | `core/search`; ICS-Import bleibt | 0.2.0 |
| MD_Manager `sounds.test.js` | 1 | `platform/audio` | 0.3.0 |
| Notification- und Startfehler-Logik aus MD_Manager-E2E | – | `ui/notifications`, `platform/startup`; die E2E-Tests bleiben als Verdrahtungsnachweis | 0.3.0 |
| `architecture-checker.test.js` beider Apps | 6 + 5 | `harness/architecture` | 0.3.0 |
| `icons.test.js` beider Apps | 3 + 2 | `harness/icons`; je App ein Aufruf | 0.3.0 |
| `load-classic.js` beider Apps | – | `harness/load-classic` | 0.3.0 |
| Index-Rechnung der Drag-Tests in MD_Manager | – | Unit-Test von `ui/sortable`; die E2E-Tests ziehen mit der echten Maus | 0.3.0 |

---

## 6. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Nutzerverhalten von MD_Manager ändert sich | Leitregeln 1–4: MD_Manager-Code als Basis, Standardwerte = MD_Manager, Differenztests, unveränderte E2E-Assertions und Baselines. |
| Fakes weichen vom Browser ab | Fakes bilden nur die genutzte API-Fläche nach; die E2E-Pfade der Apps laufen gegen echte APIs. |
| Veralteter Build nach `git pull` | `npm run build` nach jedem Pull; der Hinweis auf der Seite erscheint nur, wenn `dist/app.js` ganz fehlt. |
| Golden Files ändern sich durch den Scanner | Bitgleicher Round-Trip ist Abnahmekriterium. |
| Mehraufwand durch zwei Repos | `npm link` beim gemeinsamen Entwickeln. |
