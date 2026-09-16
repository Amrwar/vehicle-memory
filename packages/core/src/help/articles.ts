/**
 * Help, inside the product. Phase 45.
 *
 * Not a manual and not a tour. A person who is stuck is stuck at a particular
 * moment — a quote they cannot send, a part that will not come off the shelf,
 * a customer asking what the portal shows — and what they need is a short
 * answer in the words the product itself uses, with a link to the screen it
 * happens on.
 *
 * So the articles are data, in the same language files as everything else, and
 * they are searched with the same kind of matching the rest of the product
 * uses. Twelve of them, each two paragraphs, each about something somebody
 * actually asks. A help system nobody can read through in a morning is a help
 * system nobody reads at all.
 */

export interface HelpArticle {
  slug: string;
  title: string;
  /** One line, shown in a list of results. */
  summary: string;
  /** The screen it is about, where there is one. */
  href: string | null;
  /** Words somebody might search for that are not in the text. */
  keywords: string[];
  body: string[];
}

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'what-this-is',
    title: 'What this product is for',
    summary: 'The history belongs to the car, and that is the whole idea.',
    href: '/dashboard',
    keywords: ['carnet', 'passport', 'history', 'why'],
    body: [
      'Everything a workshop records about a vehicle is kept against the vehicle rather than against the customer, in a record that cannot be edited afterwards. When the car is sold, the history goes with it and the previous owner’s details do not.',
      'That is why jobs, inspections, parts and mileage readings all end up in one place, and why nothing here lets somebody quietly change what was recorded last year. The rest of the product is the work a workshop does on the way to those entries.',
    ],
  },
  {
    slug: 'a-job-end-to-end',
    title: 'A job from booking to invoice',
    summary: 'The path every car takes, and what each step is for.',
    href: '/jobs',
    keywords: ['workflow', 'status', 'booking', 'ramp'],
    body: [
      'A job is booked, the car is received with its mileage and condition, it is inspected, what needs doing is quoted, the customer approves, the work is done and checked, and the job is invoiced. Each step is a status on the job, and the product only offers the moves that make sense from where it is.',
      'The shop floor screen is the same job seen by whoever is holding a spanner: clock on, tick the checklist, ask for a part, hand it back. Nothing has to be typed twice, because the hours and parts recorded there are the ones the invoice is built from.',
    ],
  },
  {
    slug: 'quotes-and-approval',
    title: 'Quotes, approval and extra work',
    summary:
      'What to send, what the customer taps, and what happens when the car turns out to need more.',
    href: '/jobs',
    keywords: ['estimate', 'quote', 'approve', 'authorisation'],
    body: [
      'A quote is sent as a link the customer opens on a phone. They approve or decline each line, and what they tapped is recorded with the time, so "I never agreed to that" has an answer.',
      'Work found after approval goes on a supplementary quote rather than quietly onto the bill. Once approved work exceeds the estimate by more than the workshop’s threshold, the product asks for approval again before the job can be invoiced.',
    ],
  },
  {
    slug: 'inspections',
    title: 'Inspections and what the customer sees',
    summary: 'Red, amber and green, with photographs, in the customer’s own language.',
    href: '/shop',
    keywords: ['vhc', 'health check', 'photos', 'advisories'],
    body: [
      'An inspection is a list of items checked on the ramp, each marked green, amber or red, with a measurement where one applies and a photograph where it helps. Red and amber items become quote lines with one press.',
      'The customer sees the report as a page they can read without an account, and it prints and downloads as a PDF. What it says is what the technician recorded, not a sales script written afterwards.',
    ],
  },
  {
    slug: 'parts-and-stock',
    title: 'Parts, stock and what they cost',
    summary: 'Why a part goes on a job from the shelf rather than being typed.',
    href: '/parts',
    keywords: ['inventory', 'stock', 'supplier', 'purchase order'],
    body: [
      'A part fitted from stock leaves the shelf, carries the cost it was bought at, and shows up in the job’s profit. A part typed as a line has no cost, so the job looks more profitable than it was.',
      'Stock is counted per site, purchase orders book goods in at what was actually charged, and parts that fit particular vehicles warn when they are put on the wrong car. A stocktake corrects the shelf and records who counted it.',
    ],
  },
  {
    slug: 'invoices-and-payments',
    title: 'Invoices, payments and the till',
    summary: 'Numbered without gaps, never edited, and always agreeing with the ledger.',
    href: '/invoices',
    keywords: ['invoice', 'payment', 'receipt', 'credit note', 'till'],
    body: [
      'An invoice is numbered in sequence when it is issued and cannot be changed afterwards. A mistake is corrected with a credit note, which is what an accountant expects and what a tax authority requires.',
      'Payments are recorded against the invoice as they arrive, by card, cash, bank or account. The counter has its own till session that is counted and closed at the end of the day, and every one of these movements posts to the ledger without anybody typing a journal.',
    ],
  },
  {
    slug: 'the-portal',
    title: 'What the customer sees',
    summary: 'Their cars, their invoices, their approvals, and nothing of anybody else’s.',
    href: '/customers',
    keywords: ['portal', 'customer login', 'share', 'privacy'],
    body: [
      'A customer with a login sees the vehicles they own, what is happening to them now, their invoices and their history, in whichever of the three languages they choose. They can share a vehicle’s history with a buyer through a link that expires.',
      'They never see the workshop’s costs, margins or other customers. What a workshop records privately about a job stays with the workshop; what belongs to the car belongs to the car.',
    ],
  },
  {
    slug: 'reminders',
    title: 'Getting people back',
    summary: 'Service reminders, MOT dates and the work a customer turned down.',
    href: '/reminders',
    keywords: ['reminder', 'service due', 'mot', 'follow up', 'declined work'],
    body: [
      'A service due date is set from the work done and the mileage since, and the reminder goes out by itself when it falls due, by email or text, in the customer’s language.',
      'Work a customer declined is kept as well, and comes back as a reason to ring them rather than as a lost cause. Both are the cheapest work a workshop can win, because it is already on the books.',
    ],
  },
  {
    slug: 'tax-prices-sites',
    title: 'Tax, prices and more than one site',
    summary: 'What is charged, where, and how a group keeps two branches apart.',
    href: '/settings/site',
    keywords: ['vat', 'tax', 'labour rate', 'price', 'branch', 'site'],
    body: [
      'A tax rate can carry more than one tax, prices can be entered with tax in or before it, and a customer with a certificate can be exempt. Every document records what each tax came to when it was issued, so a return filed last quarter still reads the same next year.',
      'An hourly rate and a part price can belong to a site as well as to the workshop. A line takes the site’s figure where it has one and the workshop’s where it does not, and the screen says which it used.',
    ],
  },
  {
    slug: 'selling-a-car',
    title: 'When a car is sold',
    summary: 'Handing the history to the buyer without handing over the seller.',
    href: '/vehicles',
    keywords: ['transfer', 'handover', 'sold', 'new owner'],
    body: [
      'The seller starts a handover and the buyer accepts it from a link. Nothing moves until they do; when they accept, the car and its history land on their account and leave the seller’s.',
      'The buyer is shown the vehicle, how many owners it has had and how much history it carries, and is never shown who the seller was. That separation is what makes the record both permanent and private.',
    ],
  },
  {
    slug: 'who-sees-what',
    title: 'Who can see what',
    summary: 'Roles, and why a technician does not see the money.',
    href: '/team',
    keywords: ['roles', 'permissions', 'technician', 'manager', 'access'],
    body: [
      'Everybody has a role, and a role holds permissions. A technician sees the jobs they are on and what the work is, not the margins, the customer list or the payroll. An owner sees everything.',
      'Every change of substance is written to the audit trail with who did it and what it was before, and that trail cannot be edited by anybody, including an owner.',
    ],
  },
  {
    slug: 'your-data',
    title: 'Your data, and getting it out',
    summary: 'Exports, erasure requests and what the product will not do.',
    href: '/settings/data',
    keywords: ['export', 'gdpr', 'erasure', 'backup', 'csv', 'leave'],
    body: [
      'Every report exports as a CSV, and the whole workshop exports as a file you keep. Nothing here is designed to make leaving difficult, because a product that has to trap people is a product that knows it is not worth staying for.',
      'A customer can ask to be erased, and the product erases what is theirs while keeping what belongs to the vehicle and what the law says an invoice must keep. The audit trail records that the erasure happened, without recording what was erased.',
    ],
  },
];

/** A word somebody typed, ready to match against. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
}

export interface HelpHit {
  article: HelpArticle;
  score: number;
  /** The sentence the words were found in, for the list. */
  excerpt: string;
}

/**
 * Help that matches what somebody typed.
 *
 * Title and keywords count for more than the body, because "invoice" in a
 * title is what the article is about and "invoice" in a paragraph may be an
 * aside. A word that matches nothing at all is not fatal: two words out of
 * three still finds the article, which is what somebody typing a question
 * rather than a search term needs.
 */
export function searchHelp(
  query: string,
  articles: readonly HelpArticle[] = HELP_ARTICLES,
): HelpHit[] {
  const asked = words(query);
  if (asked.length === 0) return [];

  const hits: HelpHit[] = [];

  for (const article of articles) {
    const title = words(article.title);
    const keywords = article.keywords.flatMap(words);
    const summary = words(article.summary);

    let score = 0;
    let excerpt = article.summary;

    for (const word of asked) {
      if (title.some((candidate) => candidate.startsWith(word))) score += 6;
      if (keywords.some((candidate) => candidate.startsWith(word))) score += 4;
      if (summary.some((candidate) => candidate.startsWith(word))) score += 2;

      const paragraph = article.body.find((text) =>
        words(text).some((candidate) => candidate.startsWith(word)),
      );
      if (paragraph) {
        score += 1;
        if (excerpt === article.summary) excerpt = paragraph;
      }
    }

    if (score > 0) hits.push({ article, score, excerpt });
  }

  return hits.sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title));
}

export function helpArticle(slug: string): HelpArticle | null {
  return HELP_ARTICLES.find((article) => article.slug === slug) ?? null;
}

/**
 * The article that belongs to the screen somebody is on.
 *
 * Longest path first, so /settings/site finds the article about sites rather
 * than the one about settings in general.
 */
export function helpForPath(path: string): HelpArticle | null {
  return (
    [...HELP_ARTICLES]
      .filter((article) => article.href && path.startsWith(article.href))
      .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0] ?? null
  );
}
