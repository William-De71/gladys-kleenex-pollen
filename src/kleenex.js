// -----------------------------------------------------------------------------
// Client of the Kleenex / Scottex pollen radar.
//
// No documented API: the pollen radar pages of each country ask their own
// server for an HTML fragment, by city name or postal code (coordinates are
// not understood). The endpoints below are the ones those pages call, and the
// ones the Home Assistant integration (MarcoGos/kleenex_pollenradar) uses:
//
//   fr  GET  https://www.kleenex.fr/api/sitecore/Pollen/GetPollenContentCity?city=
//   uk  GET  https://www.kleenex.co.uk/api/sitecore/Pollen/GetPollenContentCity?city=
//            (Ireland too, with the country: "Dublin, Ireland";
//            "Dublin" alone is a British street)
//   nl  GET  https://www.kleenex.nl/api/sitecore/Pollen/GetPollenContentCity?city=
//   us  GET  https://www.kleenex.com/api/sitecore/Pollen/GetPollenContentNACity?city=
//   it  POST https://www.it.scottex.com/api/sitecore/Pollen/GetPollenData  location=
//
// An unknown city is a 200 with an empty view ("EmptyView", or
// `{ retVal: false }` in Italy): `not_found`, never retried. One request per
// place and reading, one at a time, two seconds apart: the servers are a
// brand's website, not an API made for this.
// -----------------------------------------------------------------------------

import { parseDayLinks, parseNorthAmerica, parseItaly } from './parse.js';

const REGIONS = {
  fr: {
    url: 'https://www.kleenex.fr/api/sitecore/Pollen/GetPollenContentCity',
    method: 'GET',
    param: 'city',
    parse: parseDayLinks,
  },
  uk: {
    url: 'https://www.kleenex.co.uk/api/sitecore/Pollen/GetPollenContentCity',
    method: 'GET',
    param: 'city',
    parse: parseDayLinks,
  },
  nl: {
    url: 'https://www.kleenex.nl/api/sitecore/Pollen/GetPollenContentCity',
    method: 'GET',
    param: 'city',
    parse: parseDayLinks,
  },
  us: {
    url: 'https://www.kleenex.com/api/sitecore/Pollen/GetPollenContentNACity',
    method: 'GET',
    param: 'city',
    parse: parseNorthAmerica,
  },
  it: {
    url: 'https://www.it.scottex.com/api/sitecore/Pollen/GetPollenData',
    method: 'POST',
    param: 'location',
    parse: parseItaly,
  },
};
const TIMEOUT_MS = 20000;
const PAUSE_MS = 2000;
const USER_AGENT = 'gladys-kleenex-pollen (+https://github.com/William-De71/gladys-kleenex-pollen)';

class PollenError extends Error {
  /**
   * @param {string} kind - `not_found`, `blocked`, `unreachable` or `invalid`.
   * @param {string} message - The detail.
   * @param {object} [extra] - `{ status }`.
   */
  constructor(kind, message, { status = null } = {}) {
    super(message);
    this.name = 'PollenError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description Whether a region is supported.
 * @param {unknown} region - The value.
 * @returns {boolean} True for fr, uk, nl, us, it.
 */
const isRegion = (region) => Object.hasOwn(REGIONS, String(region));

/**
 * @description A client of the pollen radar.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {Function} [options.sleep] - `(ms) => Promise` between two requests (tests).
 * @returns {object} `{ forecast, requests }`.
 */
function createPollenClient({
  fetch: fetchFn = globalThis.fetch,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  // Requests made, for the diagnostic.
  const requests = { total: 0, last: null };
  // One request at a time, PAUSE_MS apart.
  let queue = Promise.resolve();

  /**
   * @description One request to a regional server.
   * @param {string} region - The region.
   * @param {string} city - The city name or postal code.
   * @returns {Promise<object>} The forecast read.
   */
  async function request(region, city) {
    const spec = REGIONS[region];
    if (requests.last !== null && now() - requests.last < PAUSE_MS) {
      await sleep(PAUSE_MS - (now() - requests.last));
    }
    requests.total += 1;
    requests.last = now();
    const form = new URLSearchParams({ [spec.param]: city });
    const url = spec.method === 'GET' ? `${spec.url}?${form}` : spec.url;
    let response;
    try {
      response = await fetchFn(url, {
        method: spec.method,
        headers: {
          'user-agent': USER_AGENT,
          accept: spec.method === 'GET' ? 'text/html' : 'application/json',
          ...(spec.method === 'POST'
            ? { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' }
            : {}),
        },
        ...(spec.method === 'POST' ? { body: form.toString() } : {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new PollenError('unreachable', err.cause?.code ?? err.message);
    }
    if (response.status === 403 || response.status === 429) {
      throw new PollenError('blocked', `HTTP ${response.status}`, { status: response.status });
    }
    if (!response.ok) {
      throw new PollenError('unreachable', `HTTP ${response.status}`, { status: response.status });
    }
    const body = await response.text();
    const forecast = spec.parse(body);
    if (forecast) {
      return forecast;
    }
    // A known empty answer is an unknown city; anything else is a page we
    // cannot read (the site changed).
    const empty = body.includes('EmptyView') || /"retVal"\s*:\s*false/.test(body);
    throw empty
      ? new PollenError('not_found', `"${city}" is unknown to the ${region} pollen radar`)
      : new PollenError('invalid', `unreadable answer (${body.length} bytes)`);
  }

  /**
   * @description The forecast of a city.
   * @param {string} region - fr, uk, nl, us or it.
   * @param {string} city - The city name or postal code.
   * @returns {Promise<object>} `{ city, latitude, longitude, days }` (parse.js).
   */
  function forecast(region, city) {
    if (!isRegion(region)) {
      return Promise.reject(new PollenError('invalid', `unknown region ${region}`));
    }
    const run = queue.then(() => request(region, city));
    queue = run.catch(() => {});
    return run;
  }

  return { forecast, requests };
}

export { REGIONS, PAUSE_MS, USER_AGENT, PollenError, isRegion, createPollenClient };
