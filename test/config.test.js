import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, readLanguage, AUTO_LANGUAGE, MAX_PLACES } from '../src/config.js';

test('France and automatic language by default, no city', () => {
  assert.deepEqual(normalizeConfig(), { region: 'fr', places: [], language: AUTO_LANGUAGE });
  assert.deepEqual(normalizeConfig(null), normalizeConfig({}));
});

test('cities trimmed, empty slots and repeats left out, the slot kept', () => {
  const config = normalizeConfig({
    region: 'uk',
    city_1: '  Leeds  ',
    city_2: 'leeds',
    city_3: 'Saint  Albans',
    city_4: 'York',
    language: 'de',
  });
  assert.equal(config.region, 'uk');
  assert.deepEqual(config.places, [
    { slot: 1, query: 'Leeds' },
    { slot: 3, query: 'Saint Albans' },
  ]);
  assert.equal(config.language, 'de');
  assert.equal(MAX_PLACES, 3);
});

test('an unknown region or language falls back, a long city is cut', () => {
  const config = normalizeConfig({ region: 'de', language: 'it', city_1: 'x'.repeat(300) });
  assert.equal(config.region, 'fr');
  assert.equal(config.language, AUTO_LANGUAGE);
  assert.equal(config.places[0].query.length, 100);
  assert.equal(normalizeConfig({ city_1: 42 }).places.length, 0);
});

test('the stored language of the last widget request', () => {
  assert.equal(readLanguage({ last_language: 'es' }, 'en'), 'es');
  assert.equal(readLanguage({ last_language: 'español' }, 'en'), 'en');
  assert.equal(readLanguage(null, 'fr'), 'fr');
});
