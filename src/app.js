// -----------------------------------------------------------------------------
// The Kleenex Pollen Radar integration: every handler, registered on a Gladys
// client.
//
// Brings the pollen counts of the Kleenex / Scottex pollen radar into Gladys
// (France, United Kingdom and Ireland, Netherlands, Italy, United States):
//   - devices (device.js): one per city, typed by name or postal code: the
//     pollen level today and tomorrow, the count and level of trees, grass
//     and weeds today, the main pollen;
//   - scene trigger (events.js): pollen alert, per type, today or tomorrow;
//   - scene action: read the pollen of a city, today or tomorrow;
//   - dashboard widgets (widgets.js): five-day forecast, species of today.
//
// The pollen radar is read on the integration's own timer (every three hours,
// time.js), never on a Gladys poll, and kept in /data so a restart costs no
// request. Transport: cloud only.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  readLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
  REGION_LANGUAGE,
} from './config.js';
import { createPollenClient } from './kleenex.js';
import { createStore, DEFAULT_PATH } from './store.js';
import { overallLevel } from './parse.js';
import { buildDevice, buildStates, idsOf, placeIdOf, placeOf } from './device.js';
import { detectEvents, actionOutputs } from './events.js';
import {
  WIDGETS,
  messageContent,
  buildForecastWidget,
  buildSpeciesWidget,
  readWidgetSettings,
} from './widgets.js';
import {
  defaultTimeZone,
  localClock,
  addDays,
  datesOf,
  nextMidnight,
  jitterOf,
  MINUTE_MS,
  READ_INTERVAL_MS,
} from './time.js';
import { t, all, LANGUAGES, levelLabel, shortTime } from './i18n.js';

const ACTIONS = { REFRESH: 'refresh', DIAGNOSTIC: 'diagnostic' };
const SCENE_ACTIONS = { GET_POLLEN: 'get_pollen' };
// After a failed reading: new tries, then the usual pace.
const RETRY_DELAYS_MIN = [15, 30, 60, 120];
// A manual refresh never reads again within this delay.
const REFRESH_MIN_INTERVAL_MS = 10 * MINUTE_MS;
// Longest wait of the timer.
const MAX_TIMER_MS = 6 * 3600 * 1000;
const DIAGNOSTIC_CHUNK = 3000;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

/**
 * @description The key of a typed city in the store.
 * @param {string} region - The region.
 * @param {string} query - The city as typed.
 * @returns {string} `fr:mâcon`.
 */
const queryKey = (region, query) => `${region}:${query.toLowerCase()}`;

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - HTTP transport of the pollen radar (tests).
 * @param {Function} [options.sleep] - Pause between two requests (tests).
 * @param {string} [options.storePath] - The file kept in /data.
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {string} [options.timeZone] - IANA timezone of "today" (TZ by default).
 * @param {boolean} [options.timers] - Arm the reading timer (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 */
function createApp(
  gladys,
  {
    fetch: fetchFn,
    sleep,
    storePath = DEFAULT_PATH,
    now = () => Date.now(),
    timeZone = defaultTimeZone(),
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the fallback of the texts Gladys does
  // not ask for in a language, when the `language` setting is `auto`. Until a
  // widget is shown, the language of the region.
  let language = null;
  let createdDevices = new Set();
  // The places of the configured cities: `{ id, region, city, latitude,
  // longitude, deviceId, slots }`, and the problems of the cities that gave none.
  let places = [];
  let placeErrors = [];
  let lastStatus = null;
  let lastDiscovery = null;
  let lastError = null;
  let failures = 0;
  let retryAt = null;
  let timer = null;
  let running = null;
  let stopped = false;

  const client = createPollenClient({
    now,
    ...(fetchFn ? { fetch: fetchFn } : {}),
    ...(sleep ? { sleep } : {}),
  });
  const store = createStore({ path: storePath, logger });

  const today = () => localClock(now(), timeZone).date;
  const jitter = () => jitterOf(config.places.map((place) => place.query).join('|')) * MINUTE_MS;

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  const textLanguage = () =>
    config.language === AUTO_LANGUAGE
      ? (language ?? REGION_LANGUAGE[config.region])
      : config.language;

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  // --- Places ------------------------------------------------------------------------

  /**
   * @description Rebuild the places from the cities already found (store), so
   * the devices and widgets work before the first reading.
   */
  function placesFromStore() {
    const found = new Map();
    for (const { slot, query } of config.places) {
      const known = store.data.places[queryKey(config.region, query)];
      if (known) {
        const entry = found.get(known.id) ?? {
          ...known,
          region: config.region,
          deviceId: idsOf(gladys, known.id).device,
          slots: [],
        };
        entry.slots.push(slot);
        found.set(known.id, entry);
      }
    }
    places = [...found.values()];
  }

  // --- Devices and states ------------------------------------------------------------

  /**
   * @description The day of a place at a date.
   * @param {string} placeId - The place id.
   * @param {string} date - `YYYY-MM-DD`.
   * @returns {object|null} The day.
   */
  const dayOf = (placeId, date) =>
    store.data.forecasts?.[placeId]?.days?.find((day) => day.date === date) ?? null;

  /**
   * @description The today / tomorrow days of a place.
   * @param {string} placeId - The place id.
   * @returns {{ today: object|null, tomorrow: object|null }} The days.
   */
  function daysOf(placeId) {
    const date = today();
    return { today: dayOf(placeId, date), tomorrow: dayOf(placeId, addDays(date, 1)) };
  }

  /**
   * @description Offer the place devices on the Discovery screen, when they changed.
   * @param {boolean} [force] - Publish even when unchanged.
   * @returns {Promise<number>} The count.
   */
  async function publishDiscoveredDevices(force = false) {
    const lang = textLanguage();
    const devices = places.map((place) => buildDevice(gladys, place, { language: lang }));
    const signature = JSON.stringify(devices);
    if (force || signature !== lastDiscovery) {
      await gladys.publishDiscoveredDevices(devices);
      lastDiscovery = signature;
    }
    return devices.length;
  }

  /**
   * @description Publish the states of the created devices (only the changed ones).
   * @returns {Promise<void>}
   */
  async function publishStates() {
    const lang = textLanguage();
    const states = places
      .filter((place) => createdDevices.has(place.deviceId))
      .flatMap((place) => buildStates(gladys, place.id, daysOf(place.id), { language: lang }));
    if (states.length > 0) {
      await gladys.publishChangedStates(states);
    }
  }

  const publishQuietly = () =>
    publishStates().catch((err) => logger.warn(`Unable to publish the states: ${err.message}`));

  /**
   * @description Ask every open widget to pull its content again.
   */
  function refreshWidgets() {
    for (const key of Object.values(WIDGETS)) {
      Promise.resolve(gladys.requestWidgetRefresh(key)).catch(() => {});
    }
  }

  // --- Reading -----------------------------------------------------------------------

  /**
   * @description When the next reading is due.
   * @returns {number} The instant, in ms.
   */
  const nextReading = () =>
    store.data.fetchedAt ? store.data.fetchedAt + READ_INTERVAL_MS + jitter() : now();

  /**
   * @description The places and their level today, for a message.
   * @param {string} l - The language.
   * @returns {string} "Mâcon low, Lyon high".
   */
  const placesText = (l) =>
    places
      .map(
        (place) =>
          `${place.city} ${levelLabel(overallLevel(daysOf(place.id).today), l).toLowerCase()}`,
      )
      .join(', ') || '-';

  /**
   * @description The problems of the cities, for a message.
   * @param {string} l - The language.
   * @returns {string[]} One sentence per city.
   */
  const problemsText = (l) =>
    placeErrors.map((error) =>
      t('statusPlace', l, { slot: error.slot, query: error.query, detail: error.detail(l) }),
    );

  /**
   * @description The status message after a reading.
   * @returns {object} The multi-language message.
   */
  function connectedMessage() {
    const next = Math.min(nextReading(), retryAt ?? Infinity);
    return Object.fromEntries(
      LANGUAGES.map((l) => [
        l,
        [
          t('statusConnected', l, { places: placesText(l), next: shortTime(next, l, timeZone) }),
          ...problemsText(l),
        ].join(' '),
      ]),
    );
  }

  /**
   * @description The multi-language message of a failed reading.
   * @param {Error} err - The error.
   * @param {number} minutes - Minutes before the next try.
   * @returns {object} The message.
   */
  function errorMessage(err, minutes) {
    switch (err.kind) {
      case 'blocked':
        return all('statusBlocked', { status: err.status ?? '?', minutes });
      case 'invalid':
        return all('statusInvalid', { minutes });
      default:
        return all('statusUnreachable', { detail: String(err.message).slice(0, 80), minutes });
    }
  }

  /**
   * @description Read the pollen radar for every city, publish everything.
   * @returns {Promise<boolean>} True when at least one city was read.
   */
  async function round() {
    if (config.places.length === 0) {
      places = [];
      placeErrors = [];
      await reportStatus(false, all('noPlaces'));
      return false;
    }
    const date = today();
    const region = config.region;
    const found = new Map();
    const errors = [];
    let failure = null;
    for (const { slot, query } of config.places) {
      try {
        const forecast = await client.forecast(region, query);
        if (!Number.isFinite(forecast.latitude) || !Number.isFinite(forecast.longitude)) {
          throw Object.assign(new Error('no coordinates in the answer'), { kind: 'invalid' });
        }
        const id = placeIdOf(region, forecast.latitude, forecast.longitude);
        const city = forecast.city || query;
        const dates = datesOf(
          forecast.days.map((day) => day.day),
          date,
        );
        store.data.forecasts[id] = {
          region,
          city,
          days: forecast.days
            .map((day, index) => ({ ...day, date: dates[index] }))
            .filter((day) => day.date),
        };
        const known = {
          id,
          city,
          latitude: forecast.latitude,
          longitude: forecast.longitude,
        };
        store.data.places[queryKey(region, query)] = known;
        const entry = found.get(id) ?? {
          ...known,
          region,
          deviceId: idsOf(gladys, id).device,
          slots: [],
        };
        entry.slots.push(slot);
        found.set(id, entry);
      } catch (err) {
        logger.warn(`City ${slot} (${query}): ${err.kind ?? 'error'} ${err.message}`);
        if (err.kind === 'not_found') {
          errors.push({
            slot,
            query,
            kind: err.kind,
            detail: (l) => t('placeNotFound', l, { region: t(`region_${region}`, l) }),
          });
        } else {
          failure = failure ?? err;
          errors.push({
            slot,
            query,
            kind: err.kind ?? 'error',
            detail: (l) => t('placeError', l, { detail: String(err.message).slice(0, 80) }),
          });
          // Keep the place known from an earlier reading.
          const known = store.data.places[queryKey(region, query)];
          if (known && !found.has(known.id)) {
            found.set(known.id, {
              ...known,
              region,
              deviceId: idsOf(gladys, known.id).device,
              slots: [slot],
            });
          }
        }
      }
    }
    places = [...found.values()];
    placeErrors = errors;
    const readCount = config.places.length - errors.length;

    if (readCount === 0 && failure) {
      failures += 1;
      lastError = { at: now(), kind: failure.kind ?? 'error', message: failure.message };
      const delay = RETRY_DELAYS_MIN[Math.min(failures, RETRY_DELAYS_MIN.length) - 1] * MINUTE_MS;
      retryAt = now() + delay;
      await store.save();
      logger.warn(`Pollen radar reading failed (${failure.kind ?? 'error'}): ${failure.message}`);
      await publishDiscoveredDevices().catch(() => {});
      await reportStatus(false, errorMessage(failure, Math.round(delay / MINUTE_MS)));
      return false;
    }

    failures = 0;
    retryAt = null;
    lastError = failure
      ? { at: now(), kind: failure.kind ?? 'error', message: failure.message }
      : null;
    store.data.fetchedAt = now();
    const { events, seen } = detectEvents({
      places,
      daysOf: dayOf,
      seen: store.data.seen,
      today: date,
      language: textLanguage(),
    });
    store.data.seen = { ...store.data.seen, ...seen };
    await store.save();
    for (const event of events) {
      try {
        await gladys.publishSceneEvent(event.key, event.data);
      } catch (err) {
        logger.warn(`Unable to fire ${event.key}: ${err.message}`);
      }
    }
    logger.info(
      `Pollen radar read for ${places.map((p) => p.city).join(', ') || '-'}: ${events.length} scene event(s), ${errors.length} city problem(s)`,
    );
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    await publishQuietly();
    refreshWidgets();
    if (readCount === 0) {
      // Only unknown cities: nothing to show.
      await reportStatus(
        false,
        Object.fromEntries(LANGUAGES.map((l) => [l, problemsText(l).join(' ')])),
      );
      return false;
    }
    await reportStatus(true, connectedMessage());
    return true;
  }

  /**
   * @description Run one reading at a time.
   * @returns {Promise<boolean>} The result of round().
   */
  function read() {
    if (!running) {
      running = round().finally(() => {
        running = null;
      });
    }
    return running;
  }

  /**
   * @description Whether the data kept in /data are still fresh for these cities.
   * @returns {boolean} True when read less than an interval ago, every city known.
   */
  function cacheIsFresh() {
    if (!store.data.fetchedAt || now() >= nextReading()) {
      return false;
    }
    return (
      config.places.length > 0 &&
      config.places.every(({ query }) => {
        const known = store.data.places[queryKey(config.region, query)];
        return known && store.data.forecasts?.[known.id];
      })
    );
  }

  // --- Timer -------------------------------------------------------------------------

  /**
   * @description Arm the timer for the next thing to do: a reading, a retry,
   * or local midnight (today becomes yesterday's tomorrow).
   */
  function schedule() {
    if (!timers || stopped) {
      return;
    }
    clearTimeout(timer);
    const current = now();
    const candidates = [nextReading(), nextMidnight(current, timeZone)];
    if (retryAt) {
      candidates.push(retryAt);
    }
    const at = Math.min(...candidates);
    timer = setTimeout(tick, Math.min(MAX_TIMER_MS, Math.max(1000, at - current)));
    timer.unref?.();
  }

  /**
   * @description What the timer does when it fires.
   * @returns {Promise<void>}
   */
  async function tick() {
    try {
      const current = now();
      const due = (retryAt !== null && current >= retryAt) || current >= nextReading();
      if (due && config.places.length > 0) {
        await read();
      } else {
        // A new day: the states and widgets move by one day.
        await publishQuietly();
        refreshWidgets();
      }
    } catch (err) {
      logger.error('Timer', err);
    }
    schedule();
  }

  /**
   * @description Offer the devices, read when needed.
   * @param {object} [options] - `{ force }`: read even with fresh data.
   * @returns {Promise<void>}
   */
  async function refreshAll({ force = false } = {}) {
    placesFromStore();
    if (!force && cacheIsFresh()) {
      placeErrors = [];
      await publishDiscoveredDevices().catch((err) =>
        logger.warn(`Unable to offer the devices: ${err.message}`),
      );
      await publishQuietly();
      refreshWidgets();
      await reportStatus(true, connectedMessage());
    } else {
      await read();
    }
    schedule();
  }

  // --- Dashboard widgets -------------------------------------------------------------

  /**
   * @description The place of a widget instance.
   * @param {object} settings - The settings.
   * @returns {object|null} The place.
   */
  function placeOfWidget(settings) {
    const id = placeOf(readWidgetSettings(settings).place);
    return places.find((place) => place.id === id) ?? places[0] ?? null;
  }

  /**
   * @description Common checks of a widget request.
   * @param {object|null} place - The place.
   * @param {string} lang - The language.
   * @returns {object|null} A message content, null when the widget can be built.
   */
  function widgetProblem(place, lang) {
    if (!place) {
      return messageContent(
        config.places.length ? t('widgetNotRead', lang) : t('widgetNoPlace', lang),
        60,
      );
    }
    if (!store.data.forecasts?.[place.id]) {
      return messageContent(t('widgetNotRead', lang), 60);
    }
    return null;
  }

  gladys.onWidgetGet(WIDGETS.FORECAST, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const place = placeOfWidget(settings);
    const problem = widgetProblem(place, lang);
    if (problem) {
      return problem;
    }
    const date = today();
    return buildForecastWidget({
      place,
      days: store.data.forecasts[place.id].days.filter((day) => day.date >= date),
      fetchedAt: store.data.fetchedAt,
      language: lang,
      timeZone,
    });
  });

  gladys.onWidgetGet(WIDGETS.SPECIES, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const place = placeOfWidget(settings);
    return (
      widgetProblem(place, lang) ??
      buildSpeciesWidget({
        place,
        today: daysOf(place.id).today,
        fetchedAt: store.data.fetchedAt,
        language: lang,
        timeZone,
      })
    );
  });

  // --- Scene action ------------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_POLLEN, async (fields = {}) => {
    const id = placeOf(fields.place);
    const place = places.find((candidate) => candidate.id === id) ?? (id ? null : places[0]);
    if (!place) {
      throw new Error(`Unknown city: ${fields.place ?? '(none)'}`);
    }
    if (!store.data.forecasts?.[place.id]) {
      throw new Error('The pollen radar has not been read yet');
    }
    const day = fields.day === 'tomorrow' ? 'tomorrow' : 'today';
    const date = day === 'tomorrow' ? addDays(today(), 1) : today();
    return actionOutputs({ place, day, date, entry: dayOf(place.id, date) }, textLanguage());
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.REFRESH, async () => {
    if (config.places.length === 0) {
      return all('noPlaces');
    }
    const fetchedAt = store.data.fetchedAt;
    if (fetchedAt && now() - fetchedAt < REFRESH_MIN_INTERVAL_MS && !lastError && cacheIsFresh()) {
      return all('refreshTooSoon', {
        minutes: Math.max(1, Math.round((now() - fetchedAt) / MINUTE_MS)),
      });
    }
    const ok = await read();
    schedule();
    if (!ok) {
      return lastStatus ? JSON.parse(lastStatus)[1] : all('noPlaces');
    }
    return Object.fromEntries(
      LANGUAGES.map((l) => [
        l,
        [t('refreshDone', l, { places: placesText(l) }), ...problemsText(l)].join(' '),
      ]),
    );
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const report = {
      version: VERSION,
      timeZone: timeZone ?? null,
      today: today(),
      region: config.region,
      cities: config.places,
      places: places.map(({ id, city, latitude, longitude, slots }) => ({
        id,
        city,
        latitude,
        longitude,
        slots,
      })),
      placeErrors: placeErrors.map((error) => ({
        slot: error.slot,
        query: error.query,
        kind: error.kind,
        detail: error.detail('en'),
      })),
      created: places.filter((place) => createdDevices.has(place.deviceId)).map((p) => p.id),
      fetchedAt: store.data.fetchedAt ? new Date(store.data.fetchedAt).toISOString() : null,
      nextReading: new Date(nextReading()).toISOString(),
      retryAt: retryAt ? new Date(retryAt).toISOString() : null,
      lastError,
      requests: client.requests.total,
      forecasts: store.data.forecasts,
    };
    const json = JSON.stringify(report);
    const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
    for (let chunk = 0; chunk < count; chunk += 1) {
      logger.info(
        `Pollen diagnostic ${chunk + 1}/${count}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
      );
    }
    return all('diagnosticDone', { count });
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    if (places.length === 0 && config.places.length > 0) {
      await read();
    }
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} city(ies) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishQuietly();
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const before = JSON.stringify([config.region, config.places]);
    await loadConfig(rawConfig);
    const after = JSON.stringify([config.region, config.places]);
    lastDiscovery = null;
    failures = 0;
    retryAt = null;
    logger.info('Configuration updated');
    // New region or cities: read now; a language change only renames the
    // offered devices.
    await refreshAll({ force: before !== after });
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each (re)connection resynchronizes; the promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await loadConfig();
      await store.load();
      await refreshCreatedDevices();
      lastStatus = null;
      lastDiscovery = null;
      await refreshAll();
    })().catch((err) => logger.error('Startup', err));
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stopped = true;
    clearTimeout(timer);
  });

  return {
    store,
    client,
    read,
    tick,
    refreshAll,
    getConfig: () => config,
    getPlaces: () => places,
    getRetryAt: () => retryAt,
    whenReady: () => startup,
  };
}

export { createApp, ACTIONS, SCENE_ACTIONS, RETRY_DELAYS_MIN, REFRESH_MIN_INTERVAL_MS };
