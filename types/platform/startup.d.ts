/**
 * Files of required resources that did not load, in the order styles, fonts, images.
 * The app maps a non-empty result to its startup error.
 * @param {MDLResourceChecks} checks
 * @returns {Promise<string[]>}
 */
export function missingResources({ document, styles, fonts, images }: MDLResourceChecks): Promise<string[]>;
/**
 * Browser APIs that are not available, as expressions for an error message.
 * @param {{ window: object, apis: string[] }} options
 *   `apis` are globals; a name ending in `()` must be a function: `["showDirectoryPicker()", "indexedDB"]`.
 * @returns {string[]} e.g. `["window.showDirectoryPicker()", "indexedDB"]`
 */
export function missingApis({ window, apis }: {
    window: object;
    apis: string[];
}): string[];
export type MDLResourceChecks = {
    document: Document;
    /**
     * A custom property the stylesheet defines on `:root`.
     */
    styles?: {
        token: string;
        file: string;
    };
    /**
     * CSS font shorthand, e.g. `400 14px "Inter"`.
     */
    fonts?: Array<{
        font: string;
        text?: string;
        file: string;
    }>;
    images?: Array<{
        image: Element | null;
        file: string;
    }>;
};
