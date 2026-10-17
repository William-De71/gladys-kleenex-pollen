// The client of the pollen radar: the request of each region, the errors, the pace.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPollenClient, isRegion, PAUSE_MS, USER_AGENT } from '../src/kleenex.js';
import { fakeRadar } from './helpers/fixtures.js';

/**
 * @description A client on the fake radar, with a manual clock.
 * @param {object} [radar] - The fake radar.
 * @returns {object} `{ client, radar, clock, pauses }`.
 */
function setup(radar = fakeRadar()) {
  const clock = { now: 0 };
  const pauses = [];
  const client = createPollenClient({
    fetch: radar,
    now: () => clock.now,
    sleep: async (ms) => {
      pauses.push(ms);
      clock.now += ms;
    },
  });
  return { client, radar, clock, pauses };
}

test('a GET with the city for France, the UK, the Netherlands and the US', async () => {
  const { client, radar } = setup();
  await client.forecast('fr', 'Mâcon');
  await client.forecast('uk', 'Leeds');
  await client.forecast('nl', 'Utrecht');
  await client.forecast('us', 'Chicago');
  assert.deepEqual(
    radar.calls.map((call) => [call.method, new URL(call.url).hostname, call.query]),
    [
      ['GET', 'www.kleenex.fr', 'Mâcon'],
      ['GET', 'www.kleenex.co.uk', 'Leeds'],
      ['GET', 'www.kleenex.nl', 'Utrecht'],
      ['GET', 'www.kleenex.com', 'Chicago'],
    ],
  );
  assert.match(radar.calls[0].url, /GetPollenContentCity\?city=M%C3%A2con$/);
  assert.match(radar.calls[3].url, /GetPollenContentNACity/);
  assert.equal(radar.calls[0].headers['user-agent'], USER_AGENT);
  assert.equal(client.requests.total, 4);
});

test('a form POST with the location for Italy', async () => {
  const { client, radar } = setup();
  const forecast = await client.forecast('it', 'Milano');
  assert.equal(forecast.city, 'Milan');
  assert.equal(radar.calls[0].method, 'POST');
  assert.equal(radar.calls[0].query, 'Milano');
  assert.match(radar.calls[0].headers['content-type'], /application\/x-www-form-urlencoded/);
});

test('two seconds between two requests, one request at a time', async () => {
  const { client, radar, pauses } = setup();
  await Promise.all([client.forecast('fr', 'Mâcon'), client.forecast('fr', 'Lyon')]);
  assert.equal(radar.calls.length, 2);
  assert.deepEqual(pauses, [PAUSE_MS]);
});

test('an unknown city is not_found, a page without days is invalid', async () => {
  const { client, radar } = setup();
  await assert.rejects(client.forecast('fr', 'zzqxwv'), { kind: 'not_found' });
  await assert.rejects(client.forecast('it', 'zzqxwv'), { kind: 'not_found' });
  radar.state.answers = { fr: { lyon: '<html><body>Maintenance</body></html>' } };
  await assert.rejects(client.forecast('fr', 'Lyon'), { kind: 'invalid' });
});

test('403 and 429 are blocked, other errors and network failures unreachable', async () => {
  const { client, radar } = setup();
  radar.state.fail = { status: 403 };
  await assert.rejects(client.forecast('fr', 'Mâcon'), { kind: 'blocked', status: 403 });
  radar.state.fail = { status: 429 };
  await assert.rejects(client.forecast('fr', 'Mâcon'), { kind: 'blocked', status: 429 });
  radar.state.fail = { status: 503 };
  await assert.rejects(client.forecast('fr', 'Mâcon'), { kind: 'unreachable', status: 503 });
  radar.state.fail = { throw: 'ECONNREFUSED' };
  await assert.rejects(client.forecast('fr', 'Mâcon'), {
    kind: 'unreachable',
    message: 'ECONNREFUSED',
  });
  radar.state.fail = null;
  assert.equal((await client.forecast('fr', 'Mâcon')).city, 'Mâcon', 'a failure does not block');
});

test('an unknown region is refused without a request', async () => {
  const { client, radar } = setup();
  await assert.rejects(client.forecast('de', 'Berlin'), { kind: 'invalid' });
  assert.equal(radar.calls.length, 0);
  assert.equal(isRegion('uk'), true);
  assert.equal(isRegion('toString'), false);
});
