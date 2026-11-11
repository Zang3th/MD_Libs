/**
 * Calendar days as keys `YYYY-MM-DD`. Days carry no time zone: arithmetic runs on UTC midnights, so
 * daylight-saving changes never shift a day.
 */

const dayMs = 86400000;

/** @param {number} value @param {number} length */
function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

/**
 * Parses `YYYY-MM-DD`, `DD.MM.YYYY` or `DD.MM.YY` (20YY). Surrounding whitespace is ignored.
 * @param {string} value
 * @returns {{ key: string, year: number, month: number, day: number, time: number } | null} `null` for other text and days that do not exist.
 */
export function parse(value) {
  const source = value.trim();
  const iso = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const european = source.match(/^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/);
  if (!iso && !european) return null;
  const europeanYear = european?.[3] || "";
  const year = Number(iso?.[1] || (europeanYear.length === 2 ? `20${europeanYear}` : europeanYear));
  const month = Number(iso?.[2] || european?.[2]);
  const day = Number(iso?.[3] || european?.[1]);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { key: `${pad(year, 4)}-${pad(month)}-${pad(day)}`, year, month, day, time };
}

/** UTC midnight of a day key, in ms. @param {string} key */
export function toTime(key) {
  return Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
}

/** Day key of a UTC time. @param {number} time */
export function fromTime(time) {
  const date = new Date(time);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Days since 1970-01-01. @param {string} key */
export function dayNumber(key) {
  return toTime(key) / dayMs;
}

/** `DD.MM.YYYY`. @param {string} key */
export function format(key) {
  return `${key.slice(8, 10)}.${key.slice(5, 7)}.${key.slice(0, 4)}`;
}

/** The local calendar day of a moment. @param {Date} now */
export function today(now) {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** @param {string} key @param {number} days */
export function addDays(key, days) {
  return fromTime(toTime(key) + days * dayMs);
}

/** Days from `from` to `to`; negative when `to` is earlier. @param {string} from @param {string} to */
export function diff(from, to) {
  return Math.round((toTime(to) - toTime(from)) / dayMs);
}

/** First day of the month `months` after the month of `key`. @param {string} key @param {number} [months] */
export function monthStart(key, months = 0) {
  return fromTime(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + months, 1));
}

/** Monday of the ISO week of `key`. @param {string} key */
export function weekStart(key) {
  const time = toTime(key);
  return fromTime(time - ((new Date(time).getUTCDay() || 7) - 1) * dayMs);
}

/** ISO-8601 week number: weeks run Monday to Sunday and belong to the year of their Thursday. @param {string} key */
export function isoWeek(key) {
  const time = toTime(key);
  const thursday = new Date(time + (4 - (new Date(time).getUTCDay() || 7)) * dayMs);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday.getTime() - yearStart) / dayMs + 1) / 7);
}

/**
 * Names for `formatPattern`, Sunday first, January first.
 * @typedef {{ days: string[], daysShort: string[], months: string[], monthsShort: string[] }} MDLDateNames
 */

const patternTokens = /YYYY|MMMM|MMM|MM|M|DD|D|dddd|dd/g;

/**
 * Formats a day key with the tokens `YYYY`, `MMMM` (month name), `MMM` (short month name), `MM`, `M`,
 * `DD`, `D`, `dddd` (weekday name) and `dd` (short weekday name). Other characters are kept.
 * Names come from the app, so the output is the same on every platform.
 * @param {string} key @param {string} pattern @param {MDLDateNames} names
 */
export function formatPattern(key, pattern, names) {
  const year = key.slice(0, 4);
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  const weekday = new Date(toTime(key)).getUTCDay();
  /** @type {Record<string, string>} */
  const values = {
    YYYY: year, MMMM: names.months[month - 1], MMM: names.monthsShort[month - 1], MM: pad(month), M: String(month),
    DD: pad(day), D: String(day), dddd: names.days[weekday], dd: names.daysShort[weekday]
  };
  return pattern.replace(patternTokens, token => values[token]);
}
