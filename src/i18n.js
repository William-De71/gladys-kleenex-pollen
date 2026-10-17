// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, levels, pollen types and species,
// widget contents, scene summaries, messages of the Configuration screen.
// Vocabulary of the Gladys interface (appareil / Gerät / dispositivo, scène /
// Szene / escena).
//
// The pollen radar writes the species in the language of its country
// ("Noisetier", "Hazelaar", "Hazel"): SPECIES_ALIASES brings them back to one
// key, translated here; an unknown name is shown as the site wrote it.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const SPECIES_ALIASES = {
  hazel: ['hazel', 'noisetier', 'hazelaar'],
  elm: ['elm', 'orme', 'iep'],
  pine: ['pine', 'pin', 'pijnboom'],
  alder: ['alder', 'aulne', 'els'],
  poplar: ['poplar', 'peuplier', 'populier'],
  oak: ['oak', 'chene', 'eik'],
  plane: ['plane', 'platane', 'plataan'],
  birch: ['birch', 'bouleau', 'berk'],
  cypress: ['cypress', 'cypres', 'cipres'],
  grasses: ['poaceae', 'grasses', 'graminees', 'grassen'],
  mugwort: ['mugwort', 'armoise', 'bijvoet'],
  chenopod: ['chenopod', 'chenopodes', 'chenepod', 'ganzevoet', 'goosefoot'],
  ragweed: ['ragweed', 'ambroisie', 'ambrosia'],
  nettle: ['nettle', 'ortie', 'brandnetel'],
};

const TEXTS = {
  // devices
  deviceName: {
    en: 'Pollen {city}',
    fr: 'Pollens {city}',
    de: 'Pollen {city}',
    es: 'Polen {city}',
  },
  feature_level: {
    en: 'Pollen level today',
    fr: 'Niveau de pollens aujourd’hui',
    de: 'Pollenstufe heute',
    es: 'Nivel de polen hoy',
  },
  feature_level_tomorrow: {
    en: 'Pollen level tomorrow',
    fr: 'Niveau de pollens demain',
    de: 'Pollenstufe morgen',
    es: 'Nivel de polen mañana',
  },
  feature_count: {
    en: '{type} pollen today',
    fr: 'Pollens {type} aujourd’hui',
    de: 'Pollen {type} heute',
    es: 'Polen {type} hoy',
  },
  feature_type_level: {
    en: '{type} pollen level today',
    fr: 'Niveau pollens {type} aujourd’hui',
    de: 'Pollenstufe {type} heute',
    es: 'Nivel de polen {type} hoy',
  },
  feature_main: {
    en: 'Main pollen today',
    fr: 'Pollen principal aujourd’hui',
    de: 'Hauptpollen heute',
    es: 'Polen principal hoy',
  },

  // levels
  level_1: { en: 'Low', fr: 'Faible', de: 'Niedrig', es: 'Bajo' },
  level_2: { en: 'Moderate', fr: 'Modéré', de: 'Mäßig', es: 'Moderado' },
  level_3: { en: 'High', fr: 'Élevé', de: 'Hoch', es: 'Alto' },
  level_4: { en: 'Very high', fr: 'Très élevé', de: 'Sehr hoch', es: 'Muy alto' },
  level_none: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },

  // pollen types
  type_trees: { en: 'Trees', fr: 'Arbres', de: 'Bäume', es: 'Árboles' },
  type_grass: { en: 'Grass', fr: 'Graminées', de: 'Gräser', es: 'Gramíneas' },
  type_weeds: { en: 'Weeds', fr: 'Herbacées', de: 'Kräuter', es: 'Herbáceas' },
  typeLower_trees: { en: 'trees', fr: 'arbres', de: 'Bäume', es: 'árboles' },
  typeLower_grass: { en: 'grass', fr: 'graminées', de: 'Gräser', es: 'gramíneas' },
  typeLower_weeds: { en: 'weeds', fr: 'herbacées', de: 'Kräuter', es: 'herbáceas' },

  // species
  species_hazel: { en: 'Hazel', fr: 'Noisetier', de: 'Hasel', es: 'Avellano' },
  species_elm: { en: 'Elm', fr: 'Orme', de: 'Ulme', es: 'Olmo' },
  species_pine: { en: 'Pine', fr: 'Pin', de: 'Kiefer', es: 'Pino' },
  species_alder: { en: 'Alder', fr: 'Aulne', de: 'Erle', es: 'Aliso' },
  species_poplar: { en: 'Poplar', fr: 'Peuplier', de: 'Pappel', es: 'Álamo' },
  species_oak: { en: 'Oak', fr: 'Chêne', de: 'Eiche', es: 'Roble' },
  species_plane: { en: 'Plane tree', fr: 'Platane', de: 'Platane', es: 'Plátano de sombra' },
  species_birch: { en: 'Birch', fr: 'Bouleau', de: 'Birke', es: 'Abedul' },
  species_cypress: { en: 'Cypress', fr: 'Cyprès', de: 'Zypresse', es: 'Ciprés' },
  species_grasses: { en: 'Grasses', fr: 'Graminées', de: 'Süßgräser', es: 'Gramíneas' },
  species_mugwort: { en: 'Mugwort', fr: 'Armoise', de: 'Beifuß', es: 'Artemisa' },
  species_chenopod: { en: 'Goosefoot', fr: 'Chénopodes', de: 'Gänsefuß', es: 'Quenopodio' },
  species_ragweed: { en: 'Ragweed', fr: 'Ambroisie', de: 'Ambrosia', es: 'Ambrosía' },
  species_nettle: { en: 'Nettle', fr: 'Ortie', de: 'Brennnessel', es: 'Ortiga' },

  // days
  day_0: { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  day_1: { en: 'Tomorrow', fr: 'Demain', de: 'Morgen', es: 'Mañana' },
  dayLower_today: { en: 'today', fr: 'aujourd’hui', de: 'heute', es: 'hoy' },
  dayLower_tomorrow: { en: 'tomorrow', fr: 'demain', de: 'morgen', es: 'mañana' },

  // regions
  region_fr: { en: 'France', fr: 'France', de: 'Frankreich', es: 'Francia' },
  region_uk: {
    en: 'United Kingdom and Ireland',
    fr: 'Royaume-Uni et Irlande',
    de: 'Vereinigtes Königreich und Irland',
    es: 'Reino Unido e Irlanda',
  },
  region_nl: { en: 'Netherlands', fr: 'Pays-Bas', de: 'Niederlande', es: 'Países Bajos' },
  region_it: { en: 'Italy', fr: 'Italie', de: 'Italien', es: 'Italia' },
  region_us: { en: 'United States', fr: 'États-Unis', de: 'USA', es: 'Estados Unidos' },

  // widgets
  widgetCounts: {
    en: 'Trees {trees} · Grass {grass} · Weeds {weeds} (grains/m³)',
    fr: 'Arbres {trees} · Graminées {grass} · Herbacées {weeds} (grains/m³)',
    de: 'Bäume {trees} · Gräser {grass} · Kräuter {weeds} (Körner/m³)',
    es: 'Árboles {trees} · Gramíneas {grass} · Herbáceas {weeds} (granos/m³)',
  },
  widgetSpecies: {
    en: 'Main species: {list}',
    fr: 'Espèces principales : {list}',
    de: 'Hauptarten: {list}',
    es: 'Especies principales: {list}',
  },
  widgetNoSpecies: {
    en: 'No pollen counted.',
    fr: 'Aucun pollen compté.',
    de: 'Keine Pollen gezählt.',
    es: 'No se ha contado polen.',
  },
  widgetMainPollen: {
    en: 'Main pollen',
    fr: 'Pollen principal',
    de: 'Hauptpollen',
    es: 'Polen principal',
  },
  widgetSource: { en: 'Source', fr: 'Source', de: 'Quelle', es: 'Fuente' },
  widgetUpdated: { en: 'Read at', fr: 'Lu à', de: 'Gelesen um', es: 'Leído a las' },
  widgetUnit: { en: '/m³', fr: '/m³', de: '/m³', es: '/m³' },
  widgetGrains: { en: 'grains/m³', fr: 'grains/m³', de: 'Körner/m³', es: 'granos/m³' },
  widgetNoPlace: {
    en: 'No city yet: type one in the Configuration tab of the integration.',
    fr: 'Aucune ville pour l’instant : saisissez-en une dans l’onglet Configuration de l’intégration.',
    de: 'Noch keine Stadt: Geben Sie eine im Tab Konfiguration der Integration ein.',
    es: 'Todavía no hay ciudad: escriba una en la pestaña Configuración de la integración.',
  },
  widgetNotRead: {
    en: 'The pollen radar has not been read yet: try again in a minute.',
    fr: 'Le radar des pollens n’a pas encore été lu : réessayez dans une minute.',
    de: 'Das Pollenradar wurde noch nicht gelesen: Versuchen Sie es in einer Minute erneut.',
    es: 'El radar de polen aún no se ha leído: inténtelo de nuevo en un minuto.',
  },
  widgetSpeciesEmpty: {
    en: 'The pollen radar gives no species here: only the three types are known.',
    fr: 'Le radar des pollens ne donne pas les espèces ici : seuls les trois types sont connus.',
    de: 'Das Pollenradar nennt hier keine Arten: Nur die drei Gruppen sind bekannt.',
    es: 'El radar de polen no da las especies aquí: solo se conocen los tres tipos.',
  },

  // scene summaries
  summaryDay: {
    en: 'Pollen in {city} {day}: {label}{main}.',
    fr: 'Pollens à {city} {day} : {label}{main}.',
    de: 'Pollen in {city} {day}: {label}{main}.',
    es: 'Polen en {city} {day}: {label}{main}.',
  },
  summaryMain: {
    en: ', mostly {list}',
    fr: ', surtout {list}',
    de: ', vor allem {list}',
    es: ', sobre todo {list}',
  },
  summaryUnknown: {
    en: 'No pollen forecast for {city} {day}.',
    fr: 'Pas de prévision de pollens pour {city} {day}.',
    de: 'Keine Pollenprognose für {city} {day}.',
    es: 'No hay previsión de polen para {city} {day}.',
  },
  summaryAlert: {
    en: '{type} pollen {level} in {city} {day} ({count} grains/m³){species}.',
    fr: 'Pollens de {type} {level} à {city} {day} ({count} grains/m³){species}.',
    de: 'Pollen {type} {level} in {city} {day} ({count} Körner/m³){species}.',
    es: 'Polen de {type} {level} en {city} {day} ({count} granos/m³){species}.',
  },
  summarySpecies: {
    en: ': {list}',
    fr: ' : {list}',
    de: ': {list}',
    es: ': {list}',
  },

  // places and statuses
  statusConnected: {
    en: 'Pollen radar read: {places}. Next reading around {next}.',
    fr: 'Radar des pollens lu : {places}. Prochaine lecture vers {next}.',
    de: 'Pollenradar gelesen: {places}. Nächste Abfrage gegen {next}.',
    es: 'Radar de polen leído: {places}. Próxima lectura hacia las {next}.',
  },
  statusPlace: {
    en: 'City {slot} ({query}): {detail}',
    fr: 'Ville {slot} ({query}) : {detail}',
    de: 'Stadt {slot} ({query}): {detail}',
    es: 'Ciudad {slot} ({query}): {detail}',
  },
  placeNotFound: {
    en: 'unknown to the pollen radar of {region}. Try another spelling or the postal code.',
    fr: 'inconnue du radar des pollens ({region}). Essayez une autre orthographe ou le code postal.',
    de: 'dem Pollenradar ({region}) unbekannt. Versuchen Sie eine andere Schreibweise oder die Postleitzahl.',
    es: 'desconocida para el radar de polen ({region}). Pruebe otra grafía o el código postal.',
  },
  placeError: {
    en: 'not read ({detail}).',
    fr: 'non lue ({detail}).',
    de: 'nicht gelesen ({detail}).',
    es: 'no leída ({detail}).',
  },
  noPlaces: {
    en: 'Type at least one city in the Configuration tab.',
    fr: 'Saisissez au moins une ville dans l’onglet Configuration.',
    de: 'Geben Sie im Tab Konfiguration mindestens eine Stadt ein.',
    es: 'Escriba al menos una ciudad en la pestaña Configuración.',
  },
  statusBlocked: {
    en: 'The pollen radar refused the request (HTTP {status}). New try in {minutes} min.',
    fr: 'Le radar des pollens a refusé la requête (HTTP {status}). Nouvel essai dans {minutes} min.',
    de: 'Das Pollenradar hat die Anfrage abgelehnt (HTTP {status}). Neuer Versuch in {minutes} Min.',
    es: 'El radar de polen rechazó la petición (HTTP {status}). Nuevo intento en {minutes} min.',
  },
  statusInvalid: {
    en: 'The pollen radar page could not be read: the site may have changed. New try in {minutes} min.',
    fr: 'La page du radar des pollens n’a pas pu être lue : le site a peut-être changé. Nouvel essai dans {minutes} min.',
    de: 'Die Seite des Pollenradars konnte nicht gelesen werden: Die Website hat sich vielleicht geändert. Neuer Versuch in {minutes} Min.',
    es: 'No se pudo leer la página del radar de polen: puede que el sitio haya cambiado. Nuevo intento en {minutes} min.',
  },
  statusUnreachable: {
    en: 'Pollen radar unreachable ({detail}). New try in {minutes} min.',
    fr: 'Radar des pollens injoignable ({detail}). Nouvel essai dans {minutes} min.',
    de: 'Pollenradar nicht erreichbar ({detail}). Neuer Versuch in {minutes} Min.',
    es: 'Radar de polen inaccesible ({detail}). Nuevo intento en {minutes} min.',
  },

  // configuration actions
  refreshDone: {
    en: 'Read: {places}.',
    fr: 'Lu : {places}.',
    de: 'Gelesen: {places}.',
    es: 'Leído: {places}.',
  },
  refreshTooSoon: {
    en: 'Already read {minutes} min ago: the forecast changes a few times a day at most.',
    fr: 'Déjà lu il y a {minutes} min : la prévision change quelques fois par jour au plus.',
    de: 'Bereits vor {minutes} Min. gelesen: Die Prognose ändert sich höchstens einige Male am Tag.',
    es: 'Ya leído hace {minutes} min: la previsión cambia como mucho unas pocas veces al día.',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the Logs tab ({count} line(s)).',
    fr: 'Diagnostic écrit dans l’onglet Journaux ({count} ligne(s)).',
    de: 'Diagnose in den Tab Protokolle geschrieben ({count} Zeile(n)).',
    es: 'Diagnóstico escrito en la pestaña Registros ({count} línea(s)).',
  },
};

/**
 * @description Whether a value is one of the languages of the integration.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('deviceName', 'fr', { city: 'Mâcon' }); // -> 'Pollens Mâcon'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object|Function} [values] - The substitutions, or `(language) => values`.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description A list joined the way a language does ("Birch and Oak").
 * @param {string[]} items - The items.
 * @param {string} language - The language.
 * @returns {string} The list.
 */
function joinList(items, language) {
  return new Intl.ListFormat(isLanguage(language) ? language : 'en', {
    style: 'long',
    type: 'conjunction',
  }).format(items);
}

/**
 * @description Label of a pollen level.
 * @param {number|null} level - 1 to 4.
 * @param {string} language - The language.
 * @returns {string} The label, "Unknown" without a level.
 */
function levelLabel(level, language) {
  return Number.isInteger(level) && level >= 1 && level <= 4
    ? t(`level_${level}`, language)
    : t('level_none', language);
}

/**
 * @description The key of a species name as the pollen radar writes it.
 * @param {string} name - "Noisetier", "Hazelaar", "Poaceae "…
 * @returns {string|null} The key, null when unknown.
 * @example
 * speciesKey('Chêne'); // -> 'oak'
 */
function speciesKey(name) {
  const plain = String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  for (const [key, aliases] of Object.entries(SPECIES_ALIASES)) {
    if (aliases.includes(plain)) {
      return key;
    }
  }
  return null;
}

/**
 * @description The name of a species in a language.
 * @param {string} name - The name the pollen radar wrote.
 * @param {string} language - The language.
 * @returns {string} The translated name, or the name as written.
 */
function speciesName(name, language) {
  const key = speciesKey(name);
  return key ? t(`species_${key}`, language) : String(name ?? '').trim();
}

/**
 * @description A time of day ("15:42").
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text.
 */
function shortTime(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(isLanguage(language) ? language : 'en', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(instant));
}

/**
 * @description An instant written the short way of a language ("17/10 13:12").
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text.
 */
function shortDateTime(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(isLanguage(language) ? language : 'en', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(instant));
}

export {
  LANGUAGES,
  TEXTS,
  SPECIES_ALIASES,
  isLanguage,
  t,
  all,
  joinList,
  levelLabel,
  speciesKey,
  speciesName,
  shortTime,
  shortDateTime,
};
