// -----------------------------------------------------------------------------
// Readers of the Kleenex / Scottex pollen radar answers.
//
// The pollen radar has no documented API: the web pages of each country ask
// their own server for an HTML fragment (a JSON wrapping one in Italy). Three
// shapes exist, all read here without an HTML library (the fragments are
// small and regular):
//   - France, United Kingdom, Netherlands: one `<button class="day-link">`
//     per day, everything in its `data-*` attributes (level, count and
//     species of trees, grass and weeds);
//   - United States: one block per day, a hidden input with the level and a
//     paragraph with the count, no species;
//   - Italy: `{ city: "Milan|lat|lng", html }`, one card per day and pollen
//     type, the species in a separate panel.
//
// Every reader returns the same thing:
//   `{ city, latitude, longitude, days: [{ day, trees, grass, weeds }] }`
// where a pollen type is `{ count, level, species: [{ name, count, level }] }`,
// `count` in grains per m³ (the site writes "PPM") and `level` 1 (low) to
// 4 (very high), null when the page gives none.
// An unknown city gives `null` (the servers answer 200 with an empty view).
// -----------------------------------------------------------------------------

const POLLEN_TYPES = ['trees', 'grass', 'weeds'];
const LEVELS = { low: 1, moderate: 2, high: 3, 'very-high': 4 };
// The thresholds the Home Assistant integration uses when a page gives a
// count without a level (grains per m³: moderate, high, very high from).
const THRESHOLDS = { trees: [95, 207, 703], grass: [29, 60, 341], weeds: [20, 77, 266] };
// The attribute names of the France / UK / Netherlands day buttons.
const DETAIL_ATTRIBUTE = { trees: 'tree', grass: 'grass', weeds: 'weed' };
// The class names of the United States blocks.
const NA_KEYS = {
  trees: ['TreesRiskData', 'tree-ppm'],
  grass: ['GrassRiskData', 'grass-ppm'],
  weeds: ['WeedsRiskData', 'weed-ppm'],
};
// The data-show prefixes of the Italian cards.
const IT_KEYS = { trees: 'tree', grass: 'grass', weeds: 'weed' };

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * @description Decode the HTML entities of a text.
 * @param {string} text - The text.
 * @returns {string} The decoded text.
 * @example
 * decodeEntities('Ch&#234;ne'); // -> 'Chêne'
 */
function decodeEntities(text) {
  return String(text ?? '').replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const value =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1));
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/**
 * @description The attributes of an HTML start tag.
 * @param {string} tag - The tag, `<button a="b" …>`.
 * @returns {object} Name -> decoded value.
 */
function attributesOf(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([a-z][\w-]*)\s*=\s*"([^"]*)"/gi)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2]);
  }
  return attributes;
}

/**
 * @description The value of a hidden input, by id.
 * @param {string} html - The fragment.
 * @param {string} id - The id.
 * @returns {string} The value, '' when absent.
 */
function inputValue(html, id) {
  const tag = new RegExp(`<input[^>]*\\bid="${id}"[^>]*>`, 'i').exec(html);
  return tag ? (attributesOf(tag[0]).value ?? '').trim() : '';
}

/**
 * @description A number, or null.
 * @param {string} raw - The text.
 * @returns {number|null} The number.
 */
function numberOrNull(raw) {
  const value = Number.parseFloat(String(raw ?? '').trim());
  return Number.isFinite(value) ? value : null;
}

/**
 * @description Read a count written "133 PPM".
 * @param {string} raw - The text.
 * @returns {number|null} The count, null when absent.
 */
function readCount(raw) {
  const match = /(\d+)/.exec(String(raw ?? ''));
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * @description Read a level written "low", "Very High"…
 * @param {string} raw - The text.
 * @returns {number|null} 1 to 4, null when unknown.
 */
function readLevel(raw) {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  return LEVELS[key] ?? null;
}

/**
 * @description The level of a count, with the thresholds of a pollen type.
 * @param {string} type - trees, grass or weeds.
 * @param {number|null} count - The count.
 * @returns {number|null} 1 to 4.
 */
function levelOfCount(type, count) {
  if (count === null || count === undefined) {
    return null;
  }
  return 1 + THRESHOLDS[type].filter((threshold) => count >= threshold).length;
}

/**
 * @description A pollen type, its level read or deduced from the count.
 * @param {string} type - trees, grass or weeds.
 * @param {number|null} count - The count.
 * @param {string} level - The level as written.
 * @param {object[]} species - The species.
 * @returns {object} `{ count, level, species }`.
 */
function pollenOf(type, count, level, species = []) {
  return { count, level: readLevel(level) ?? levelOfCount(type, count), species };
}

/**
 * @description Read the species list of a France / UK / Netherlands button:
 * "Hazel,9,low|Elm,2,low".
 * @param {string} raw - The attribute.
 * @returns {object[]} `[{ name, count, level }]`.
 */
function readSpecies(raw) {
  return String(raw ?? '')
    .split('|')
    .map((item) => item.split(','))
    .filter((parts) => parts.length === 3 && parts[0].trim())
    .map(([name, count, level]) => ({
      name: name.trim(),
      count: readCount(count) ?? 0,
      level: readLevel(level),
    }));
}

/**
 * @description The day numbers written in a fragment piece.
 * @param {string} html - The piece.
 * @param {RegExp} pattern - Its first group is the day number.
 * @returns {number|null} The day of the month.
 */
function dayNumber(html, pattern) {
  const match = pattern.exec(html);
  const day = match ? Number.parseInt(match[1], 10) : NaN;
  return day >= 1 && day <= 31 ? day : null;
}

/**
 * @description The location written in the hidden inputs.
 * @param {string} html - The fragment.
 * @returns {{ city: string, latitude: number|null, longitude: number|null }} The location.
 */
const locationOf = (html) => ({
  city: inputValue(html, 'cityName'),
  latitude: numberOrNull(inputValue(html, 'pollenlat')),
  longitude: numberOrNull(inputValue(html, 'pollenlng')),
});

/**
 * @description Read a France / UK / Netherlands answer.
 * @param {string} html - The fragment.
 * @returns {object|null} The forecast, null for an unknown city.
 */
function parseDayLinks(html) {
  const text = String(html ?? '');
  const days = [];
  // Each button runs to the next one (its spans hold the day number).
  const starts = [...text.matchAll(/<button[^>]*class="[^"]*\bday-link\b[^"]*"[^>]*>/gi)];
  starts.forEach((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : text.length;
    const piece = text.slice(start.index, end);
    const day = dayNumber(piece, /class="day-number"[^>]*>\s*(\d+)/i);
    if (day === null) {
      return;
    }
    const attributes = attributesOf(start[0]);
    const entry = { day };
    for (const type of POLLEN_TYPES) {
      entry[type] = pollenOf(
        type,
        readCount(attributes[`data-${type}-count`]),
        attributes[`data-${type}`],
        readSpecies(attributes[`data-${DETAIL_ATTRIBUTE[type]}-detail`]),
      );
    }
    days.push(entry);
  });
  return days.length ? { ...locationOf(text), days } : null;
}

/**
 * @description Read a United States answer.
 * @param {string} html - The fragment.
 * @returns {object|null} The forecast, null for an unknown city.
 */
function parseNorthAmerica(html) {
  const text = String(html ?? '');
  const days = [];
  const starts = [...text.matchAll(/<p[^>]*class="[^"]*\bdate-heading\b[^"]*"[^>]*>([^<]*)/gi)];
  starts.forEach((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : text.length;
    const piece = text.slice(start.index, end);
    // "Chicago | Saturday October 17": the day is the last number.
    const day = dayNumber(decodeEntities(start[1]), /(\d+)\s*$/);
    if (day === null) {
      return;
    }
    const entry = { day };
    for (const type of POLLEN_TYPES) {
      const [riskId, countClass] = NA_KEYS[type];
      const risk = new RegExp(`<input[^>]*data-id="${riskId}"[^>]*>`, 'i').exec(piece);
      const count = new RegExp(`class="[^"]*\\b${countClass}\\b[^"]*"[^>]*>([^<]*)`, 'i').exec(
        piece,
      );
      entry[type] = pollenOf(
        type,
        count ? readCount(count[1]) : null,
        risk ? attributesOf(risk[0]).value : '',
      );
    }
    days.push(entry);
  });
  return days.length ? { ...locationOf(text), days } : null;
}

/**
 * @description Read an Italian answer.
 * @param {object|string} answer - The JSON (or its text).
 * @returns {object|null} The forecast, null for an unknown city.
 */
function parseItaly(answer) {
  let data = answer;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  const html = typeof data?.html === 'string' ? data.html : '';
  if (!html || data.retVal === false) {
    return null;
  }
  const [city = '', latitude = '', longitude = ''] = String(data.city ?? '').split('|');
  // The species panels: `<div class="tree-pollen-analysis tree-pollen-analysis-day-1">`.
  const panels = [
    ...html.matchAll(
      /<div[^>]*class="[a-z]+-pollen-analysis ([a-z]+)-pollen-analysis-day-(\d+)"/gi,
    ),
  ];
  const panelOf = (prefix, dayIndex) => {
    const position = panels.findIndex(
      (panel) => panel[1] === prefix && panel[2] === String(dayIndex),
    );
    if (position === -1) {
      return '';
    }
    const end = position + 1 < panels.length ? panels[position + 1].index : html.length;
    return html.slice(panels[position].index, end);
  };
  const days = [];
  for (const wrapper of html.matchAll(
    /<button[^>]*class="[^"]*\bday-wrapper\b[^"]*"[^>]*data-day-value="day(\d+)"[^>]*>([\s\S]*?)<\/button>/gi,
  )) {
    const dayIndex = wrapper[1];
    const day = dayNumber(wrapper[2], /class="forecast-date"[^>]*>\s*(\d+)/i);
    if (day === null) {
      continue;
    }
    const entry = { day };
    for (const type of POLLEN_TYPES) {
      const prefix = IT_KEYS[type];
      const card = new RegExp(
        `data-show="${prefix}-pollen-analysis-day-${dayIndex}"[^>]*>([\\s\\S]*?)</button>`,
        'i',
      ).exec(html);
      const status = card ? /data-status="([^"]*)"/i.exec(card[1]) : null;
      const count = card ? /class="number-text"[^>]*>([^<]*)/i.exec(card[1]) : null;
      const species = [
        ...panelOf(prefix, dayIndex).matchAll(
          /class="name-text"[^>]*>([^<]*)<\/span>\s*<span[^>]*class="quality-text"[^>]*>([^<]*)/gi,
        ),
      ].map((match) => {
        // "Low 4 PPM"
        const [, level = '', value = ''] = /^\s*([A-Za-z ]*?)\s*(\d+)/.exec(match[2]) ?? [];
        return {
          name: decodeEntities(match[1]).trim(),
          count: readCount(value) ?? 0,
          level: readLevel(level),
        };
      });
      // The Italian page can list a species twice: keep the first one.
      const unique = species.filter(
        (item, index) => species.findIndex((other) => other.name === item.name) === index,
      );
      entry[type] = pollenOf(
        type,
        count ? readCount(count[1]) : null,
        status ? status[1] : '',
        unique,
      );
    }
    days.push(entry);
  }
  return days.length
    ? {
        city: decodeEntities(city).trim(),
        latitude: numberOrNull(latitude),
        longitude: numberOrNull(longitude),
        days,
      }
    : null;
}

/**
 * @description The highest level of a day, over the three pollen types.
 * @param {object|null} day - A day of a forecast.
 * @returns {number|null} 1 to 4, null without a level.
 */
function overallLevel(day) {
  const levels = POLLEN_TYPES.map((type) => day?.[type]?.level).filter(Number.isInteger);
  return levels.length ? Math.max(...levels) : null;
}

/**
 * @description The pollen type of a day with the highest level (then count).
 * @param {object|null} day - A day of a forecast.
 * @returns {string|null} trees, grass or weeds; null when every count is 0.
 */
function mainType(day) {
  let best = null;
  for (const type of POLLEN_TYPES) {
    const pollen = day?.[type];
    if (!pollen || !(pollen.count > 0)) {
      continue;
    }
    if (
      !best ||
      (pollen.level ?? 0) > (day[best].level ?? 0) ||
      ((pollen.level ?? 0) === (day[best].level ?? 0) && pollen.count > day[best].count)
    ) {
      best = type;
    }
  }
  return best;
}

/**
 * @description The species of a day with a count, highest first.
 * @param {object|null} day - A day of a forecast.
 * @param {number} [limit] - How many.
 * @returns {object[]} `[{ type, name, count, level }]`.
 */
function topSpecies(day, limit = 3) {
  return POLLEN_TYPES.flatMap((type) =>
    (day?.[type]?.species ?? []).map((species) => ({ type, ...species })),
  )
    .filter((species) => species.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export {
  POLLEN_TYPES,
  LEVELS,
  THRESHOLDS,
  decodeEntities,
  readCount,
  readLevel,
  levelOfCount,
  parseDayLinks,
  parseNorthAmerica,
  parseItaly,
  overallLevel,
  mainType,
  topSpecies,
};
