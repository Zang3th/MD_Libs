/**
 * @typedef {object} MDLResourceChecks
 * @property {Document} document
 * @property {{ token: string, file: string }} [styles] A custom property the stylesheet defines on `:root`.
 * @property {Array<{ font: string, text?: string, file: string }>} [fonts] CSS font shorthand, e.g. `400 14px "Inter"`.
 * @property {Array<{ image: Element | null, file: string }>} [images]
 */

/** @param {Document} document @param {string} font @param {string | undefined} text */
async function fontLoaded(document, font, text) {
  try {
    return (await document.fonts.load(font, text)).length > 0;
  } catch {
    return false;
  }
}

/** @param {Element | null} image */
function imageLoaded(image) {
  if (!image || !("complete" in image) || !("naturalWidth" in image)) return Promise.resolve(false);
  const element = /** @type {HTMLImageElement} */ (image);
  if (element.complete) return Promise.resolve(element.naturalWidth > 0);
  return new Promise(resolve => {
    element.addEventListener("load", () => resolve(true), { once: true });
    element.addEventListener("error", () => resolve(false), { once: true });
  });
}

/**
 * Files of required resources that did not load, in the order styles, fonts, images.
 * The app maps a non-empty result to its startup error.
 * @param {MDLResourceChecks} checks
 * @returns {Promise<string[]>}
 */
export async function missingResources({ document, styles, fonts = [], images = [] }) {
  const window = /** @type {Window} */ (document.defaultView);
  const stylesLoaded = !styles || Boolean(window.getComputedStyle(document.documentElement).getPropertyValue(styles.token).trim());
  const loaded = await Promise.all([
    ...fonts.map(font => fontLoaded(document, font.font, font.text)),
    ...images.map(image => imageLoaded(image.image))
  ]);
  return [
    ...(stylesLoaded || !styles ? [] : [styles.file]),
    ...[...fonts, ...images].filter((_, index) => !loaded[index]).map(resource => resource.file)
  ];
}

/**
 * Browser APIs that are not available, as expressions for an error message.
 * @param {{ window: object, apis: string[] }} options
 *   `apis` are globals; a name ending in `()` must be a function: `["showDirectoryPicker()", "indexedDB"]`.
 * @returns {string[]} e.g. `["window.showDirectoryPicker()", "indexedDB"]`
 */
export function missingApis({ window, apis }) {
  const globals = /** @type {Record<string, unknown>} */ (window);
  return apis.filter(api => api.endsWith("()") ? typeof globals[api.slice(0, -2)] !== "function" : globals[api] === undefined)
    .map(api => api.endsWith("()") ? `window.${api}` : api);
}
