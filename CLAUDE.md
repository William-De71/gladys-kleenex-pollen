# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the Kleenex pollen radar: a
Node.js service (Node 22+, ESM, no build step) that runs in its own sandboxed
Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. Every three hours it asks the pollen radar of
the chosen country (Kleenex websites in France, the UK, the Netherlands and
the US; Scottex in Italy) for each typed city, and reads the HTML fragment
the site's own page asks for (no documented API). Transport: cloud only.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the timer
src/kleenex.js          client of the five regional servers (pace, error kinds)
src/parse.js            readers of the three answer shapes (day links, US, Italy)
src/time.js             days of the month -> dates (TZ), reading pace, midnight
src/store.js            /data/kleenex-pollen.json: places, forecasts, `seen`
src/events.js           pollen alert transitions, payloads, scene action outputs
src/device.js           one device per city, its states
src/widgets.js          forecast and species dashboard widgets
src/config.js           configuration (region, three cities, language)
src/i18n.js             runtime texts and species names, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real answers of the five radars (2026-10-17), byte for byte
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`place:<region>_<lat>_<lng>`, the coordinates the
  radar answers to two decimals: never the typed text), feature `category` /
  `type` / `unit` / `min` / `max` / `step`, the keys of `config_schema`,
  `actions`, the widgets and their settings, the scene trigger (fields,
  options, variables) and the scene action (fields, outputs).
  `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Category / type pairs.** Levels (1 low to 4 very high) and counts (grains
  per m³) are `airquality-sensor` / `aqi` **without a unit**: Gladys has no
  pollen unit and `aqi` would be wrong. The main pollen is `text` / `text`.
  No state for an unknown level or count.
- **Be gentle with the pollen radar.** It is a brand's website, not an API:
  one request per city every three hours plus a stable jitter, two seconds
  apart, one at a time, with a user agent naming the project. Never add a
  request per widget, per scene or per tick. A restart before the next
  reading makes no request (forecasts in /data). An unknown city
  (`not_found`) is reported, never retried before the next reading.
- **The site can change.** When a reader breaks, record the new answer in
  `test/fixtures/` first (byte for byte: the fixtures are excluded from
  Prettier), then fix the reader. Species names come in the language of the
  country: add their aliases to `SPECIES_ALIASES` in `src/i18n.js`.
- **Events once.** `seen` (in /data) remembers per place, date and pollen
  type the highest level announced; the first reading of a place is a
  baseline. A scene action or a widget never fires an event.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files. A card
  list in `list` display holds 8 items; a `value` tile takes no empty unit.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. A field older cores do not know needs a higher `gladys_version`
  minimum (see `src/constants.js` of the integration-store): widgets and
  scenes need 5.1.0, a `source: "houses"` select or a button form 5.2.0. No
  permission is declared. Transport: `["cloud"]`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (a local server on 127.0.0.1 at
  most).
