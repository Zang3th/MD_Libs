import assert from "node:assert/strict";
import test from "node:test";
import { dates } from "../../src/core/index.js";

test("parsing accepts ISO, DD.MM.YYYY and DD.MM.YY and rejects days that do not exist", () => {
  assert.deepEqual(dates.parse(" 10.11.2026 "), { key: "2026-11-10", year: 2026, month: 11, day: 10, time: Date.UTC(2026, 10, 10) });
  assert.equal(dates.parse("2026-11-10")?.key, "2026-11-10");
  assert.equal(dates.parse("01.02.26")?.key, "2026-02-01");
  assert.equal(dates.parse("29.02.2028")?.key, "2028-02-29");
  for (const invalid of ["29.02.2026", "31.04.2026", "00.01.2026", "1.1.2026", "2026-13-01", "TBD", ""]) assert.equal(dates.parse(invalid), null, invalid);
});

test("keys convert to times, day numbers and DD.MM.YYYY and back", () => {
  assert.equal(dates.toTime("1970-01-02"), 86400000);
  assert.equal(dates.fromTime(Date.UTC(2026, 0, 31, 23)), "2026-01-31");
  assert.equal(dates.dayNumber("1970-01-11"), 10);
  assert.equal(dates.format("2026-03-04"), "04.03.2026");
  assert.equal(dates.today(new Date(2026, 10, 10, 23, 59)), "2026-11-10");
});

test("day arithmetic crosses months, years and daylight-saving changes", () => {
  assert.equal(dates.addDays("2026-03-28", 2), "2026-03-30");
  assert.equal(dates.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(dates.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(dates.diff("2026-10-24", "2026-10-26"), 2);
  assert.equal(dates.diff("2026-10-26", "2026-10-24"), -2);
  assert.equal(dates.monthStart("2026-11-30"), "2026-11-01");
  assert.equal(dates.monthStart("2026-11-30", 2), "2027-01-01");
  assert.equal(dates.monthStart("2026-01-15", -1), "2025-12-01");
});

test("weeks start on Monday and are numbered by ISO 8601", () => {
  assert.equal(dates.weekStart("2026-11-15"), "2026-11-09");
  assert.equal(dates.weekStart("2026-11-09"), "2026-11-09");
  assert.equal(dates.isoWeek("2026-11-10"), 46);
  assert.equal(dates.isoWeek("2027-01-01"), 53, "a Friday belongs to the last week of the previous year");
  assert.equal(dates.isoWeek("2024-12-30"), 1, "a Monday can start week 1 of the next year");
});

test("patterns format a day with the names the app supplies", () => {
  const names = {
    days: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
    daysShort: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    monthsShort: ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."]
  };
  assert.equal(dates.formatPattern("2026-11-10", "dddd, D. MMMM YYYY", names), "Dienstag, 10. November 2026");
  assert.equal(dates.formatPattern("2026-09-01", "dd, DD.MM.YYYY · D. MMM · M", names), "Di, 01.09.2026 · 1. Sept. · 9");
  assert.equal(dates.formatPattern("2026-03-08", "MMMM 0000", names), "März 0000");
});

test("periodStart finds the first day of a day, week, month, quarter and year, and of year blocks", () => {
  assert.equal(dates.periodStart("2026-11-12", "day"), "2026-11-12");
  assert.equal(dates.periodStart("2026-11-15", "week"), "2026-11-09");
  assert.equal(dates.periodStart("2026-11-12", "month"), "2026-11-01");
  assert.equal(dates.periodStart("2026-11-12", "quarter"), "2026-10-01");
  assert.equal(dates.periodStart("2026-03-31", "quarter"), "2026-01-01");
  assert.equal(dates.periodStart("2026-11-12", "year"), "2026-01-01");
  assert.equal(dates.periodStart("2026-11-12", "year", 5), "2025-01-01");
  assert.equal(dates.periodStart("2026-11-12", "year", 10), "2020-01-01");
  assert.equal(dates.periodStart("2026-11-12", "month", 10), "2026-11-01", "blocks apply to years only");
});

test("addPeriod moves by periods and lets the day of the month overflow", () => {
  assert.equal(dates.addPeriod("2026-12-30", "day", 3), "2027-01-02");
  assert.equal(dates.addPeriod("2026-11-09", "week", -2), "2026-10-26");
  assert.equal(dates.addPeriod("2026-11-01", "month", 2), "2027-01-01");
  assert.equal(dates.addPeriod("2026-01-31", "month", 1), "2026-03-03");
  assert.equal(dates.addPeriod("2026-10-01", "quarter", 1), "2027-01-01");
  assert.equal(dates.addPeriod("2024-02-29", "year", 1), "2025-03-01");
  assert.equal(dates.addPeriod("2025-01-01", "year", -5), "2020-01-01");
});

test("periods also work on UTC times, beyond the years a key can write", () => {
  const time = dates.toTime("2026-11-12");
  assert.equal(dates.periodStart(time, "quarter"), dates.toTime("2026-10-01"));
  assert.equal(dates.addPeriod(time, "week", 1), dates.toTime("2026-11-19"));
  assert.equal(dates.addPeriod(time, "month", -1), dates.toTime("2026-10-12"));
  const ancient = Date.UTC(-300, 6, 15);
  assert.equal(dates.periodStart(ancient, "year", 10), Date.UTC(-300, 0, 1));
  assert.equal(dates.addPeriod(Date.UTC(-300, 0, 1), "year", 10), Date.UTC(-290, 0, 1));
  assert.equal(dates.periodStart(ancient, "day"), ancient);
});
