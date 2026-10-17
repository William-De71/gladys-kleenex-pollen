// The widget contents, checked by the validator of the SDK (what the core
// would remove), in every language.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildForecastWidget,
  buildSpeciesWidget,
  messageContent,
  levelColor,
  dayName,
  readWidgetSettings,
} from '../src/widgets.js';
import { parseDayLinks, parseNorthAmerica } from '../src/parse.js';
import { datesOf } from '../src/time.js';
import { LANGUAGES } from '../src/i18n.js';
import { ANSWERS, MACON, NOW, TODAY, TZ } from './helpers/fixtures.js';

/**
 * @description The dated days of an answer.
 * @param {object} forecast - A parsed forecast.
 * @returns {object[]} The days, with their date.
 */
function dated(forecast) {
  const dates = datesOf(
    forecast.days.map((day) => day.day),
    TODAY,
  );
  return forecast.days.map((day, index) => ({ ...day, date: dates[index] }));
}

const maconDays = dated(parseDayLinks(ANSWERS.fr));
const chicagoDays = dated(parseNorthAmerica(ANSWERS.us));
const CHICAGO = { ...MACON, city: 'Chicago', region: 'us' };

/**
 * @description Assert the validator of the core finds nothing to remove.
 * @param {object} content - A widget content.
 * @param {string} label - What it is.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
}

test('forecast: three tiles, five day cards, the status list, valid in every language', () => {
  for (const language of LANGUAGES) {
    const content = buildForecastWidget({
      place: MACON,
      days: maconDays,
      fetchedAt: NOW,
      language,
      timeZone: TZ,
    });
    assertValid(content, `forecast ${language}`);
    const types = content.components.map((component) => component.type);
    assert.deepEqual(types, ['text', 'value', 'value', 'value', 'card-list', 'status']);
    assert.equal(content.components[4].items.length, 5);
  }
  const fr = buildForecastWidget({
    place: MACON,
    days: maconDays,
    fetchedAt: NOW,
    language: 'fr',
    timeZone: TZ,
  });
  assert.deepEqual(fr.components[3], {
    type: 'value',
    label: 'Herbacées',
    value: 6,
    unit: '/m³',
    color: 'success',
  });
  const [today, tomorrow, third] = fr.components[4].items;
  assert.equal(today.title, 'Aujourd’hui');
  assert.deepEqual(today.badge, { text: 'Faible', color: 'success' });
  assert.equal(tomorrow.title, 'Demain');
  assert.equal(third.title, 'Lundi');
  assert.equal(today.date, '2026-10-17T00:00:00.000Z');
  assert.match(today.description, /Arbres 0 · Graminées 0 · Herbacées 6 \(grains\/m³\)/);
  assert.match(today.description, /Espèces principales : Ambroisie 5 et Chénopodes 1/);
  assert.deepEqual(fr.components[5].items[0], {
    label: 'Pollen principal',
    value: 'Ambroisie 5',
    color: 'success',
  });
  assert.equal(fr.components[5].items[1].value, 'Kleenex · France');
  assert.equal(fr.components[5].items[2].value, '17/10 10:00');
});

test('forecast without days and without species stays valid', () => {
  const content = buildForecastWidget({
    place: CHICAGO,
    days: [],
    fetchedAt: null,
    language: 'en',
  });
  assertValid(content, 'empty forecast');
  assert.equal(content.components[1].value, '-');
  const chicago = buildForecastWidget({
    place: CHICAGO,
    days: chicagoDays,
    fetchedAt: NOW,
    language: 'en',
    timeZone: TZ,
  });
  assertValid(chicago, 'chicago');
  assert.match(chicago.components[4].items[0].description, /No pollen counted|Main species/);
});

test('species: highest first, translated, with their level; a text when none', () => {
  for (const language of LANGUAGES) {
    const content = buildSpeciesWidget({
      place: MACON,
      today: maconDays[0],
      fetchedAt: NOW,
      language,
      timeZone: TZ,
    });
    assertValid(content, `species ${language}`);
  }
  const de = buildSpeciesWidget({
    place: MACON,
    today: maconDays[0],
    fetchedAt: NOW,
    language: 'de',
    timeZone: TZ,
  });
  const items = de.components[1].items;
  assert.equal(items.length, 8, 'capped at the 8 items of a list');
  assert.deepEqual(items[0], {
    title: 'Ambrosia',
    subtitle: 'Kräuter · 5 Körner/m³',
    badge: { text: 'Niedrig', color: 'success' },
  });
  const none = buildSpeciesWidget({
    place: CHICAGO,
    today: chicagoDays[0],
    fetchedAt: NOW,
    language: 'en',
  });
  assertValid(none, 'no species');
  assert.equal(none.components[1].type, 'text');
});

test('helpers: messages, colors, day names, settings', () => {
  assertValid(messageContent('x'.repeat(500)), 'message');
  assert.equal(messageContent('x'.repeat(500)).components[0].text.length, 300);
  assert.deepEqual([null, 0, 1, 2, 3, 4].map(levelColor), [
    'neutral',
    'neutral',
    'success',
    'warning',
    'danger',
    'danger',
  ]);
  assert.equal(dayName(3, '2026-10-20', 'es'), 'Martes');
  assert.deepEqual(readWidgetSettings({ place: 'ext:x' }), { place: 'ext:x' });
  assert.deepEqual(readWidgetSettings({ place: '' }), { place: null });
  assert.deepEqual(readWidgetSettings(undefined), { place: null });
});
