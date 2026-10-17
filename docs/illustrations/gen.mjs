// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two widgets for Mâcon on a made-up but realistic spring day (fixed
// date): an answer of the French pollen radar, written in its real shape (the
// `day-link` buttons of test/fixtures/kleenex.fr.html), goes through the real
// reader (src/parse.js) and the real widget builders (src/widgets.js). Oak
// and birch make the trees high, the grasses rise during the week.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildForecastWidget, buildSpeciesWidget } = await load('src/widgets.js');
const { parseDayLinks } = await load('src/parse.js');
const { datesOf } = await load('src/time.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// Friday 15 May 2026, 10:12 in Paris.
const NOW = Date.parse('2026-05-15T08:12:00Z');
const TODAY = '2026-05-15';
const TREES = [
  'Noisetier',
  'Orme',
  'Pin',
  'Aulne',
  'Peuplier',
  'Chêne',
  'Platane',
  'Bouleau',
  'Cyprès',
];
const WEEDS = ['Armoise', 'Chénopodes', 'Ambroisie', 'Ortie'];

// Per day: [day, [trees level, count, species counts], [grass…], [weeds…]].
const DAYS = [
  [
    15,
    ['high', 412, [0, 4, 38, 0, 6, 190, 61, 98, 15]],
    ['moderate', 48, [48]],
    ['low', 9, [0, 2, 0, 7]],
  ],
  [
    16,
    ['high', 365, [0, 3, 30, 0, 5, 170, 52, 90, 15]],
    ['high', 74, [74]],
    ['low', 11, [0, 3, 0, 8]],
  ],
  [
    17,
    ['moderate', 180, [0, 2, 20, 0, 2, 80, 30, 40, 6]],
    ['high', 96, [96]],
    ['low', 8, [0, 1, 0, 7]],
  ],
  [
    18,
    ['moderate', 150, [0, 1, 18, 0, 2, 70, 22, 32, 5]],
    ['moderate', 52, [52]],
    ['low', 6, [0, 1, 0, 5]],
  ],
  [
    19,
    ['high', 290, [0, 2, 26, 0, 4, 140, 44, 66, 8]],
    ['high', 88, [88]],
    ['low', 10, [0, 2, 0, 8]],
  ],
];
const level = (count, type) => {
  const limits = { trees: [95, 207, 703], grass: [29, 60, 341], weeds: [20, 77, 266] }[type];
  return ['low', 'moderate', 'high', 'very-high'][limits.filter((limit) => count >= limit).length];
};
const detail = (names, counts, type) =>
  names.map((name, index) => `${name},${counts[index]},${level(counts[index], type)}`).join('|');
const html = [
  '<input id="cityName" class="city-name" type="hidden" value="Mâcon" />',
  '<input id="pollenlat" class="pollen-lat" type="hidden" value="46.3079587" />',
  '<input id="pollenlng" class="pollen-lng" type="hidden" value="4.8293535" />',
  ...DAYS.map(
    ([day, trees, grass, weeds]) =>
      `<button class="day-link" data-grass="${grass[0]}" data-trees="${trees[0]}" data-weeds="${weeds[0]}"` +
      ` data-grass-count="${grass[1]} PPM" data-weeds-count="${weeds[1]} PPM" data-trees-count="${trees[1]} PPM"` +
      ` data-grass-detail="${detail(['Poaceae'], grass[2], 'grass')}"` +
      ` data-tree-detail="${detail(TREES, trees[2], 'trees')}"` +
      ` data-weed-detail="${detail(WEEDS, weeds[2], 'weeds')}">` +
      `<span class="day-name">Ven</span><span class="day-number">${day}</span></button>`,
  ),
].join('\n');

const forecast = parseDayLinks(html);
const dates = datesOf(
  forecast.days.map((day) => day.day),
  TODAY,
);
const days = forecast.days.map((day, index) => ({ ...day, date: dates[index] }));
const place = { id: 'fr_46.31_4.83', region: 'fr', city: forecast.city };

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    forecast: buildForecastWidget({
      place,
      days,
      fetchedAt: NOW,
      language,
      timeZone: 'Europe/Paris',
    }),
    species: buildSpeciesWidget({
      place,
      today: days[0],
      fetchedAt: NOW,
      language,
      timeZone: 'Europe/Paris',
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
