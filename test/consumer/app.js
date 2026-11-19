// A consumer as the applications are: browser code checked with checkJs that imports MD_Libs by package name.
// `npm run check:types` checks it; every @ts-expect-error fails the check when the types degrade to `any`.
import { dates, history, markdown, search } from "@zang3th/md-libs/core";
import { session, storage } from "@zang3th/md-libs/platform";
import { notifications, popover } from "@zang3th/md-libs/ui";

/** @type {string} */
export const week = dates.periodStart(dates.today(new Date()), "week");
// @ts-expect-error: the unit is a fixed set
dates.periodStart(week, "decade");

export const undo = history.create({ fingerprint: () => history.fingerprint(["text"]) });
// @ts-expect-error: execute takes an action object
undo.execute("label");
undo.execute({ label: "edit", coalesce: "field", redo() {}, undo() {} });
// @ts-expect-error: the fingerprint is made from texts
history.fingerprint([1]);

/** @type {number | undefined} */
export const line = markdown.invalidCharacter("text")?.line;

export const index = search.create({ items: ["a"], fields: [{ get: item => item }] });
// @ts-expect-error: query takes a string
index.query(1);

/** @param {FileSystemDirectoryHandle} directory */
export async function open(directory) {
  const adapter = storage.folder(/** @type {any} */ (directory), { files: ["A.md"] });
  const opened = await session.open({ adapter, files: { "A.md": { load: () => {} } }, window, confirmLeave: true });
  // @ts-expect-error: events are a fixed set
  opened.on("unknown", () => {});
  return opened;
}

/** @param {HTMLElement} element */
export function notices(element) {
  const stack = notifications.create({ window, container: element });
  stack.show("warning", "Changed", "", { actions: [{ label: "Keep", tone: "success", run() {} }] });
  // @ts-expect-error: the tones are a fixed set
  stack.show("warning", "Changed", "", { actions: [{ label: "Keep", tone: "loud", run() {} }] });
  return stack;
}

/** @param {HTMLElement} element */
export function menu(element) {
  const created = popover.create({ window, element, dismiss: "pointerdown" });
  // @ts-expect-error: isOpen is a boolean
  created.isOpen();
  return created;
}
