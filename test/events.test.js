// The scene trigger and the scene action outputs: one event per rise, a
// baseline first, flat payloads within the limits of the core.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectEvents,
  actionOutputs,
  daySummary,
  speciesList,
  TRIGGERS,
  ACTION_OUTPUTS,
} from '../src/events.js';
import { parseDayLinks } from '../src/parse.js';
import { ANSWERS, MACON, TODAY, TOMORROW, withToday } from './helpers/fixtures.js';

const PLACE = { ...MACON, deviceId: 'ext:test-integration:place:fr_46.31_4.83' };

/**
 * @description A daysOf over a parsed answer, dated from TODAY.
 * @param {string} html - A France answer.
 * @returns {Function} `(placeId, date) => day`.
 */
function daysFrom(html) {
  const days = parseDayLinks(html).days;
  const dates = [TODAY, TOMORROW, '2026-10-19', '2026-10-20', '2026-10-21'];
  return (placeId, date) => {
    const day = days[dates.indexOf(date)];
    return placeId === PLACE.id && day ? { ...day, date } : null;
  };
}

const run = (html, seen) =>
  detectEvents({ places: [PLACE], daysOf: daysFrom(html), seen, today: TODAY, language: 'fr' });

test('the first reading of a place is a baseline, remembered per date and type', () => {
  const high = withToday(ANSWERS.fr, { weeds: ['high', 120] });
  const { events, seen } = run(high, {});
  assert.deepEqual(events, []);
  assert.deepEqual(seen[PLACE.id][TODAY], { trees: 1, grass: 1, weeds: 3 });
  assert.deepEqual(seen[PLACE.id][TOMORROW], { trees: 1, grass: 1, weeds: 1 });
});

test('a rise to moderate or more fires once per type, then only when it rises again', () => {
  const { seen } = run(ANSWERS.fr, {});
  const moderate = withToday(ANSWERS.fr, { weeds: ['moderate', 30], trees: ['low', 10] });
  const first = run(moderate, seen);
  assert.equal(first.events.length, 1);
  const [event] = first.events;
  assert.equal(event.key, TRIGGERS.POLLEN_ALERT);
  assert.deepEqual(
    { ...event.data, summary: undefined },
    {
      place: PLACE.deviceId,
      place_name: 'Mâcon',
      day: 'today',
      date: TODAY,
      pollen_type: 'weeds',
      type_label: 'Herbacées',
      level: 2,
      label: 'Modéré',
      count: 30,
      species: 'Ambroisie 5 et Chénopodes 1',
      summary: undefined,
    },
  );
  assert.equal(
    event.data.summary,
    'Pollens de herbacées modéré à Mâcon aujourd’hui (30 grains/m³) : Ambroisie 5 et Chénopodes 1.',
  );
  assert.deepEqual(run(moderate, first.seen).events, [], 'the same level: nothing');
  const veryHigh = withToday(ANSWERS.fr, { weeds: ['very-high', 400] });
  const again = run(veryHigh, first.seen);
  assert.deepEqual(
    again.events.map((e) => [e.data.pollen_type, e.data.level]),
    [['weeds', 4]],
  );
  assert.deepEqual(run(moderate, again.seen).events, [], 'a fall is never announced');
});

test('payloads are flat scalars within the limits of the core', () => {
  const { seen } = run(ANSWERS.fr, {});
  const html = withToday(ANSWERS.fr, {
    trees: ['high', 300],
    grass: ['very-high', 400],
    weeds: ['moderate', 30],
  });
  const { events } = run(html, seen);
  assert.equal(events.length, 3);
  for (const { data } of events) {
    assert.ok(Object.keys(data).length <= 30);
    for (const [key, value] of Object.entries(data)) {
      assert.ok(
        value === null ||
          ['number', 'boolean'].includes(typeof value) ||
          (typeof value === 'string' && value.length <= 1000),
        key,
      );
    }
  }
});

test('the memory forgets the days older than three days', () => {
  const seen = { [PLACE.id]: { '2026-10-10': { trees: 4, grass: 4, weeds: 4 } } };
  assert.deepEqual(Object.keys(run(ANSWERS.fr, seen).seen[PLACE.id]), [TODAY, TOMORROW]);
});

test('the action outputs: only the declared keys, a summary, nulls without a day', () => {
  const day = daysFrom(ANSWERS.fr)(PLACE.id, TODAY);
  const outputs = actionOutputs({ place: PLACE, day: 'today', date: TODAY, entry: day }, 'en');
  assert.deepEqual(Object.keys(outputs), ACTION_OUTPUTS);
  assert.equal(outputs.level, 1);
  assert.equal(outputs.label, 'Low');
  assert.equal(outputs.weeds, 6);
  assert.equal(outputs.main_pollen, 'Ragweed');
  assert.equal(outputs.summary, 'Pollen in Mâcon today: low, mostly Ragweed 5 and Goosefoot 1.');
  const none = actionOutputs({ place: PLACE, day: 'tomorrow', date: TOMORROW, entry: null }, 'de');
  assert.equal(none.level, null);
  assert.equal(none.trees, null);
  assert.equal(none.summary, 'Keine Pollenprognose für Mâcon morgen.');
});

test('summaries fall back to the type when the radar gives no species', () => {
  const day = {
    trees: { count: 0, level: 1, species: [] },
    grass: { count: 0, level: 1, species: [] },
    weeds: { count: 53, level: 2, species: [] },
  };
  assert.equal(speciesList(day, 'en'), '');
  assert.equal(
    daySummary({ place: { city: 'Chicago' }, day: 'today', entry: day }, 'es'),
    'Polen en Chicago hoy: moderado, sobre todo herbáceas.',
  );
});
