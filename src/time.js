// -----------------------------------------------------------------------------
// Calendar dates and the reading pace.
//
// The pollen radar gives each day as a day of the month ("17"), the first one
// being today where the city is. They are turned into calendar dates
// ("2026-10-17") from the day the reading was made, in the timezone of the
// Gladys instance (TZ, injected by the supervisor), so a forecast kept in
// /data still knows which day is "today" after midnight.
//
// The forecast changes a few times a day at most: the integration reads every
// three hours, each instance at its own minute (a stable jitter).
// -----------------------------------------------------------------------------

const DAY_MS = 24 * 3600 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const READ_INTERVAL_MS = 3 * HOUR_MS;
const JITTER_MINUTES = 30;

/**
 * @description The timezone of the instance.
 * @returns {string|undefined} An IANA name, undefined for the system one.
 */
function defaultTimeZone() {
  return process.env.TZ || undefined;
}

/**
 * @description The local date and time of an instant in a timezone.
 * @param {number} instant - The instant, in ms.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {{ date: string, minutes: number }} `YYYY-MM-DD` and minutes since midnight.
 * @example
 * localClock(Date.parse('2026-10-17T12:00:00Z'), 'Europe/Paris'); // 2026-10-17, 840
 */
function localClock(instant, timeZone = defaultTimeZone()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/**
 * @description Shift a calendar date by a number of days.
 * @param {string} date - `YYYY-MM-DD`.
 * @param {number} days - Days to add (negative to go back).
 * @returns {string} `YYYY-MM-DD`.
 */
function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * @description The instant of a local wall-clock time in a timezone.
 * @param {string} date - `YYYY-MM-DD`.
 * @param {number} minutes - Minutes after midnight.
 * @param {string} timeZone - IANA timezone.
 * @returns {number} The instant, in ms.
 */
function zonedInstant(date, minutes, timeZone) {
  const wanted = Date.parse(`${date}T00:00:00Z`) + minutes * MINUTE_MS;
  let guess = wanted;
  // Two passes settle the offset, DST changes included.
  for (let pass = 0; pass < 2; pass += 1) {
    const clock = localClock(guess, timeZone);
    const seen = Date.parse(`${clock.date}T00:00:00Z`) + clock.minutes * MINUTE_MS;
    guess += wanted - seen;
  }
  return guess;
}

/**
 * @description The next local midnight (a little after), when "today" and
 * "tomorrow" move.
 * @param {number} now - Now, in ms.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {number} The instant, in ms.
 */
function nextMidnight(now, timeZone = defaultTimeZone()) {
  const tomorrow = addDays(localClock(now, timeZone).date, 1);
  return zonedInstant(tomorrow, 1, timeZone);
}

/**
 * @description A stable jitter, in minutes, from a seed (the cities): the
 * same instance always reads at the same minutes.
 * @param {string} seed - The seed.
 * @returns {number} 0 to JITTER_MINUTES - 1.
 */
function jitterOf(seed) {
  let hash = 0;
  for (const char of String(seed ?? '')) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return hash % JITTER_MINUTES;
}

/**
 * @description The calendar dates of the days of a forecast. The first day is
 * the day of the reading where the city is: the day before the local date of
 * the instance at most (an American city read from Europe after midnight).
 * Each next day is the first date after the previous one with that day of the
 * month.
 * @param {number[]} dayNumbers - The days of the month, in order.
 * @param {string} readDate - `YYYY-MM-DD`, the local date of the reading.
 * @returns {string[]} The dates (an unplaceable day gives an empty string).
 * @example
 * datesOf([31, 1, 2], '2026-10-31'); // ['2026-10-31', '2026-11-01', '2026-11-02']
 */
function datesOf(dayNumbers, readDate) {
  const dates = [];
  let cursor = addDays(readDate, -1);
  dayNumbers.forEach((day, index) => {
    // The first day may be yesterday, today or tomorrow; the next ones follow.
    let found = '';
    for (let step = 0; step < (index === 0 ? 3 : 31); step += 1) {
      const candidate = addDays(cursor, step);
      if (Number(candidate.slice(8, 10)) === day) {
        found = candidate;
        break;
      }
    }
    dates.push(found);
    if (found) {
      cursor = addDays(found, 1);
    }
  });
  return dates;
}

/**
 * @description A calendar date for a widget card. Gladys shows a date of
 * that exact form as the calendar day itself, without a time, in every
 * timezone (front 5.1.1+).
 * @param {string} date - `YYYY-MM-DD`.
 * @returns {string} ISO 8601 date.
 */
const displayInstant = (date) => `${date}T00:00:00.000Z`;

export {
  DAY_MS,
  MINUTE_MS,
  HOUR_MS,
  READ_INTERVAL_MS,
  JITTER_MINUTES,
  defaultTimeZone,
  localClock,
  addDays,
  zonedInstant,
  nextMidnight,
  jitterOf,
  datesOf,
  displayInstant,
};
