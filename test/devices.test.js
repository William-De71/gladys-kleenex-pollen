// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

import {
  buildDevice,
  buildStates,
  placeOf,
  placeIdOf,
  idsOf,
  mainPollenText,
  MAX_COUNT,
} from '../src/device.js';
import { parseDayLinks, parseNorthAmerica } from '../src/parse.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, ANSWERS, MACON } from './helpers/fixtures.js';

const CHICAGO = {
  id: 'us_41.88_-87.63',
  region: 'us',
  city: 'Chicago',
  latitude: 41.88325,
  longitude: -87.6323879,
};

const devices = (language) => [
  buildDevice(fakeGladys, MACON, { language }),
  buildDevice(fakeGladys, CHICAGO, { language }),
];
const macon = parseDayLinks(ANSWERS.fr).days;

// DEVICE_FEATURE_UNITS_BY_CATEGORY of the Gladys core (server/utils/constants.js, v5.2.1).
const UNITS = { 'airquality-sensor': [DEVICE_FEATURE_UNITS.AQI] };
// Pairs with an icon in the Gladys front (front/src/utils/consts.js).
const PAIRS = [
  [DEVICE_FEATURE_CATEGORIES.AIRQUALITY_SENSOR, DEVICE_FEATURE_TYPES.AIRQUALITY_SENSOR.AQI],
  [DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT],
];

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max']) {
          assert.equal(typeof feature[key], 'number', `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min <= feature.max, feature.external_id);
        assert.equal(feature.read_only, true, feature.external_id);
        assert.equal(feature.has_feedback, false, feature.external_id);
        assert.ok(feature.name.length > 0 && feature.name.length <= 255);
      }
      const names = new Set(device.features.map((feature) => feature.name));
      assert.equal(names.size, device.features.length, `${language}: every name is distinct`);
    }
  }
});

test('category / type pairs known to the Gladys front; no unit that would lie', () => {
  for (const feature of devices('en').flatMap((device) => device.features)) {
    assert.ok(
      PAIRS.some(([category, type]) => feature.category === category && feature.type === type),
      `${feature.external_id}: ${feature.category}/${feature.type}`,
    );
    // Levels 1-4 and grains per m³ are not an AQI: no unit at all.
    assert.equal(feature.unit, undefined, feature.external_id);
    assert.ok(!UNITS[feature.category] || feature.unit === undefined);
  }
});

test('ids from the region and the coordinates of the pollen radar, read back', () => {
  const [device, chicago] = devices('fr');
  assert.equal(device.external_id, 'ext:test-integration:place:fr_46.31_4.83');
  assert.equal(chicago.external_id, 'ext:test-integration:place:us_41.88_-87.63');
  assert.equal(placeIdOf('us', 41.88325, -87.6323879), 'us_41.88_-87.63');
  assert.equal(placeOf('ext:test-integration:place:us_41.88_-87.63:weeds_level'), CHICAGO.id);
  assert.equal(placeOf('ext:test-integration:place:fr_46.31_4.83'), MACON.id);
  assert.equal(placeOf('something else'), null);
  assert.equal(placeOf(null), null);
  assert.equal(device.name, 'Pollens Mâcon');
  assert.deepEqual(
    device.features.map((feature) => feature.external_id.split(':').pop()),
    [
      'level',
      'level_tomorrow',
      'trees',
      'grass',
      'weeds',
      'trees_level',
      'grass_level',
      'weeds_level',
      'main_pollen',
    ],
  );
});

test('states: levels and counts of today, level of tomorrow, the main species', () => {
  const states = buildStates(
    fakeGladys,
    MACON.id,
    { today: macon[0], tomorrow: macon[1] },
    { language: 'fr' },
  );
  const byKey = Object.fromEntries(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
  );
  assert.deepEqual(byKey, {
    level: 1,
    level_tomorrow: 1,
    trees: 0,
    grass: 0,
    weeds: 6,
    trees_level: 1,
    grass_level: 1,
    weeds_level: 1,
    main_pollen: 'Ambroisie 5',
  });
  assert.deepEqual(buildStates(fakeGladys, MACON.id, { today: null, tomorrow: null }), []);
});

test('the main pollen falls back to the type, then to a dash; counts are capped', () => {
  const [chicago] = parseNorthAmerica(ANSWERS.us).days;
  assert.equal(mainPollenText(chicago, 'en'), 'Weeds 53');
  const empty = { trees: { count: 0, level: 1, species: [] } };
  assert.equal(mainPollenText(empty, 'en'), '-');
  assert.equal(mainPollenText(null, 'en'), null);
  const huge = { trees: { count: 25000, level: 4, species: [] } };
  const [count] = buildStates(fakeGladys, MACON.id, { today: huge, tomorrow: null }).filter((s) =>
    s.device_feature_external_id.endsWith(':trees'),
  );
  assert.equal(count.state, MAX_COUNT);
});

test('the discovery batch and the states pass the checks of the fake host API', async (t) => {
  const gladys = createFakeGladys({});
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  for (const language of LANGUAGES) {
    await gladys.publishDiscoveredDevices(devices(language));
  }
  const device = gladys.fake.discoveredDevices[0];
  await gladys.fake.deviceCreated(device);
  await gladys.publishStates(
    buildStates(gladys, MACON.id, { today: macon[0], tomorrow: macon[1] }),
  );
  assert.equal(idsOf(gladys, MACON.id).device, device.external_id);
});
