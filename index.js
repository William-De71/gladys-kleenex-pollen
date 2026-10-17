// -----------------------------------------------------------------------------
// Entry point of the Kleenex Pollen Radar external integration.
//
// Brings the pollen counts of the Kleenex / Scottex pollen radar into Gladys
// (France, United Kingdom and Ireland, Netherlands, Italy, United States),
// without an account:
//   - devices: one per city (typed by name or postal code), with the pollen
//     level today and tomorrow, the count and level of trees, grass and weeds
//     today, and the main pollen (see src/device.js);
//   - scene trigger: pollen alert;
//   - scene action: read the pollen of a city;
//   - dashboard widgets: five-day forecast, species of today.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Kleenex Pollen Radar integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
