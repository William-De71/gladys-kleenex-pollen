// -----------------------------------------------------------------------------
// One Gladys device per city: "Pollen Mâcon".
//
// External ids: `ext:<selector>:place:<region>_<lat>_<lng>` and
// `…:place:<region>_<lat>_<lng>:<feature key>`, the coordinates the pollen
// radar answers for the city, to two decimals (about a kilometre). They are
// the pollen radar's own identification of the place: a new spelling that
// finds the same place keeps the same device (a postal code may be placed
// elsewhere than the city name, and give another device).
//
// Features (category / type, chosen from the SDK constants):
//   - the pollen level today and tomorrow, the highest of the three types:
//     `airquality-sensor` / `aqi`, 1 (low) to 4 (very high). A level, not a
//     concentration;
//   - the count of trees, grass and weeds pollen today, in grains per m³
//     (written "PPM" by the site): `airquality-sensor` / `aqi` without a
//     unit, 0 to 10 000 (Gladys has no pollen unit; AQI would be wrong);
//   - the level of each type today, 1 to 4;
//   - the main pollen today as text ("Ragweed 13"), in the configured language.
//
// No state is published for an unknown level or count: a scene comparing
// "level ≥ 3" must not see a fake value. `should_poll` stays false: the
// pollen radar is read on the integration's own timer.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';

import { t, speciesName } from './i18n.js';
import { POLLEN_TYPES, overallLevel, mainType, topSpecies } from './parse.js';

const DEVICE_TYPE = 'place';
const MODEL = 'Kleenex Pollen Radar';
const MAX_COUNT = 10000;

const level = {
  category: CATEGORIES.AIRQUALITY_SENSOR,
  type: TYPES.AIRQUALITY_SENSOR.AQI,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 1,
  max: 4,
};
const count = {
  category: CATEGORIES.AIRQUALITY_SENSOR,
  type: TYPES.AIRQUALITY_SENSOR.AQI,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: MAX_COUNT,
};
const text = {
  category: CATEGORIES.TEXT,
  type: TYPES.TEXT.TEXT,
  read_only: true,
  has_feedback: false,
  keep_history: false,
  min: 0,
  max: 0,
};

/**
 * @description The main pollen of a day as text.
 * @param {object|null} day - A day of the forecast.
 * @param {string} language - The language.
 * @returns {string|null} "Ragweed 13", the type when no species is known,
 * '-' when nothing was counted, null without a day.
 */
function mainPollenText(day, language) {
  if (!day) {
    return null;
  }
  const [species] = topSpecies(day, 1);
  if (species) {
    return `${speciesName(species.name, language)} ${species.count}`;
  }
  const type = mainType(day);
  return type ? `${t(`type_${type}`, language)} ${day[type].count}` : '-';
}

const usable = (value) => (Number.isFinite(value) ? value : null);

// The features: key (eternal), name (TEXTS key and values), shape, and the
// state of a place's `{ today, tomorrow }` days (null: nothing to publish).
const FEATURES = [
  {
    key: 'level',
    name: ['feature_level'],
    shape: level,
    state: ({ today }) => overallLevel(today),
  },
  {
    key: 'level_tomorrow',
    name: ['feature_level_tomorrow'],
    shape: level,
    state: ({ tomorrow }) => overallLevel(tomorrow),
  },
  ...POLLEN_TYPES.map((type) => ({
    key: type,
    name: ['feature_count', (language) => ({ type: t(`type_${type}`, language) })],
    shape: count,
    state: ({ today }) => {
      const value = usable(today?.[type]?.count ?? null);
      return value === null ? null : Math.min(MAX_COUNT, value);
    },
  })),
  ...POLLEN_TYPES.map((type) => ({
    key: `${type}_level`,
    name: ['feature_type_level', (language) => ({ type: t(`typeLower_${type}`, language) })],
    shape: level,
    state: ({ today }) => usable(today?.[type]?.level ?? null),
  })),
  {
    key: 'main_pollen',
    name: ['feature_main'],
    shape: text,
    state: ({ today }, language) => {
      const value = mainPollenText(today, language);
      return value === null ? null : { text: value };
    },
  },
];

/**
 * @description The platform id of a place: region and rounded coordinates.
 * @param {string} region - fr, uk, nl, it or us.
 * @param {number} latitude - The latitude.
 * @param {number} longitude - The longitude.
 * @returns {string} `fr_46.31_4.83`.
 */
const placeIdOf = (region, latitude, longitude) =>
  `${region}_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;

/**
 * @description The ids of a place device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} placeId - placeIdOf.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, placeId) => gladys.externalIds(DEVICE_TYPE, placeId);

/**
 * @description The place id a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @returns {string|null} The id.
 * @example
 * placeOf('ext:kleenex-pollen:place:fr_46.31_4.83:level'); // -> 'fr_46.31_4.83'
 */
function placeOf(externalId) {
  const match = /:place:([a-z]{2}_-?\d{1,3}\.\d{2}_-?\d{1,3}\.\d{2})(?::[a-z0-9_]+)?$/.exec(
    String(externalId ?? ''),
  );
  return match ? match[1] : null;
}

/**
 * @description The name of a feature.
 * @param {object} spec - The spec.
 * @param {string} language - The language.
 * @returns {string} The name.
 */
function featureName(spec, language) {
  const [key, values] = spec.name;
  return t(key, language, typeof values === 'function' ? values(language) : {});
}

/**
 * @description The device of a place.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} place - `{ id, region, city, latitude, longitude }`.
 * @param {object} options - `{ language }`.
 * @returns {object} The discovered device.
 */
function buildDevice(gladys, place, { language = 'en' } = {}) {
  const ids = idsOf(gladys, place.id);
  return {
    name: t('deviceName', language, { city: place.city }),
    external_id: ids.device,
    model: MODEL,
    should_poll: false,
    params: [
      { name: 'REGION', value: place.region },
      { name: 'CITY', value: place.city },
      { name: 'LATITUDE', value: String(place.latitude) },
      { name: 'LONGITUDE', value: String(place.longitude) },
    ],
    features: FEATURES.map((spec) => ({
      name: featureName(spec, language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The states of a place device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} placeId - The place id.
 * @param {object} days - `{ today, tomorrow }` (days of the forecast, or null).
 * @param {object} options - `{ language }`.
 * @returns {object[]} The states.
 */
function buildStates(gladys, placeId, days, { language = 'en' } = {}) {
  const ids = idsOf(gladys, placeId);
  return FEATURES.flatMap((spec) => {
    const value = spec.state(days, language);
    if (value === null || value === undefined) {
      return [];
    }
    const id = ids.feature(spec.key);
    return [
      typeof value === 'object'
        ? { device_feature_external_id: id, text: value.text }
        : { device_feature_external_id: id, state: value },
    ];
  });
}

export {
  DEVICE_TYPE,
  FEATURES,
  MAX_COUNT,
  placeIdOf,
  idsOf,
  placeOf,
  mainPollenText,
  buildDevice,
  buildStates,
};
