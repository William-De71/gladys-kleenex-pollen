# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-10-17

### Added

- One device per city, typed by name or postal code, in France, the United Kingdom and Ireland, the Netherlands, Italy or the United States: pollen level today and tomorrow, count and level of trees, grass and weeds pollen today, main pollen as text.
- Scene trigger: pollen alert, per pollen type, today or tomorrow, from "Moderate", with a ready-made summary.
- Scene action: read the pollen of a city, today or tomorrow.
- Dashboard widgets: five-day pollen radar, and the species counted today.
- Configuration actions: read now, and a diagnostic written to the Logs tab.
- Cloud transport: the Kleenex / Scottex pollen radar of the chosen country is read every three hours on the integration's own timer, one request per city, and kept in `/data`.
- English, French, German and Spanish everywhere: settings, devices, species, widgets, scenes and documentation.

[0.1.0]: https://github.com/William-De71/gladys-kleenex-pollen/releases/tag/v0.1.0
