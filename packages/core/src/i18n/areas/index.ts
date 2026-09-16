/**
 * The dictionaries by area of the product, merged into one per language.
 * Phase 40.5. Split so that each area can be translated without touching
 * another's file.
 */

import * as publicSite from './public';
import * as portal from './portal';
import * as print from './print';
import * as providers from './providers';
import * as ownership from './ownership';
import * as components from './components';
import * as jobs from './jobs';
import * as settings from './settings';
import * as customers from './customers';
import * as money from './money';
import * as stock from './stock';
import * as business from './business';
import * as coreMessages from './core-messages';
import * as messages from './messages';

export const AREAS = [
  publicSite,
  portal,
  components,
  jobs,
  settings,
  customers,
  money,
  stock,
  business,
  messages,
  coreMessages,
  print,
  providers,
  ownership,
] as const;
