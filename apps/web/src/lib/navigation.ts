import { msg, type Permission, type Role } from '@carnet/core';

import type { NavIconName } from '@/components/nav-icons';

/**
 * What each person sees down the side of the workshop.
 *
 * Until Phase 80 there was one list of fifty-two entries in seven groups named
 * after the parts of the system they came from — Workshop, Customers, Money,
 * Inventory, Team, Finance, Admin — filtered by permission. It worked, and the
 * feature map had called it **Partial** for thirty-five phases, because
 * filtering a list is not the same as organising one. A service advisor saw
 * the owner's shape with the owner's words, minus whatever they could not
 * reach; the first day in front of it was spent learning where things had been
 * put rather than doing the work.
 *
 * So the navigation is written per role, in the order that role works in, using
 * the words that role uses. An advisor's first section is **Today**, because
 * that is the question they open the screen to answer; an owner's is
 * **Dashboard**, because theirs is a different question. The same page can sit
 * in a different place for two people, and should: `/estimates` is one of many
 * things about a job to an owner, and a section of its own to the person who
 * chases them all morning.
 *
 * Two rules hold it together, and `verify-navigation.ts` enforces both:
 *
 *   1. Every page in the workshop appears in the owner's navigation, or is
 *      named below as reached another way. A page nobody can find is worse
 *      than one nobody built, because the map says it is there.
 *   2. No role is shown anything their role cannot open. Items are absent
 *      rather than greyed out — a disabled control is an invitation to ask
 *      why, and the answer is never satisfying.
 *
 * This file is data on purpose. The component renders it and the check reads
 * it, so the thing that is verified is the thing that is displayed.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  permission: Permission;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/* ---------------------------------------------------------------------------
   The pages, once each, so no two sections can disagree about a label
   --------------------------------------------------------------------------- */

const P = {
  dashboard: {
    href: '/dashboard',
    label: msg('Dashboard'),
    icon: 'dashboard',
    permission: 'job:read',
  },
  today: { href: '/dashboard', label: msg('Today'), icon: 'dashboard', permission: 'job:read' },
  floor: { href: '/floor', label: msg('The floor'), icon: 'floor', permission: 'diary:read' },
  plan: { href: '/plan', label: msg('Plan the day'), icon: 'plan', permission: 'diary:read' },
  capacity: {
    href: '/capacity',
    label: msg('Capacity'),
    icon: 'capacity',
    permission: 'diary:read',
  },
  skills: { href: '/skills', label: msg('Skills'), icon: 'skills', permission: 'people:read' },
  patterns: {
    href: '/patterns',
    label: msg('Working hours'),
    icon: 'capacity',
    permission: 'people:read',
  },

  diary: { href: '/diary', label: msg('Diary'), icon: 'diary', permission: 'diary:read' },

  customers: {
    href: '/customers',
    label: msg('Customers'),
    icon: 'customers',
    permission: 'customer:read',
  },
  crm: { href: '/crm', label: msg('Relationships'), icon: 'crm', permission: 'customer:read' },
  fleet: { href: '/fleet', label: msg('Fleets'), icon: 'fleet', permission: 'customer:read' },
  inbox: {
    href: '/inbox',
    label: msg('Conversations'),
    icon: 'inbox',
    permission: 'customer:read',
  },
  claims: {
    href: '/claims',
    label: msg('Vehicle requests'),
    icon: 'claims',
    permission: 'customer:read',
  },

  vehicles: {
    href: '/vehicles',
    label: msg('Vehicles'),
    icon: 'vehicles',
    permission: 'vehicle:read',
  },
  passports: {
    href: '/passports',
    label: msg('Passports'),
    icon: 'passports',
    permission: 'vehicle:read',
  },
  recalls: { href: '/recalls', label: msg('Recalls'), icon: 'recalls', permission: 'vehicle:read' },

  jobs: { href: '/jobs', label: msg('Jobs'), icon: 'jobs', permission: 'job:read' },
  inspections: {
    href: '/inspections',
    label: msg('Inspections'),
    icon: 'inspections',
    permission: 'job:read',
  },
  warranty: { href: '/warranty', label: msg('Warranty'), icon: 'warranty', permission: 'job:read' },
  estimates: {
    href: '/estimates',
    label: msg('Estimates'),
    icon: 'estimates',
    permission: 'estimate:read',
  },

  parts: { href: '/parts', label: msg('Parts'), icon: 'parts', permission: 'inventory:read' },
  transfers: {
    href: '/transfers',
    label: msg('Transfers'),
    icon: 'transfers',
    permission: 'stock:transfer',
  },

  purchasing: {
    href: '/purchasing',
    label: msg('Purchasing'),
    icon: 'purchasing',
    permission: 'purchase:request',
  },
  suppliers: {
    href: '/suppliers',
    label: msg('Suppliers'),
    icon: 'suppliers',
    permission: 'inventory:read',
  },
  payables: {
    href: '/payables',
    label: msg('Suppliers owed'),
    icon: 'payables',
    permission: 'ledger:read',
  },

  invoices: {
    href: '/invoices',
    label: msg('Invoices'),
    icon: 'invoices',
    permission: 'invoice:read',
  },
  payments: {
    href: '/payments',
    label: msg('Payments'),
    icon: 'payments',
    permission: 'payment:read',
  },
  counter: {
    href: '/counter',
    label: msg('Counter'),
    icon: 'counter',
    permission: 'invoice:write',
  },
  giftCards: {
    href: '/gift-cards',
    label: msg('Gift cards'),
    icon: 'giftcards',
    permission: 'payment:read',
  },
  expenses: {
    href: '/expenses',
    label: msg('Expenses'),
    icon: 'expenses',
    permission: 'report:financial',
  },
  banking: { href: '/banking', label: msg('Banking'), icon: 'banking', permission: 'ledger:read' },
  ledger: { href: '/ledger', label: msg('Ledger'), icon: 'ledger', permission: 'ledger:read' },
  books: {
    href: '/books',
    label: msg('Do the books agree?'),
    icon: 'books',
    permission: 'report:financial',
  },
  statements: {
    href: '/financials',
    label: msg('Statements'),
    icon: 'statements',
    permission: 'report:financial',
  },

  reports: {
    href: '/reports',
    label: msg('Reports'),
    icon: 'reports',
    permission: 'report:operational',
  },
  business: {
    href: '/reports/business',
    label: msg('Business'),
    icon: 'business',
    permission: 'report:operational',
  },
  clock: {
    href: '/reports/clock',
    label: msg('How long things take'),
    icon: 'capacity',
    permission: 'report:operational',
  },
  uptake: {
    href: '/reports/uptake',
    label: msg('What you are using'),
    icon: 'insights',
    permission: 'report:operational',
  },
  tax: { href: '/reports/tax', label: msg('Tax'), icon: 'reports', permission: 'report:financial' },
  insights: {
    href: '/insights',
    label: msg('Insights'),
    icon: 'insights',
    permission: 'report:operational',
  },
  ask: { href: '/ask', label: msg('Ask'), icon: 'ask', permission: 'report:operational' },

  coupons: {
    href: '/coupons',
    label: msg('Coupons'),
    icon: 'coupons',
    permission: 'customer:read',
  },
  reminders: {
    href: '/reminders',
    label: msg('Reminders'),
    icon: 'reminders',
    permission: 'customer:read',
  },
  automation: {
    href: '/automation',
    label: msg('Automation'),
    icon: 'automation',
    permission: 'settings:read',
  },
  messages: {
    href: '/messages',
    label: msg('Messages'),
    icon: 'messages',
    permission: 'settings:read',
  },

  reputation: {
    href: '/reputation',
    label: msg('Reputation'),
    icon: 'reputation',
    permission: 'customer:read',
  },

  settings: {
    href: '/settings',
    label: msg('Settings'),
    icon: 'settings',
    permission: 'settings:read',
  },
  team: { href: '/settings/team', label: msg('Team'), icon: 'team', permission: 'settings:read' },
  people: { href: '/people', label: msg('People'), icon: 'people', permission: 'people:read' },
  payroll: { href: '/payroll', label: msg('Payroll'), icon: 'payroll', permission: 'payroll:read' },
  sites: { href: '/group', label: msg('Sites'), icon: 'sites', permission: 'report:financial' },
  audit: { href: '/audit', label: msg('Audit log'), icon: 'audit', permission: 'audit:read' },
  start: { href: '/start', label: msg('Getting started'), icon: 'start', permission: 'job:read' },
  help: { href: '/help', label: msg('Help'), icon: 'help', permission: 'job:read' },
} satisfies Record<string, NavItem>;

/* ---------------------------------------------------------------------------
   The owner: the whole workshop, in thirteen sections
   --------------------------------------------------------------------------- */

const OWNER: NavSection[] = [
  { label: msg('Dashboard'), items: [P.dashboard] },
  { label: msg('Workshop'), items: [P.floor, P.plan, P.capacity, P.skills, P.patterns] },
  { label: msg('Customers'), items: [P.customers, P.crm, P.fleet, P.inbox, P.claims] },
  { label: msg('Vehicles'), items: [P.vehicles, P.passports, P.recalls] },
  { label: msg('Jobs'), items: [P.jobs, P.estimates, P.inspections, P.warranty] },
  { label: msg('Calendar'), items: [P.diary] },
  { label: msg('Inventory'), items: [P.parts, P.transfers] },
  { label: msg('Purchasing'), items: [P.purchasing, P.suppliers, P.payables] },
  {
    label: msg('Financials'),
    items: [
      P.invoices,
      P.payments,
      P.counter,
      P.giftCards,
      P.expenses,
      P.banking,
      P.ledger,
      P.books,
      P.statements,
    ],
  },
  {
    label: msg('Reports'),
    items: [P.reports, P.business, P.clock, P.uptake, P.tax, P.insights, P.ask],
  },
  { label: msg('Marketing'), items: [P.coupons, P.reminders, P.automation, P.messages] },
  { label: msg('Reputation'), items: [P.reputation] },
  {
    label: msg('Settings'),
    items: [P.settings, P.team, P.people, P.payroll, P.sites, P.audit, P.start, P.help],
  },
];

/* ---------------------------------------------------------------------------
   Everybody else: the same pages, in the order their day runs
   --------------------------------------------------------------------------- */

/** A manager runs the floor and the people, and reads the money without keeping it. */
const MANAGER: NavSection[] = [
  { label: msg('Dashboard'), items: [P.dashboard] },
  { label: msg('Workshop'), items: [P.floor, P.plan, P.capacity, P.skills, P.patterns] },
  { label: msg('Calendar'), items: [P.diary] },
  { label: msg('Jobs'), items: [P.jobs, P.estimates, P.inspections, P.warranty] },
  { label: msg('Customers'), items: [P.customers, P.crm, P.fleet, P.inbox, P.claims] },
  { label: msg('Vehicles'), items: [P.vehicles, P.passports, P.recalls] },
  { label: msg('Inventory'), items: [P.parts, P.transfers] },
  { label: msg('Purchasing'), items: [P.purchasing, P.suppliers] },
  { label: msg('Money'), items: [P.invoices, P.payments, P.counter, P.giftCards] },
  { label: msg('Reports'), items: [P.reports, P.business, P.clock, P.uptake, P.insights, P.ask] },
  { label: msg('Marketing'), items: [P.coupons, P.reminders, P.automation, P.messages] },
  { label: msg('Reputation'), items: [P.reputation] },
  { label: msg('Settings'), items: [P.settings, P.team, P.people, P.audit, P.start, P.help] },
];

/**
 * The service advisor, whose whole day is the counter.
 *
 * Eight sections, in the order the day runs: what is happening now, what is
 * booked, who it belongs to, what they drive, what is being done to it, what
 * they have been quoted, what they have said, and what they have paid.
 */
const SERVICE_ADVISOR: NavSection[] = [
  { label: msg('Today'), items: [P.today, P.floor] },
  { label: msg('Calendar'), items: [P.diary] },
  { label: msg('Customers'), items: [P.customers, P.crm, P.fleet, P.claims] },
  { label: msg('Vehicles'), items: [P.vehicles, P.passports, P.recalls] },
  { label: msg('Jobs'), items: [P.jobs, P.inspections, P.warranty] },
  { label: msg('Estimates'), items: [P.estimates] },
  { label: msg('Messages'), items: [P.inbox, P.reminders] },
  { label: msg('Payments'), items: [P.invoices, P.payments, P.counter, P.giftCards] },
];

/** The bookkeeper never sees the diary, and the money is the whole of it. */
const BOOKKEEPER: NavSection[] = [
  { label: msg('Dashboard'), items: [P.dashboard] },
  {
    label: msg('Financials'),
    items: [
      P.invoices,
      P.payments,
      P.giftCards,
      P.expenses,
      P.banking,
      P.ledger,
      P.books,
      P.statements,
      P.payables,
    ],
  },
  { label: msg('Reports'), items: [P.tax, P.expenses, P.books, P.statements] },
  { label: msg('Customers'), items: [P.customers] },
  { label: msg('Team'), items: [P.people, P.payroll] },
  { label: msg('Settings'), items: [P.audit] },
];

/**
 * A technician has no navigation here, and that is not an omission.
 *
 * Their shell is `/shop` -- telephone-shaped, gloves-on, four screens -- and
 * every workshop page redirects them to it. Writing them a sidebar here would
 * have meant writing one out of the four permissions they hold
 * (`job:read:assigned`, `inspection:*`, `vehicle:read`, `passport:read`), which
 * is a sidebar of two entries for a screen they are never shown.
 *
 * The first draft of this file gave them one anyway, with Jobs, Inspections and
 * Parts in it. `verify-navigation.ts` refused all three on the first run: a
 * technician cannot `job:read`, only `job:read:assigned`, and cannot read
 * inventory at all. Four entries out of six were doors that would have
 * answered with a refusal.
 */
const TECHNICIAN: NavSection[] = [];

const BY_ROLE: Record<Role, NavSection[]> = {
  OWNER,
  MANAGER,
  SERVICE_ADVISOR,
  TECHNICIAN,
  BOOKKEEPER,
  // A customer is never inside the workshop shell; their navigation is the
  // portal's, which is a different component and a different vocabulary.
  CUSTOMER: [],
};

/** Every section this role is shown, in their order. Unfiltered. */
export function navigationFor(role: Role): NavSection[] {
  return BY_ROLE[role] ?? [];
}

/** Every page any role can reach from the navigation. */
export function everyNavHref(): string[] {
  return [...new Set(Object.values(P).map((item) => item.href))];
}

/**
 * Pages with no entry of their own, and why.
 *
 * Read by `verify-navigation.ts`, which fails on anything reachable from
 * nowhere and not named here. The reason is the point: each of these is
 * arrived at from somewhere, and if that stops being true the sentence stops
 * being true with it.
 */
export const REACHED_ANOTHER_WAY: Record<string, string> = {
  '/search': 'the box at the top of the navigation, on every page',
  '/notifications': 'the bell at the top of the navigation, which carries the count',

  // The create pages. Each is the button on the list it creates into, which is
  // where somebody is standing when they want one -- and is the contextual
  // create the navigation does not need to carry.
  '/jobs/new': 'the button on Jobs',
  '/customers/new': 'the button on Customers',
  '/vehicles/find': 'the button on Vehicles, and from a vehicle that is not the right one',
  '/bookings/new': 'the button on the Diary',
  '/parts/new': 'the button on Parts',
  '/suppliers/new': 'the button on Suppliers',
  '/purchasing/new': 'the button on Purchasing',

  // Places inside a thing, reached from the thing.
  '/purchasing/returns': 'from a purchase order, which is where parts go back from',
  '/payments/card': 'from Payments, which is where a card is taken',
  '/settings/site': 'from Settings',
  '/settings/organisation': 'from Settings',
  '/settings/catalogue': 'from Settings',
  '/settings/packages': 'from Settings',
  '/settings/courtesy': 'from Settings',
  '/settings/subscription': 'from Settings',
  '/settings/data': 'from Settings',
};
