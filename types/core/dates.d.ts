/**
 * Parses `YYYY-MM-DD`, `DD.MM.YYYY` or `DD.MM.YY` (20YY). Surrounding whitespace is ignored.
 * @param {string} value
 * @returns {{ key: string, year: number, month: number, day: number, time: number } | null} `null` for other text and days that do not exist.
 */
export function parse(value: string): {
    key: string;
    year: number;
    month: number;
    day: number;
    time: number;
} | null;
/** UTC midnight of a day key, in ms. @param {string} key */
export function toTime(key: string): number;
/** Day key of a UTC time. @param {number} time */
export function fromTime(time: number): string;
/** Days since 1970-01-01. @param {string} key */
export function dayNumber(key: string): number;
/** `DD.MM.YYYY`. @param {string} key */
export function format(key: string): string;
/** The local calendar day of a moment. @param {Date} now */
export function today(now: Date): string;
/** @param {string} key @param {number} days */
export function addDays(key: string, days: number): string;
/** Days from `from` to `to`; negative when `to` is earlier. @param {string} from @param {string} to */
export function diff(from: string, to: string): number;
/** First day of the month `months` after the month of `key`. @param {string} key @param {number} [months] */
export function monthStart(key: string, months?: number): string;
/** Monday of the ISO week of `key`. @param {string} key */
export function weekStart(key: string): string;
/**
 * First day of the period that contains `day`: the day itself, its Monday, the first of its month, quarter or
 * year. `years` groups years into blocks that start at a multiple of `years` (5 → 2025, 2030, …); it applies to
 * the unit `year` only. Takes a day key or a UTC time and returns the same kind; times also reach years a key
 * cannot write.
 * @overload
 * @param {string} day @param {MDLPeriodUnit} unit @param {number} [years] @returns {string}
 */
export function periodStart(day: string, unit: MDLPeriodUnit, years?: number): string;
/**
 * @overload
 * @param {number} day @param {MDLPeriodUnit} unit @param {number} [years] @returns {number}
 */
export function periodStart(day: number, unit: MDLPeriodUnit, years?: number): number;
/**
 * `day` moved by `count` periods; negative counts move back. Months, quarters and years keep the day of the
 * month and let it overflow like `Date` does: 2026-01-31 plus one month is 2026-03-03. Applied to a period
 * start, the result is the start of the period `count` periods later. Takes a day key or a UTC time and
 * returns the same kind.
 * @overload
 * @param {string} day @param {MDLPeriodUnit} unit @param {number} count @returns {string}
 */
export function addPeriod(day: string, unit: MDLPeriodUnit, count: number): string;
/**
 * @overload
 * @param {number} day @param {MDLPeriodUnit} unit @param {number} count @returns {number}
 */
export function addPeriod(day: number, unit: MDLPeriodUnit, count: number): number;
/** ISO-8601 week number: weeks run Monday to Sunday and belong to the year of their Thursday. @param {string} key */
export function isoWeek(key: string): number;
/**
 * Formats a day key with the tokens `YYYY`, `MMMM` (month name), `MMM` (short month name), `MM`, `M`,
 * `DD`, `D`, `dddd` (weekday name) and `dd` (short weekday name). Other characters are kept.
 * Names come from the app, so the output is the same on every platform.
 * @param {string} key @param {string} pattern @param {MDLDateNames} names
 */
export function formatPattern(key: string, pattern: string, names: MDLDateNames): string;
export type MDLPeriodUnit = "day" | "week" | "month" | "quarter" | "year";
/**
 * Names for `formatPattern`, Sunday first, January first.
 */
export type MDLDateNames = {
    days: string[];
    daysShort: string[];
    months: string[];
    monthsShort: string[];
};
