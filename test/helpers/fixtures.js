// A fake pollen radar for the tests, served through the `fetch` option of the
// integration. The answers are real ones, recorded on 2026-10-17 (the day 17
// is "today"): Mâcon (France), London (United Kingdom), Utrecht
// (Netherlands), Chicago (United States), Milan (Italy), and the empty view
// of an unknown city. Tests never touch the network.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 2026-10-17 10:00 in Paris.
const NOW = Date.parse('2026-10-17T08:00:00Z');
const TODAY = '2026-10-17';
const TOMORROW = '2026-10-18';
const TZ = 'Europe/Paris';

const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A recorded answer.
 * @param {string} name - The file in test/fixtures.
 * @returns {string} Its text.
 */
const fixture = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

const ANSWERS = {
  fr: fixture('kleenex.fr.html'),
  uk: fixture('kleenex.uk.html'),
  nl: fixture('kleenex.nl.html'),
  us: fixture('kleenex.us.html'),
  it: fixture('scottex.it.json'),
  notFound: fixture('kleenex.notfound.html'),
  notFoundIt: '{"retVal":false,"message":"Località non trovata"}',
};

/**
 * @description A temporary path for the file kept in /data.
 * @returns {string} The path (its directory exists, the file does not).
 */
const storePath = () => join(mkdtempSync(join(tmpdir(), 'kleenex-')), 'kleenex-pollen.json');

/**
 * @description Change the first day of a France / UK / Netherlands answer.
 * @param {string} html - The answer.
 * @param {object} changes - `{ trees: ['high', 300] }`: level and count per type.
 * @returns {string} The changed answer.
 */
function withToday(html, changes) {
  let first = true;
  return html.replace(/<button class="day-link[^>]*>/, (tag) => {
    if (!first) {
      return tag;
    }
    first = false;
    let next = tag;
    for (const [type, [level, count]] of Object.entries(changes)) {
      next = next
        .replace(new RegExp(`data-${type}="[^"]*"`), `data-${type}="${level}"`)
        .replace(new RegExp(`data-${type}-count="[^"]*"`), `data-${type}-count="${count} PPM"`);
    }
    return next;
  });
}

/**
 * @description Move the coordinates of an answer (another place).
 * @param {string} html - The answer.
 * @param {string} city - The city name.
 * @param {number} latitude - The latitude.
 * @param {number} longitude - The longitude.
 * @returns {string} The changed answer.
 */
const movedTo = (html, city, latitude, longitude) =>
  html
    .replace(/(id="cityName"[^>]*value=")[^"]*/, `$1${city}`)
    .replace(/(id="pollenlat"[^>]*value=")[^"]*/, `$1${latitude}`)
    .replace(/(id="pollenlng"[^>]*value=")[^"]*/, `$1${longitude}`);

const HOSTS = {
  'www.kleenex.fr': 'fr',
  'www.kleenex.co.uk': 'uk',
  'www.kleenex.nl': 'nl',
  'www.kleenex.com': 'us',
  'www.it.scottex.com': 'it',
};

/**
 * @description The fake pollen radar.
 * @param {object} [options] - `{ answers }`: `region -> query -> text`
 * (lower-case query), the recorded answer of the region otherwise.
 * @returns {Function} A fetch function, with `.calls` and `.state`.
 */
function fakeRadar({ answers = {} } = {}) {
  const state = {
    answers,
    fail: null, // { status } or { throw: 'ECONNREFUSED' } for every request
  };
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    const target = new URL(url);
    const region = HOSTS[target.hostname];
    if (!region) {
      throw new Error(`unexpected host ${target.hostname}`);
    }
    const headers = Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const query =
      region === 'it'
        ? new URLSearchParams(init.body).get('location')
        : target.searchParams.get('city');
    calls.push({ url: String(url), method: init.method ?? 'GET', headers, region, query });
    if (state.fail?.throw) {
      throw new TypeError('fetch failed', { cause: { code: state.fail.throw } });
    }
    if (state.fail?.status) {
      return new Response('<html>denied</html>', { status: state.fail.status });
    }
    const custom = state.answers[region]?.[String(query).toLowerCase()];
    let body = custom ?? ANSWERS[region];
    if (custom === undefined && /^zz/i.test(String(query))) {
      body = region === 'it' ? ANSWERS.notFoundIt : ANSWERS.notFound;
    }
    return new Response(body, {
      status: 200,
      headers: { 'content-type': region === 'it' ? 'application/json' : 'text/html' },
    });
  };
  fetchFn.calls = calls;
  fetchFn.state = state;
  return fetchFn;
}

// What externalIds builds, without a Gladys client.
const fakeGladys = {
  externalIds: (type, id) => {
    const device = `ext:test-integration:${type}:${id}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

// The place of the recorded Mâcon answer.
const MACON = {
  id: 'fr_46.31_4.83',
  region: 'fr',
  city: 'Mâcon',
  latitude: 46.3079587,
  longitude: 4.8293535,
};

export {
  NOW,
  TODAY,
  TOMORROW,
  TZ,
  ANSWERS,
  MACON,
  silent,
  fixture,
  storePath,
  withToday,
  movedTo,
  fakeRadar,
  fakeGladys,
};
