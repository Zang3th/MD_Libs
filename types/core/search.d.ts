/**
 * Builds a search index. Field texts are prepared once; extending the previous query only rescores its
 * matches, which is exact because extending a subsequence query can only remove matches.
 * @template T
 * @param {MDLSearchOptions<T>} options
 * @returns {MDLSearchIndex<T>}
 */
export function create<T>({ items, fields, fold, words, tieBreak }: MDLSearchOptions<T>): MDLSearchIndex<T>;
export type MDLFold = "case" | "diacritics";
export type MDLSearchOptions<T> = {
    items: T[];
    /**
     * Searched texts per item; `weight` is added to a match in that field.
     */
    fields: Array<{
        get: (item: T) => string;
        weight?: number;
    }>;
    /**
     * `"case"` (default): smart case, an all-lowercase query ignores case and any uppercase
     * character makes it case-sensitive. `"diacritics"`: always ignores case and diacritics; `ß` matches `ss`.
     */
    fold?: MDLFold;
    /**
     * Split the query at whitespace; every word must match some field, scores add up.
     */
    words?: boolean;
    /**
     * Orders equal scores after the shorter matched text.
     */
    tieBreak?: (left: T, right: T) => number;
};
/**
 * `field` and `positions` describe the match of the first query word; with `fold: "case"` positions index the field text.
 */
export type MDLSearchResult<T> = {
    item: T;
    score: number;
    field: number;
    positions: number[];
};
export type MDLSearchIndex<T> = {
    items: T[];
    /**
     *   At most `limit` (default 50) results, best first; `total` counts every match.
     */
    query: (query: string, options?: {
        limit?: number;
    }) => {
        results: Array<MDLSearchResult<T>>;
        total: number;
    };
};
