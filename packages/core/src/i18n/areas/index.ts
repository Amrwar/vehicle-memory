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
import * as start from './start';
import * as coupons from './coupons';
import * as wiring from './wiring';
import * as books from './books';
import * as health from './health';
import * as clock from './clock';
import * as pilot from './pilot';
import * as components from './components';
import * as jobs from './jobs';
import * as settings from './settings';
import * as customers from './customers';
import * as money from './money';
import * as stock from './stock';
import * as business from './business';
import * as coreMessages from './core-messages';
import * as messages from './messages';
import * as privacy from './privacy';
import * as belonging from './belonging';
import * as followups from './followups';
import * as courtesy from './courtesy';
import * as diagnosis from './diagnosis';
import * as comeback from './comeback';
import * as signoff from './signoff';
import * as standing from './standing';
import * as equipment from './equipment';
import * as sourcing from './sourcing';
import * as specification from './specification';

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
  start,
  coupons,
  wiring,
  books,
  health,
  clock,
  pilot,
  privacy,
  belonging,
  followups,
  courtesy,
  diagnosis,
  comeback,
  equipment,
  signoff,
  sourcing,
  specification,
  standing,
] as const;
