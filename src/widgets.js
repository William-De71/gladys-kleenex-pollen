// -----------------------------------------------------------------------------
// Dashboard widgets of the Kleenex Pollen Radar integration.
//
//   - `forecast`  the pollen of a city on the days the radar gives (five):
//                 trees, grass and weeds of today as tiles, one card per day
//                 (level, counts, main species), the main pollen, the source
//                 and the reading time as a status list;
//   - `species`   the species counted today, highest first, with their level.
//
// The contents come from the last reading kept by the integration: a widget
// never costs a request to the pollen radar. Colors are semantic (success,
// warning, danger). Every text exists in the four languages (the content is
// cached per language). Content budget of a card: 8 components, 1 main one,
// 6 tiles, 2 texts, 1 status, 4 buttons.
// -----------------------------------------------------------------------------

import { t, levelLabel, speciesName, shortDateTime } from './i18n.js';
import { POLLEN_TYPES, overallLevel } from './parse.js';
import { mainPollenText } from './device.js';
import { speciesList } from './events.js';
import { displayInstant } from './time.js';

const WIDGETS = { FORECAST: 'forecast', SPECIES: 'species' };
// The forecast changes a few times a day: an hour of cache, nudged after each reading.
const TTL = { data: 3600, message: 300 };
// A card list in `list` display holds 8 items at most.
const MAX_SPECIES = 8;

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL.message) {
  return {
    ttl_seconds: ttl,
    components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
  };
}

/**
 * @description The color of a pollen level.
 * @param {number|null} level - 1 to 4 (else neutral).
 * @returns {string} A semantic color.
 */
function levelColor(level) {
  if (!Number.isInteger(level) || level < 1) {
    return 'neutral';
  }
  if (level === 1) {
    return 'success';
  }
  return level === 2 ? 'warning' : 'danger';
}

/**
 * @description The name of a day of the forecast.
 * @param {number} index - 0 for today.
 * @param {string} date - `YYYY-MM-DD`.
 * @param {string} language - The language.
 * @returns {string} "Today", "Tomorrow", "Tuesday".
 */
function dayName(index, date, language) {
  if (index < 2) {
    return t(`day_${index}`, language);
  }
  const name = new Intl.DateTimeFormat(language, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * @description The card of a day of the forecast widget.
 * @param {object} input - `{ index, day, language }` (day: a dated day of the forecast).
 * @returns {object} A card-list item.
 */
function dayCard({ index, day, language }) {
  const level = overallLevel(day);
  const counts = Object.fromEntries(POLLEN_TYPES.map((type) => [type, day[type]?.count ?? '-']));
  const species = speciesList(day, language);
  const lines = [
    t('widgetCounts', language, counts),
    species ? t('widgetSpecies', language, { list: species }) : t('widgetNoSpecies', language),
  ];
  return {
    // The level is the badge: the title is the day alone.
    title: clip(dayName(index, day.date, language), 60),
    date: displayInstant(day.date),
    ...(level ? { badge: { text: levelLabel(level, language), color: levelColor(level) } } : {}),
    description: clip(lines.join('\n'), 2000),
  };
}

/**
 * @description The source and reading time items of a status list.
 * @param {object} input - `{ region, fetchedAt, language, timeZone }`.
 * @returns {object[]} The items.
 */
function provenanceItems({ region, fetchedAt, language, timeZone }) {
  const items = [
    {
      label: t('widgetSource', language),
      value: clip(`Kleenex · ${t(`region_${region}`, language)}`, 40),
      color: 'neutral',
    },
  ];
  if (fetchedAt) {
    items.push({
      label: t('widgetUpdated', language),
      value: shortDateTime(fetchedAt, language, timeZone),
      color: 'neutral',
    });
  }
  return items;
}

/**
 * @description The forecast widget of a place.
 * @param {object} input - Input.
 * @param {object} input.place - `{ city, region }`.
 * @param {object[]} input.days - The days from today, each with its `date`.
 * @param {number|null} input.fetchedAt - When the forecast was read.
 * @param {string} input.language - The language.
 * @param {string} [input.timeZone] - IANA timezone of the times.
 * @returns {object} The content.
 */
function buildForecastWidget({ place, days, fetchedAt, language, timeZone }) {
  const today = days[0] ?? null;
  const components = [{ type: 'text', variant: 'heading', text: clip(place.city, 40) }];
  for (const type of POLLEN_TYPES) {
    const pollen = today?.[type];
    const count = Number.isFinite(pollen?.count) ? pollen.count : null;
    components.push({
      type: 'value',
      label: t(`type_${type}`, language),
      value: count ?? '-',
      ...(count === null ? {} : { unit: t('widgetUnit', language) }),
      color: levelColor(pollen?.level ?? null),
    });
  }
  if (days.length) {
    components.push({
      type: 'card-list',
      display: 'list',
      items: days.map((day, index) => dayCard({ index, day, language })),
    });
  }
  const items = [];
  const main = mainPollenText(today, language);
  if (main) {
    items.push({
      label: t('widgetMainPollen', language),
      value: clip(main, 40),
      color: levelColor(overallLevel(today)),
    });
  }
  items.push(...provenanceItems({ region: place.region, fetchedAt, language, timeZone }));
  components.push({ type: 'status', items });
  return { ttl_seconds: TTL.data, components };
}

/**
 * @description The species widget of a place.
 * @param {object} input - `{ place, today, fetchedAt, language, timeZone }`.
 * @returns {object} The content.
 */
function buildSpeciesWidget({ place, today, fetchedAt, language, timeZone }) {
  const components = [{ type: 'text', variant: 'heading', text: clip(place.city, 40) }];
  const species = POLLEN_TYPES.flatMap((type) =>
    (today?.[type]?.species ?? []).map((item) => ({ type, ...item })),
  ).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  if (species.length) {
    components.push({
      type: 'card-list',
      display: 'list',
      items: species.slice(0, MAX_SPECIES).map((item) => ({
        title: clip(speciesName(item.name, language), 60),
        subtitle: clip(
          `${t(`type_${item.type}`, language)} · ${item.count} ${t('widgetGrains', language)}`,
          60,
        ),
        ...(item.level
          ? { badge: { text: levelLabel(item.level, language), color: levelColor(item.level) } }
          : {}),
      })),
    });
  } else {
    components.push({ type: 'text', variant: 'body', text: t('widgetSpeciesEmpty', language) });
  }
  components.push({
    type: 'status',
    items: provenanceItems({ region: place.region, fetchedAt, language, timeZone }),
  });
  return { ttl_seconds: TTL.data, components };
}

/**
 * @description Read the settings of a widget.
 * @param {object} [settings] - The settings.
 * @returns {{ place: string|null }} The device external id chosen, or null.
 */
const readWidgetSettings = (settings = {}) => ({
  place: typeof settings?.place === 'string' && settings.place ? settings.place : null,
});

export {
  WIDGETS,
  TTL,
  clip,
  messageContent,
  levelColor,
  dayName,
  buildForecastWidget,
  buildSpeciesWidget,
  readWidgetSettings,
};
