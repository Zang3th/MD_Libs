import assert from "node:assert/strict";
import test from "node:test";
import { segmented } from "../../src/ui/index.js";
import { createWindow } from "../helpers/dom.js";

test("the selected button is marked and the indicator moves by button widths", () => {
  const window = createWindow("<button></button><button></button><button></button><span></span>");
  const buttons = [...window.document.querySelectorAll("button")];
  const thumb = window.document.querySelector("span");
  segmented.select({ buttons, selected: 2, thumb });
  assert.deepEqual(buttons.map(button => button.getAttribute("aria-pressed")), ["false", "false", "true"]);
  assert.equal(thumb.style.transform, "translateX(200%)");
  segmented.select({ buttons, selected: 0, attribute: "aria-selected" });
  assert.deepEqual(buttons.map(button => button.getAttribute("aria-selected")), ["true", "false", "false"]);
  segmented.select({ buttons, selected: -1, thumb });
  assert.equal(thumb.style.transform, "translateX(200%)");
});
