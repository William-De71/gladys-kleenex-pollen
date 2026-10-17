// -----------------------------------------------------------------------------
// Configuration of the Kleenex Pollen Radar integration.
//
// Fields of the config_schema:
//   - `region`     the pollen radar of a country: fr, uk (United Kingdom and
//                  Ireland), nl, it or us. France by default;
//   - `city_<n>`   up to three cities, by name or postal code, as the pollen
//                  radar site understands them ("Mâcon", "71000", "Leeds");
//   - `language`   language of the texts Gladys does not ask for in a
//                  language (feature names, scene summaries): `auto` follows
//                  the language of the last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`  language of the last widget request, kept for the
//                      texts after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';
import { isRegion } from './kleenex.js';

const MAX_PLACES = 3;
const DEFAULT_REGION = 'fr';
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };
// The first language of the texts, per region, until a widget is shown.
const REGION_LANGUAGE = { fr: 'fr', uk: 'en', nl: 'en', it: 'en', us: 'en' };

const readString = (raw) => (typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '');

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ region, places: [{ slot, query }], language }`; an
 * empty slot is left out, a city typed twice is kept once.
 * @example
 * normalizeConfig({ region: 'uk', city_1: 'Leeds' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const places = [];
  for (let slot = 1; slot <= MAX_PLACES; slot += 1) {
    const query = readString(config[`city_${slot}`]).slice(0, 100);
    if (query && !places.some((place) => place.query.toLowerCase() === query.toLowerCase())) {
      places.push({ slot, query });
    }
  }
  return {
    region: isRegion(config.region) ? config.region : DEFAULT_REGION,
    places,
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  MAX_PLACES,
  DEFAULT_REGION,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  REGION_LANGUAGE,
  normalizeConfig,
  readLanguage,
};
