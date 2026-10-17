// -----------------------------------------------------------------------------
// Scene trigger and scene action outputs.
//
// Trigger (one event per transition, never a periodic snapshot):
//   - `pollen_alert`  the level of trees, grass or weeds pollen of today or
//                     tomorrow reaches "Moderate" (2) or more, or rises again.
//                     The `level` filter of the scene picks the levels that
//                     matter ("High" and "Very high" for most people).
//
// What was announced is remembered per place, date and pollen type (`seen`,
// kept in /data): a restart or the next reading never fires the same event
// twice. The first reading of a place is a baseline: no event replays it.
// -----------------------------------------------------------------------------

import { t, joinList, levelLabel, speciesName } from './i18n.js';
import { POLLEN_TYPES, overallLevel, mainType, topSpecies } from './parse.js';
import { addDays } from './time.js';

const TRIGGERS = { POLLEN_ALERT: 'pollen_alert' };
const ALERT_FROM = 2;
// `seen` keeps a few days back, then forgets.
const SEEN_DAYS = 3;
// The outputs of the `get_pollen` scene action (manifest order).
const ACTION_OUTPUTS = [
  'place_name',
  'date',
  'level',
  'label',
  'trees',
  'trees_level',
  'grass',
  'grass_level',
  'weeds',
  'weeds_level',
  'main_pollen',
  'summary',
];

/**
 * @description The species of a day (or of one type) as a list.
 * @param {object|null} day - A day of the forecast.
 * @param {string} language - The language.
 * @param {string} [type] - Only this pollen type.
 * @returns {string} "Ragweed 13 and Goosefoot 2", '' when none was counted.
 */
function speciesList(day, language, type) {
  const source = type ? { [type]: day?.[type] } : day;
  const species = topSpecies(source, 3);
  return species.length
    ? joinList(
        species.map((item) => `${speciesName(item.name, language)} ${item.count}`),
        language,
      )
    : '';
}

/**
 * @description The sentence of a day.
 * @param {object} input - `{ place, day, entry }` (entry: a day of the forecast, or null).
 * @param {string} language - The language.
 * @returns {string} The summary.
 */
function daySummary({ place, day, entry }, language) {
  const level = overallLevel(entry);
  const values = { city: place.city, day: t(`dayLower_${day}`, language) };
  if (!level) {
    return t('summaryUnknown', language, values);
  }
  const species = speciesList(entry, language);
  const type = mainType(entry);
  let main = '';
  if (species) {
    main = t('summaryMain', language, { list: species });
  } else if (type) {
    main = t('summaryMain', language, { list: t(`typeLower_${type}`, language) });
  }
  return t('summaryDay', language, {
    ...values,
    label: levelLabel(level, language).toLowerCase(),
    main,
  });
}

/**
 * @description The sentence of an alert.
 * @param {object} input - `{ place, day, entry, type }`.
 * @param {string} language - The language.
 * @returns {string} The summary.
 */
function alertSummary({ place, day, entry, type }, language) {
  const species = speciesList(entry, language, type);
  return t('summaryAlert', language, {
    type: t(`typeLower_${type}`, language),
    level: levelLabel(entry[type].level, language).toLowerCase(),
    city: place.city,
    day: t(`dayLower_${day}`, language),
    count: entry[type].count ?? '?',
    species: species ? t('summarySpecies', language, { list: species }) : '',
  });
}

/**
 * @description The scene events of a reading, and the new `seen`.
 * @param {object} input - Input.
 * @param {object[]} input.places - The places, with `id` and `deviceId`.
 * @param {Function} input.daysOf - `(placeId, date) => day|null`.
 * @param {object} input.seen - What was already announced (not modified).
 * @param {string} input.today - `YYYY-MM-DD`, local.
 * @param {string} input.language - Language of the summaries.
 * @returns {{ events: Array<{ key: string, data: object }>, seen: object }} The events and the new memory.
 */
function detectEvents({ places, daysOf, seen = {}, today, language }) {
  const events = [];
  const next = {};
  const oldest = addDays(today, -SEEN_DAYS);
  for (const place of places) {
    const before = seen[place.id];
    // A place never met: its first reading is the reference.
    const baseline = !before;
    const memory = Object.fromEntries(
      Object.entries(before ?? {}).filter(([date]) => date >= oldest),
    );
    for (const [day, date] of [
      ['today', today],
      ['tomorrow', addDays(today, 1)],
    ]) {
      const entry = daysOf(place.id, date);
      if (!entry) {
        continue;
      }
      const known = memory[date] ?? { trees: 0, grass: 0, weeds: 0 };
      for (const type of POLLEN_TYPES) {
        const level = entry[type]?.level ?? 0;
        if (level >= ALERT_FROM && level > (known[type] ?? 0) && !baseline) {
          events.push({
            key: TRIGGERS.POLLEN_ALERT,
            data: {
              place: place.deviceId,
              place_name: place.city,
              day,
              date,
              pollen_type: type,
              type_label: t(`type_${type}`, language),
              level,
              label: levelLabel(level, language),
              count: entry[type].count ?? null,
              species: speciesList(entry, language, type),
              summary: alertSummary({ place, day, entry, type }, language),
            },
          });
        }
        known[type] = Math.max(known[type] ?? 0, level);
      }
      memory[date] = known;
    }
    next[place.id] = memory;
  }
  return { events, seen: next };
}

/**
 * @description The outputs of the `get_pollen` scene action: everything known
 * about one day of a place.
 * @param {object} input - `{ place, day, date, entry }`.
 * @param {string} language - The language.
 * @returns {object} Only the declared outputs, scalars.
 */
function actionOutputs({ place, day, date, entry }, language) {
  const level = overallLevel(entry);
  const type = mainType(entry);
  const species = topSpecies(entry, 1)[0];
  let main = '';
  if (species) {
    main = speciesName(species.name, language);
  } else if (type) {
    main = t(`type_${type}`, language);
  }
  const data = {
    place_name: place.city,
    date,
    level,
    label: levelLabel(level, language),
    main_pollen: main,
    summary: daySummary({ place, day, entry }, language),
  };
  for (const pollenType of POLLEN_TYPES) {
    data[pollenType] = entry?.[pollenType]?.count ?? null;
    data[`${pollenType}_level`] = entry?.[pollenType]?.level ?? null;
  }
  return Object.fromEntries(ACTION_OUTPUTS.map((key) => [key, data[key] ?? null]));
}

export {
  TRIGGERS,
  ALERT_FROM,
  ACTION_OUTPUTS,
  speciesList,
  daySummary,
  alertSummary,
  detectEvents,
  actionOutputs,
};
