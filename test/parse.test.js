// The readers against real answers of the five pollen radars (2026-10-17).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseDayLinks,
  parseNorthAmerica,
  parseItaly,
  decodeEntities,
  readLevel,
  levelOfCount,
  overallLevel,
  mainType,
  topSpecies,
} from '../src/parse.js';
import { ANSWERS } from './helpers/fixtures.js';

const counts = (day) => [day.trees.count, day.grass.count, day.weeds.count];
const levels = (day) => [day.trees.level, day.grass.level, day.weeds.level];

test('France: five days from the 17th, location, counts, levels and species', () => {
  const forecast = parseDayLinks(ANSWERS.fr);
  assert.equal(forecast.city, 'Mâcon');
  assert.equal(forecast.latitude, 46.3079587);
  assert.equal(forecast.longitude, 4.8293535);
  assert.deepEqual(
    forecast.days.map((day) => day.day),
    [17, 18, 19, 20, 21],
  );
  const [today, tomorrow] = forecast.days;
  assert.deepEqual(counts(today), [0, 0, 6]);
  assert.deepEqual(levels(today), [1, 1, 1]);
  assert.deepEqual(counts(tomorrow), [0, 0, 15]);
  assert.equal(today.trees.species.length, 9);
  assert.equal(today.trees.species[5].name, 'Chêne', 'entities decoded');
  assert.deepEqual(today.weeds.species[2], { name: 'Ambroisie', count: 5, level: 1 });
  assert.equal(today.grass.species[0].name, 'Poaceae', 'trailing space trimmed');
});

test('United Kingdom and Netherlands: the same shape, names in their language', () => {
  const uk = parseDayLinks(ANSWERS.uk);
  assert.equal(uk.city, 'London');
  assert.equal(uk.longitude, -0.12719);
  assert.equal(uk.days.length, 5);
  assert.equal(uk.days[0].weeds.species[2].name, 'Ragweed');
  const nl = parseDayLinks(ANSWERS.nl);
  assert.equal(nl.city, 'Utrecht');
  assert.equal(nl.days[0].trees.species[0].name, 'Hazelaar');
});

test('United States: levels from the hidden inputs, counts, no species', () => {
  const forecast = parseNorthAmerica(ANSWERS.us);
  assert.equal(forecast.city, 'Chicago');
  assert.equal(forecast.longitude, -87.6323879);
  assert.equal(forecast.days.length, 5);
  assert.deepEqual(
    forecast.days.map((day) => day.day),
    [17, 18, 19, 20, 21],
  );
  assert.deepEqual(counts(forecast.days[0]), [0, 0, 53]);
  assert.deepEqual(levels(forecast.days[0]), [1, 1, 2]);
  assert.deepEqual(levels(forecast.days[1]), [1, 1, 3]);
  assert.deepEqual(forecast.days[0].weeds.species, []);
});

test('Italy: city and coordinates from the JSON, cards and species panels, no duplicate', () => {
  const forecast = parseItaly(ANSWERS.it);
  assert.equal(forecast.city, 'Milan');
  assert.equal(forecast.latitude, 45.468503);
  assert.equal(forecast.days.length, 5);
  assert.deepEqual(counts(forecast.days[0]), [4, 0, 26]);
  assert.deepEqual(forecast.days[0].trees.species[0], { name: 'Cypress', count: 4, level: 1 });
  const names = forecast.days[0].trees.species.map((species) => species.name);
  assert.equal(new Set(names).size, names.length, 'Hazel is listed twice by the page');
  assert.equal(parseItaly(JSON.parse(ANSWERS.it)).city, 'Milan', 'an object works too');
});

test('an unknown city or a broken answer gives null', () => {
  assert.equal(parseDayLinks(ANSWERS.notFound), null);
  assert.equal(parseNorthAmerica(ANSWERS.notFound), null);
  assert.equal(parseItaly(ANSWERS.notFoundIt), null);
  assert.equal(parseItaly('not json'), null);
  assert.equal(parseItaly({ html: '<p></p>' }), null);
  assert.equal(parseDayLinks(''), null);
});

test('levels: words of every site, or deduced from the count with the HA thresholds', () => {
  assert.equal(readLevel('low'), 1);
  assert.equal(readLevel('Moderate'), 2);
  assert.equal(readLevel(' High '), 3);
  assert.equal(readLevel('Very High'), 4);
  assert.equal(readLevel('very-high'), 4);
  assert.equal(readLevel('extreme'), null);
  assert.equal(levelOfCount('trees', 94), 1);
  assert.equal(levelOfCount('trees', 95), 2);
  assert.equal(levelOfCount('grass', 341), 4);
  assert.equal(levelOfCount('weeds', 77), 3);
  assert.equal(levelOfCount('weeds', null), null);
  const html = ANSWERS.fr.replace('data-weeds="low"', 'data-weeds=""');
  assert.equal(parseDayLinks(html).days[0].weeds.level, 1, '6 weeds: low from the count');
});

test('entities, overall level, main type and top species', () => {
  assert.equal(
    decodeEntities('Ch&#234;ne &amp; Cypr&#xE8;s &unknown;'),
    'Chêne & Cyprès &unknown;',
  );
  const [today] = parseDayLinks(ANSWERS.fr).days;
  assert.equal(overallLevel(today), 1);
  assert.equal(overallLevel(null), null);
  assert.equal(mainType(today), 'weeds');
  assert.equal(mainType({ trees: { count: 0, level: 1 } }), null);
  assert.equal(
    mainType({
      trees: { count: 50, level: 2 },
      grass: { count: 80, level: 2 },
      weeds: { count: 300, level: 1 },
    }),
    'grass',
    'the level first, then the count',
  );
  assert.deepEqual(
    topSpecies(today).map((species) => [species.type, species.name, species.count]),
    [
      ['weeds', 'Ambroisie', 5],
      ['weeds', 'Chénopodes', 1],
    ],
  );
});
