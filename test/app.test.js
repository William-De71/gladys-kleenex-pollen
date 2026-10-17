// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a
// fake pollen radar serving recorded answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  createApp,
  SCENE_ACTIONS,
  ACTIONS,
  RETRY_DELAYS_MIN,
  REFRESH_MIN_INTERVAL_MS,
} from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import { READ_INTERVAL_MS, MINUTE_MS } from '../src/time.js';
import {
  fakeRadar,
  storePath,
  silent,
  withToday,
  movedTo,
  ANSWERS,
  NOW,
  TZ,
  TODAY,
  TOMORROW,
} from './helpers/fixtures.js';

const CONFIG = { region: 'fr', city_1: 'Mâcon', city_2: 'Lyon' };
const PREFIX = 'ext:test-integration:place';
const MACON = `${PREFIX}:fr_46.31_4.83`;
const LYON = `${PREFIX}:fr_45.76_4.83`;
const HOUR = 3600 * 1000;

/**
 * @description A fake radar where Lyon is its own place.
 * @returns {Function} The fake radar.
 */
const radarWithLyon = () =>
  fakeRadar({ answers: { fr: { lyon: movedTo(ANSWERS.fr, 'Lyon', 45.7578137, 4.8320114) } } });

/**
 * @description The integration, connected to a fake Gladys and a fake radar.
 * @param {object} [options] - `{ config, radar, path, now }`.
 * @returns {Promise<object>} `{ gladys, app, radar, clock, path }`.
 */
async function startApp({
  config = CONFIG,
  radar = radarWithLyon(),
  path = storePath(),
  now = NOW,
} = {}) {
  const clock = { now };
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, {
    fetch: radar,
    sleep: async () => {},
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: silent,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, radar, clock, path };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  assert.ok(device, `${externalId} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);

test('two typed cities become two devices, one request each, no event at first', async (t) => {
  const { gladys, app, radar } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [MACON, 'Pollens Mâcon'],
      [LYON, 'Pollens Lyon'],
    ],
  );
  assert.equal(radar.calls.length, 2);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(
    gladys.fake.connectionStatus.message.fr,
    /^Radar des pollens lu : Mâcon faible, Lyon faible\. Prochaine lecture vers 1[34]:\d\d\.$/,
  );
  assert.deepEqual(gladys.fake.sceneEvents, [], 'the first reading is a baseline');
  assert.deepEqual(
    app.store.data.forecasts['fr_46.31_4.83'].days.map((day) => day.date),
    [TODAY, TOMORROW, '2026-10-19', '2026-10-20', '2026-10-21'],
  );
});

test('states of a created device, sent again when it is created', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.states.length, 0, 'nothing before a device exists');
  await created(gladys, MACON);
  assert.equal(gladys.fake.lastState(`${MACON}:level`), 1);
  assert.equal(gladys.fake.lastState(`${MACON}:weeds`), 6);
  assert.equal(gladys.fake.lastState(`${MACON}:main_pollen`), 'Ambroisie 5');
  assert.equal(gladys.fake.lastState(`${LYON}:level`), undefined);
});

test('two spellings found at the same place by the radar are one device', async (t) => {
  const { gladys, app } = await startApp({
    config: { city_1: 'Mâcon', city_2: '71000' },
    radar: fakeRadar(),
  });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.discoveredDevices.length, 1);
  assert.deepEqual(app.getPlaces()[0].slots, [1, 2]);
});

test('a restart before the next reading costs no request', async (t) => {
  const path = storePath();
  const first = await startApp({ path });
  await first.gladys.fake.shutdown();
  const radar = radarWithLyon();
  const { gladys } = await startApp({ path, radar, now: NOW + HOUR });
  t.after(() => gladys.fake.shutdown());
  assert.equal(radar.calls.length, 0);
  assert.equal(gladys.fake.discoveredDevices.length, 2, 'the places are kept too');
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('the timer reads again after the interval and fires a rise once', async (t) => {
  const { gladys, app, radar, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, MACON);
  radar.state.answers.fr['mâcon'] = withToday(ANSWERS.fr, { weeds: ['high', 120] });
  clock.now = NOW + HOUR;
  await app.tick();
  assert.equal(radar.calls.length, 2, 'not yet');
  clock.now = NOW + READ_INTERVAL_MS + 31 * MINUTE_MS;
  await app.tick();
  assert.equal(radar.calls.length, 4);
  const events = eventsOf(gladys, TRIGGERS.POLLEN_ALERT);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.place, MACON);
  assert.equal(events[0].data.pollen_type, 'weeds');
  assert.equal(events[0].data.level, 3);
  assert.equal(gladys.fake.lastState(`${MACON}:weeds_level`), 3);
  assert.equal(gladys.fake.lastState(`${MACON}:level`), 3);
  clock.now += READ_INTERVAL_MS + 31 * MINUTE_MS;
  await app.tick();
  assert.equal(eventsOf(gladys, TRIGGERS.POLLEN_ALERT).length, 1, 'the same level: no event');
});

test('an unknown city is reported, the others still read', async (t) => {
  const { gladys, app } = await startApp({ config: { city_1: 'Mâcon', city_2: 'zzqxwv' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.discoveredDevices.length, 1);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /City 2 \(zzqxwv\): unknown to the pollen radar of France\./,
  );
  assert.equal(app.getRetryAt(), null, 'an unknown city is not retried');
});

test('only unknown cities: disconnected, with the reason', async (t) => {
  const { gladys } = await startApp({ config: { city_1: 'zzqxwv' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /Ville 1 \(zzqxwv\) : inconnue/);
});

test('no city: disconnected, asking for one', async (t) => {
  const { gladys, radar } = await startApp({ config: {} });
  t.after(() => gladys.fake.shutdown());
  assert.equal(radar.calls.length, 0);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.equal(
    gladys.fake.connectionStatus.message.en,
    'Type at least one city in the Configuration tab.',
  );
});

test('a refused or unreachable radar is retried later, keeping the known places', async (t) => {
  const path = storePath();
  const first = await startApp({ path });
  await first.gladys.fake.shutdown();
  const radar = radarWithLyon();
  radar.state.fail = { status: 403 };
  const later = NOW + READ_INTERVAL_MS + HOUR;
  const { gladys, app, clock } = await startApp({ path, radar, now: later });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /refused the request \(HTTP 403\)/);
  assert.equal(app.getRetryAt(), later + RETRY_DELAYS_MIN[0] * MINUTE_MS);
  assert.equal(app.getPlaces().length, 2, 'the devices stay offered');
  radar.state.fail = null;
  clock.now = app.getRetryAt();
  await app.tick();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(app.getRetryAt(), null);
});

test('a page that cannot be read says the site may have changed', async (t) => {
  const radar = fakeRadar({ answers: { fr: { mâcon: '<html>new site</html>' } } });
  const { gladys } = await startApp({ config: { city_1: 'Mâcon' }, radar });
  t.after(() => gladys.fake.shutdown());
  assert.match(gladys.fake.connectionStatus.message.fr, /le site a peut-être changé/);
});

test('widgets: forecast and species of the chosen city, valid, in the request language', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const {
    data: { content: forecast },
  } = await gladys.fake.widgetGet(WIDGETS.FORECAST, {
    settings: { place: LYON },
    language: 'de',
  });
  assert.deepEqual(validateWidgetContent(forecast), []);
  assert.equal(forecast.components[0].text, 'Lyon');
  assert.equal(forecast.components[4].items[0].title, 'Heute');
  const {
    data: { content: species },
  } = await gladys.fake.widgetGet(WIDGETS.SPECIES, { language: 'en' });
  assert.deepEqual(validateWidgetContent(species), []);
  assert.equal(species.components[0].text, 'Mâcon', 'empty setting: the first city');
  assert.equal(species.components[1].items[0].title, 'Ragweed');
});

test('widgets without a city or before a reading show a message', async (t) => {
  const { gladys } = await startApp({ config: {} });
  t.after(() => gladys.fake.shutdown());
  const {
    data: { content },
  } = await gladys.fake.widgetGet(WIDGETS.FORECAST, { language: 'fr' });
  assert.match(content.components[0].text, /Aucune ville pour l’instant/);
});

test('the scene action reads a city, today or tomorrow; an unknown city fails', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const {
    data: { outputs: today },
  } = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_POLLEN, { place: LYON });
  assert.equal(today.place_name, 'Lyon');
  assert.equal(today.date, TODAY);
  assert.equal(today.weeds, 6);
  assert.equal(today.label, 'Faible', 'French until a widget is shown, the region language');
  const {
    data: { outputs: tomorrow },
  } = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_POLLEN, { day: 'tomorrow' });
  assert.equal(tomorrow.place_name, 'Mâcon');
  assert.equal(tomorrow.weeds, 15);
  const unknown = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_POLLEN, {
    place: `${PREFIX}:fr_1.00_2.00`,
  });
  assert.equal(unknown.success, false);
  assert.match(unknown.error, /Unknown city/);
});

test('read now: too soon after a reading, then a new reading with its summary', async (t) => {
  const { gladys, radar, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const soon = await gladys.fake.action(ACTIONS.REFRESH);
  assert.match(soon.data.message.en, /Already read 0 min ago|Already read 1 min ago/);
  assert.equal(radar.calls.length, 2);
  clock.now = NOW + REFRESH_MIN_INTERVAL_MS + MINUTE_MS;
  const done = await gladys.fake.action(ACTIONS.REFRESH);
  assert.equal(done.data.message.fr, 'Lu : Mâcon faible, Lyon faible.');
  assert.equal(radar.calls.length, 4);
});

test('the diagnostic writes the state to the logs, in chunks', async (t) => {
  const lines = [];
  const clock = { now: NOW };
  const gladys = createFakeGladys({ config: CONFIG });
  const app = createApp(gladys, {
    fetch: radarWithLyon(),
    sleep: async () => {},
    storePath: storePath(),
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: { ...silent, info: (line) => lines.push(line) },
  });
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  await app.whenReady();
  const answer = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(answer.data.message.en, /Diagnostic written to the Logs tab \(\d+ line\(s\)\)\./);
  const report = JSON.parse(
    lines
      .filter((line) => line.startsWith('Pollen diagnostic'))
      .map((line) => line.replace(/^Pollen diagnostic \d+\/\d+: /, ''))
      .join(''),
  );
  assert.equal(report.region, 'fr');
  assert.equal(report.places.length, 2);
  assert.equal(report.requests, 2);
});

test('a new city in the configuration reads at once; a language change only renames', async (t) => {
  const { gladys, radar } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await gladys.fake.configUpdated({ ...CONFIG, language: 'en' });
  assert.equal(radar.calls.length, 2, 'no new reading');
  assert.equal(gladys.fake.discoveredDevices[0].name, 'Pollen Mâcon');
  await gladys.fake.configUpdated({ ...CONFIG, city_3: 'Paris', language: 'en' });
  assert.equal(radar.calls.length, 5, 'the three cities read again');
});

test('the version logged and reported comes from package.json', () => {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.match(version, /^0\.\d+\.\d+$/);
});
