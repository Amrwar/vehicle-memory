/**
 * The pictures in the System Architecture Document, drawn from the code.
 *
 *   npm run docs:diagrams
 *
 * Two kinds. The entity-relationship diagrams are read from
 * packages/db/prisma/schema.prisma, one per domain, so they cannot drift
 * from the tables: a model added to the schema appears in the next build,
 * and one left out of the domain table below fails this script rather than
 * silently going missing. The flow diagrams describe how the system moves
 * data and are written here, beside the code they describe.
 *
 * Rendered with Mermaid in a headless Chromium (Playwright), to
 * docs/assets/architecture/*.png, with a schema.json beside them that the
 * document builder reads for its tables and counts.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

const ROOT = process.cwd();
const SCHEMA = join(ROOT, 'packages', 'db', 'prisma', 'schema.prisma');
const OUT = join(ROOT, 'docs', 'assets', 'architecture');

const SCALARS = new Set([
  'String',
  'Int',
  'Float',
  'Decimal',
  'Boolean',
  'DateTime',
  'Json',
  'BigInt',
  'Bytes',
]);

/** The domains, in the order the document tells them. Every model must be in exactly one. */
const DOMAINS: { key: string; title: string; models: string[] }[] = [
  {
    key: 'tenancy',
    title: 'Tenancy, identity and the audit trail',
    models: [
      'Organization',
      'Location',
      'Bay',
      'Equipment',
      'JobTypeEquipment',
      'User',
      'Membership',
      'Session',
      'LoginAttempt',
      'AuthToken',
      'Invitation',
      'ApiKey',
      'AuditLog',
      'OutboxEvent',
      'OnceRequest',
      'SyncedAction',
      'ImportBatch',
    ],
  },
  {
    key: 'vehicle',
    title: 'The vehicle and its passport',
    models: [
      'Vehicle',
      'VinDecode',
      'HandoverInvitation',
      'VehicleEvent',
      'VehicleEventAttachment',
      'VehicleOwnership',
      'OdometerReading',
      'VehicleAccessGrant',
      'PassportShare',
      'PassportShareAccess',
      'Recall',
      'VehicleRecall',
      'VehicleDocument',
      'VehicleClaim',
      'PartFitment',
      'VehicleSpecification',
      'ProductSitePrice',
    ],
  },
  {
    key: 'customer',
    title: 'Customers, bookings and the diary',
    models: [
      'Customer',
      'Tag',
      'Booking',
      'JobType',
      'ServiceItem',
      'ServiceSchedule',
      'FleetAgreement',
      // What a fleet calls its own vans. Phase 69.
      'FleetNumber',
      'ConsentChange',
    ],
  },
  {
    key: 'job',
    title: 'The job',
    models: [
      'Job',
      'JobTechnician',
      'JobJobType',
      'JobTag',
      'JobStatusEvent',
      'JobTask',
      'JobLabourLine',
      'JobPartLine',
      'JobFeeLine',
      'JobNote',
      'JobAttachment',
      'TimeEntry',
      'QualityCheck',
      'JobFollowUp',
      'VehicleCheck',
      'Signature',
      'KeyEvent',
      'ServicePackage',
      'ServicePackageLine',
      'ServicePackageCheck',
      'JobSublet',
      // A car lent out while the workshop has theirs. Phase 67.
      'CourtesyVehicle',
      'CourtesyLoan',
    ],
  },
  {
    key: 'inspection',
    title: 'Inspections, diagnosis and estimates',
    models: [
      // The diagnostic corpus. Beside the inspection because they are the two
      // records of what was found rather than what was done. ADR-0016.
      'SymptomCode',
      'CauseCode',
      'JobDiagnosis',
      'DiagnosisCause',
      // The sign-off sheet and its answers, beside the inspection: both are
      // records of what somebody looked at rather than what they did.
      'QualityCheckItem',
      'QualityCheckAnswer',
      'InspectionTemplate',
      'InspectionTemplateSection',
      'InspectionTemplateItem',
      'InspectionTemplateVersion',
      'InspectionTemplateVersionItem',
      'Inspection',
      'InspectionResult',
      'InspectionPhoto',
      'Estimate',
      'EstimateLine',
      'EstimateShare',
      'EstimateApproval',
    ],
  },
  {
    key: 'invoice',
    title: 'Invoices, payments and refunds',
    models: [
      'TaxRate',
      'LabourRate',
      'TaxComponent',
      'TaxEntry',
      'DocumentSequence',
      'Invoice',
      'InvoiceLine',
      'Payment',
      'PaymentAttempt',
      'CreditNote',
      'Refund',
    ],
  },
  {
    key: 'tender',
    title: 'The counter, gift cards and money held',
    models: [
      'Deposit',
      'DepositMovement',
      'GiftCard',
      'GiftCardEntry',
      'CounterSale',
      'CounterSaleLine',
      'CounterSaleTender',
      'TillSession',
    ],
  },
  {
    key: 'ledger',
    title: 'The ledger, expenses and banking',
    models: [
      'Account',
      'FiscalPeriod',
      'JournalEntry',
      'JournalLine',
      'Expense',
      'BankAccount',
      'BankStatement',
      'BankStatementLine',
    ],
  },
  {
    key: 'stock',
    title: 'Parts and stock',
    models: [
      'ProductCategory',
      'Product',
      'Warehouse',
      'StockLevel',
      'StockMovement',
      'StockReservation',
      'StockTransfer',
      'StockTransferLine',
      'Warranty',
      'WarrantyClaim',
    ],
  },
  {
    key: 'purchasing',
    title: 'Suppliers and purchasing',
    models: [
      'Supplier',
      'SupplierPart',
      'PurchaseRequest',
      'PurchaseOrder',
      'PurchaseOrderLine',
      'GoodsReceipt',
      'GoodsReceiptLine',
      'SupplierBill',
      'SupplierReturn',
      'SupplierReturnLine',
      'SupplierCreditApplication',
      'SupplierPayment',
      'SupplierPaymentAllocation',
    ],
  },
  {
    key: 'people',
    title: 'People, skills and payroll',
    models: [
      'Employee',
      'PayRate',
      'AttendanceRecord',
      'Timesheet',
      'Absence',
      'Certification',
      'Skill',
      'EmployeeSkill',
      'JobTypeSkill',
      'WorkingPattern',
      'PayrollRun',
      'PayAdjustment',
      'CommissionScheme',
      'CommissionBand',
      'CommissionAward',
    ],
  },
  {
    key: 'communication',
    title: 'Communication, retention and automation',
    models: [
      'MessageLog',
      'InboundMessage',
      'Conversation',
      'MessageAttachment',
      'MessageTemplate',
      'StaffNotification',
      'SuppressedAddress',
      'DeliveryEvent',
      // The product speaking to its operator rather than a workshop speaking
      // to a customer, but it is a message and it belongs beside the others.
      'OperatorAlert',
      'ReviewRequest',
      'LoyaltyEntry',
      'Referral',
      'Coupon',
      'CouponRedemption',
      'AutomationRule',
      'AutomationRun',
      'AutomationAction',
      'Campaign',
      'CampaignRecipient',
      'AssistantExchange',
    ],
  },
];

type Field = {
  name: string;
  type: string;
  optional: boolean;
  list: boolean;
  id: boolean;
  unique: boolean;
  fk: boolean;
  relationTo?: string;
  relationFields?: string[];
};
type Model = { name: string; fields: Field[]; comment: string };

function parseSchema() {
  const text = readFileSync(SCHEMA, 'utf8');
  const enums = new Set<string>();
  for (const m of text.matchAll(/^enum (\w+) \{/gm)) enums.add(m[1]!);

  const models: Model[] = [];
  const blocks = text.matchAll(/((?:^\/\/\/[^\n]*\n)*)^model (\w+) \{\n([\s\S]*?)^\}/gm);
  for (const block of blocks) {
    const comment = block[1]!
      .split('\n')
      .map((l) => l.replace(/^\/\/\/\s?/, '').trim())
      .filter(Boolean)
      .join(' ');
    const name = block[2]!;
    const fields: Field[] = [];
    for (const raw of block[3]!.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
      const m = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!m) continue;
      const [, fname, type, list, optional, attrs] = m;
      const rel = attrs!.match(/@relation\(([^)]*)\)/);
      const relFields = rel?.[1]!.match(/fields:\s*\[([^\]]*)\]/);
      fields.push({
        name: fname!,
        type: type!,
        optional: Boolean(optional),
        list: Boolean(list),
        id: /@id\b/.test(attrs!),
        unique: /@unique\b/.test(attrs!),
        fk: false,
        relationTo: !SCALARS.has(type!) && !enums.has(type!) ? type! : undefined,
        relationFields: relFields
          ? relFields[1]!
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      });
    }
    // Mark the foreign keys.
    const fks = new Set(fields.flatMap((f) => f.relationFields ?? []));
    for (const f of fields) if (fks.has(f.name)) f.fk = true;
    models.push({ name, fields, comment });
  }
  return { models, enums: [...enums] };
}

function erDiagram(domain: (typeof DOMAINS)[number], models: Model[]) {
  const inDomain = new Set(domain.models);
  const byName = new Map(models.map((m) => [m.name, m]));
  const lines = ['erDiagram'];
  const stubs = new Set<string>();

  for (const name of domain.models) {
    const model = byName.get(name);
    if (!model) throw new Error(`No model ${name} in the schema; fix the domain table.`);
    const scalars = model.fields.filter((f) => !f.relationTo);
    const shown = scalars.slice(0, 14);
    lines.push(`  ${name} {`);
    for (const f of shown) {
      const keys = [f.id ? 'PK' : '', f.fk ? 'FK' : '', f.unique && !f.id ? 'UK' : '']
        .filter(Boolean)
        .join(', ');
      const type = f.list ? `${f.type}_list` : f.type;
      const note = f.optional ? '"optional"' : '';
      lines.push(`    ${type} ${f.name} ${keys}${keys && note ? ' ' : ''}${note}`.trimEnd());
    }
    if (scalars.length > shown.length) {
      lines.push(`    more fields "and ${scalars.length - shown.length} more"`);
    }
    lines.push('  }');
  }

  for (const name of domain.models) {
    const model = byName.get(name)!;
    for (const f of model.fields) {
      if (!f.relationTo || !f.relationFields) continue;
      const target = f.relationTo;
      if (!inDomain.has(target)) stubs.add(target);
      const optional = f.optional ? 'o|' : '||';
      // Target has one; this model has many of them (or one, when the key is unique).
      const many = model.fields.some((x) => x.name === f.relationFields![0] && x.unique)
        ? '||'
        : 'o{';
      lines.push(`  ${target} ${optional}--${many} ${name} : ${f.name}`);
    }
  }
  for (const stub of stubs) {
    lines.push(`  ${stub} {`);
    lines.push(`    String id PK "in another domain"`);
    lines.push('  }');
  }
  return lines.join('\n');
}

const FLOWS: Record<string, string> = {
  context: `flowchart LR
  staff["Workshop staff<br/>owner, manager, advisor, bookkeeper"]
  tech["Technician<br/>tablet, offline-capable"]
  driver["Vehicle owner<br/>phone"]
  buyer["Buyer<br/>a link, no account"]
  integr["Another system<br/>organisation API key"]
  carnet(("CARNET"))
  email["Email<br/>Resend"]
  sms["SMS"]
  vin["VIN decode"]
  storage["Object storage<br/>photos, documents"]
  pg[("PostgreSQL")]
  staff --> carnet
  tech --> carnet
  driver --> carnet
  buyer --> carnet
  integr --> carnet
  carnet --> email
  carnet --> sms
  carnet --> vin
  carnet --> storage
  carnet --> pg`,

  containers: `flowchart TB
  subgraph web["apps/web  ·  Next.js, server components and server actions"]
    ws["/dashboard /diary /jobs …<br/>workshop"]
    shop["/shop<br/>shop floor"]
    portal["/portal<br/>customer"]
    pub["/p/token  /e/token<br/>public"]
    api["/api/v1  /api/sync  /api/cron<br/>machines"]
  end
  core["packages/core<br/>the rules: no ORM, no React<br/>1,322 tests, no database"]
  db["packages/db<br/>Prisma client + forOrg() tenant scope"]
  ui["packages/ui<br/>the design system"]
  worker["apps/worker<br/>the same jobs, on a loop, for development"]
  pg[("PostgreSQL<br/>127 models, 37 migrations")]
  web --> core
  web --> db
  web --> ui
  worker --> core
  worker --> db
  db --> pg`,

  request: `flowchart TB
  a["Browser sends a request<br/>cookie: carnet_session"] --> b["currentUser()<br/>hash the token, find the session,<br/>load user, membership, organisation, region, subscription"]
  b --> c{"signed in?"}
  c -- no --> l["redirect /login"]
  c -- yes --> d{"workshop read-only<br/>and this writes?"}
  d -- yes --> s["redirect /settings/subscription?blocked=1"]
  d -- no --> e{"can(role, permission)?"}
  e -- no --> f["redirect to the role's own surface<br/>?denied=permission, audited"]
  e -- yes --> g["forOrg(orgId)<br/>a Prisma client that filters every<br/>tenant-scoped model by organisation"]
  g --> h["the page or the action<br/>queries through the scoped client,<br/>derives through packages/core"]
  h --> i{"plan allows it?<br/>assertPlanAllows / assertWithinLimit"}
  i -- no --> j["refused where the thing is made,<br/>naming the plan"]
  i -- yes --> k["write in one transaction,<br/>audit(), redirect ?done="]`,

  write: `flowchart TB
  a["Server action, e.g. complete the job"] --> t["BEGIN transaction"]
  t --> s["status changes<br/>JobStatusEvent appended"]
  s --> o["OutboxEvent written<br/>in the same transaction"]
  o --> c["COMMIT"]
  c --> w["dispatchOutbox()<br/>/api/cron/dispatch, or the worker loop"]
  w --> p["passport events appended<br/>idempotency key per line"]
  w --> st["stock reservations consumed"]
  w --> lg["ledger entries posted<br/>double entry, balanced or refused"]
  w --> n["customer told<br/>MessageLog, DeliveryEvent"]`,

  workflow: `flowchart LR
  b["Booking<br/>diary slot, bay, capacity"] --> j["Job<br/>tasks, labour, parts, fees"]
  j --> i["Inspection<br/>template, results, photos"]
  i --> e["Estimate<br/>lines, sent by link"]
  e --> ap["Approval<br/>customer, on their phone"]
  ap --> j2["Work done<br/>time entries, quality check"]
  j2 --> inv["Invoice<br/>derived totals, tax"]
  inv --> pay["Payment<br/>cash, card, gift card,<br/>money held, points"]
  pay --> led["Ledger<br/>journal entry per posting"]
  j2 --> pp["Passport event<br/>hash-chained, append-only"]
  pay --> rec["Receipt<br/>sent and printable"]
  pay --> loy["Loyalty points<br/>referral settled"]`,

  purchasing: `flowchart LR
  r["Purchase request<br/>from a job's part line"] --> a["Approved<br/>purchase:approve"]
  a --> po["Purchase order<br/>to a supplier"]
  po --> gr["Goods receipt<br/>stock levels rise,<br/>StockMovement written"]
  gr --> sb["Supplier bill<br/>payable, posted"]
  sb --> sp["Supplier payment<br/>allocated across bills"]
  gr --> res["Stock reservation<br/>consumed when the job completes"]`,

  passport: `flowchart TB
  ev["Something happens to the vehicle<br/>job completed, MOT, ownership change, document"] --> ap["appendVehicleEvent()<br/>row lock on the vehicle"]
  ap --> h["hash = sha256(sequence, type, occurredAt,<br/>payload, odometer, recordedBy, prevHash)"]
  h --> row["VehicleEvent row<br/>append-only; corrections supersede,<br/>never edit"]
  row --> v["verifyVehicleChain()<br/>recomputes every hash,<br/>names the first divergence"]
  row --> share["PassportShare<br/>a link with a scope and an expiry"]
  row --> tr["Ownership transfer<br/>invitation to the new owner,<br/>history stays, private notes do not"]
  row --> net["The network<br/>another workshop reads what it is<br/>entitled to: VehicleAccessGrant"]`,

  sync: `flowchart LR
  t["Technician's device<br/>service worker queue"] -- "back in signal" --> s["/api/sync<br/>session cookie required"]
  s --> a["apply each queued action<br/>SyncedAction: idempotent by client id"]
  a --> b["answer with everything the device<br/>needs to carry on: its jobs, tasks, parts"]
  b --> t`,

  subscription: `stateDiagram-v2
  [*] --> AWAITING_CARD : sign-up, terms accepted
  AWAITING_CARD --> TRIAL : card on file with the provider
  TRIAL --> ACTIVE : trial ends, card charged, invoice paid
  TRIAL --> CANCELLED : cancelled during the trial, never charged
  TRIAL --> GRACE : trial ends, payment not confirmed
  GRACE --> ACTIVE : payment confirmed
  GRACE --> SUSPENDED : fourteen days, read-only
  ACTIVE --> PAST_DUE : a charge fails, still writing
  PAST_DUE --> ACTIVE : a retry pays
  ACTIVE --> CANCELLED : cancelled, open until the period ends
  SUSPENDED --> ACTIVE : a plan is chosen and paid
  CANCELLED --> ACTIVE : a plan is chosen again`,

  scheduled: `flowchart LR
  cron["Scheduler calls /api/cron/job<br/>Bearer CRON_SECRET, constant-time compare"] --> d["dispatch<br/>every minute: the outbox"]
  cron --> h["hourly<br/>service reminders queued,<br/>abandoned time entries closed,<br/>due automation actions run,<br/>passport chains audited"]
  worker["apps/worker<br/>the same functions on a five-second loop,<br/>for development only"] --> d
  worker --> h`,
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { models, enums } = parseSchema();

  const placed = new Set(DOMAINS.flatMap((d) => d.models));
  const missing = models.map((m) => m.name).filter((n) => !placed.has(n));
  if (missing.length)
    throw new Error(`Models in the schema but in no domain: ${missing.join(', ')}`);
  const unknown = [...placed].filter((n) => !models.some((m) => m.name === n));
  if (unknown.length)
    throw new Error(`Models in a domain but not the schema: ${unknown.join(', ')}`);

  const diagrams: { file: string; source: string; scale: number }[] = [
    ...DOMAINS.map((d) => ({ file: `erd-${d.key}`, source: erDiagram(d, models), scale: 2 })),
    ...Object.entries(FLOWS).map(([file, source]) => ({
      file: `flow-${file}`,
      source,
      scale: 2.5,
    })),
  ];

  const browser = await chromium.launch();
  try {
    for (const d of diagrams) {
      const context = await browser.newContext({
        viewport: { width: 2400, height: 1400 },
        deviceScaleFactor: d.scale,
      });
      const page = await context.newPage();
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff;font-family:'Public Sans',Segoe UI,sans-serif">
        <div id="d"></div>
        <script type="module">
          import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';
          mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'loose', maxTextSize: 900000, maxEdges: 2000,
            themeVariables: { primaryColor: '#e6f0f1', primaryBorderColor: '#1f6167', primaryTextColor: '#1a2022', lineColor: '#3c5559',
              secondaryColor: '#f6efe0', tertiaryColor: '#fbfaf7', fontFamily: 'Public Sans, Segoe UI, sans-serif', fontSize: '14px' },
            er: { useMaxWidth: false, minEntityWidth: 120, entityPadding: 12, fontSize: 13 },
            flowchart: { useMaxWidth: false, htmlLabels: true, padding: 12, nodeSpacing: 40, rankSpacing: 50 } });
          const src = ${JSON.stringify(d.source)};
          try {
            const { svg } = await mermaid.render('g', src);
            document.getElementById('d').innerHTML = svg;
            document.body.dataset.done = 'ok';
          } catch (e) { document.body.dataset.done = 'error: ' + (e && e.message ? e.message : String(e)); }
        </script></body></html>`);
      await page.waitForFunction(() => document.body.dataset.done, null, { timeout: 90_000 });
      const done = await page.evaluate(() => document.body.dataset.done);
      if (done !== 'ok') throw new Error(`${d.file}: ${done}`);
      const svg = page.locator('#d svg');
      await svg.screenshot({ path: join(OUT, `${d.file}.png`), scale: 'device' });
      const box = await svg.boundingBox();
      console.info(
        `  ${d.file}.png  ${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }

  // How a table is tied to a workshop: by its own orgId, through a parent that
  // has one, or not at all (the global tables the network is built on).
  const direct = new Set(
    models.filter((m) => m.fields.some((f) => f.name === 'orgId')).map((m) => m.name),
  );
  const via = new Map<string, string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of models) {
      if (direct.has(m.name) || via.has(m.name)) continue;
      const parent = m.fields.find(
        (f) =>
          f.relationFields && f.relationTo && (direct.has(f.relationTo) || via.has(f.relationTo)),
      );
      if (parent?.relationTo) {
        via.set(m.name, parent.relationTo);
        grew = true;
      }
    }
  }
  const scopeOf = (name: string) =>
    direct.has(name) ? 'organisation' : via.has(name) ? `through ${via.get(name)}` : 'global';

  writeFileSync(
    join(OUT, 'schema.json'),
    JSON.stringify(
      {
        builtOn: new Date().toISOString().slice(0, 10),
        counts: {
          models: models.length,
          enums: enums.length,
          fields: models.reduce((n, m) => n + m.fields.length, 0),
        },
        enums,
        domains: DOMAINS.map((d) => ({
          key: d.key,
          title: d.title,
          models: d.models.map((name) => {
            const m = models.find((x) => x.name === name)!;
            return {
              name,
              comment: m.comment,
              fields: m.fields.filter((f) => !f.relationTo).length,
              relations: m.fields.filter((f) => f.relationFields).map((f) => f.relationTo),
              scope: scopeOf(m.name),
            };
          }),
        })),
      },
      null,
      2,
    ),
  );
  console.info(`  schema.json  ${models.length} models, ${enums.length} enums`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
