/**
 * Parts back, work out, against a real database. Phase 38.
 *
 *   npx tsx infra/scripts/verify-returns.ts [baseUrl]
 *
 * An order is delivered and billed. Faulty parts go back: off the shelf,
 * their cost held as a credit due; the credit note comes off the bill.
 * A return the supplier refuses is written off. A core goes back without
 * touching the shelf and its credit reduces the cost of parts; what cannot
 * be set against a bill is held and comes off the next one. Nothing goes
 * back that was not received. Sublet work is added to a job, done, billed
 * by the vendor at its real cost, and invoiced to the customer. The trial
 * balance balances at the end. With a server on the base URL the three
 * screens are read.
 *
 * Runs against the seeded hillside-motors organisation. Cleans up after
 * itself and puts the shelf back as it was.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { ACCOUNT, trialBalance } from '@carnet/core';
import { prisma } from '@carnet/db';

import { ALL_TIME, postedLines } from '../../apps/web/src/lib/accounting';
import { createPurchaseOrder } from '../../apps/web/src/lib/catalogue';
import { defaultWarehouseFor, receiveGoods } from '../../apps/web/src/lib/inventory';
import { createJob } from '../../apps/web/src/lib/jobs';
import { issueInvoice, moveJob } from '../../apps/web/src/lib/money';
import { bookBill } from '../../apps/web/src/lib/payables';
import {
  addSublet,
  billSublet,
  creditReturn,
  heldCreditBySupplier,
  markSubletDone,
  refuseReturn,
  ReturnError,
  sendReturn,
} from '../../apps/web/src/lib/returns';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const TAG = 'Verify returns probe';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function refuses(label: string, code: string, run: () => Promise<unknown>) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    const actual = (error as { code?: string }).code;
    if (error instanceof ReturnError && actual === code) console.info(`  ok     ${label}: ${code}`);
    else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

async function main() {
  console.info(`\n  Parts back, work out\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });
  // A supplier of its own, so the credit is set against this probe's bills
  // and not the seeded supplier's older ones, which is where oldest-first
  // would rightly put it.
  await forget(
    (await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } })).id,
  );
  const supplier = await prisma.supplier.create({
    data: { orgId: org.id, name: TAG, paymentTermsDays: 30 },
    select: { id: true, name: true },
  });
  const product = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true, name: true },
  });
  const maria = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.test' } });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id, portalUserId: maria.id },
    select: { id: true },
  });
  const seeded = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customerId: customer.id },
    select: { vehicleId: true },
  });

  const warehouseId = (await defaultWarehouseFor(org.id))!;
  const shelfBefore = await prisma.stockLevel.findUnique({
    where: { productId_warehouseId: { productId: product.id, warehouseId } },
    select: { onHand: true, avgCost: true, reserved: true },
  });

  /* ------------------------------------------------------------------
     An order, delivered and billed
     ------------------------------------------------------------------ */

  console.info('\n  The order\n');

  const orderId = await createPurchaseOrder({
    orgId: org.id,
    userId: staff.id,
    supplierId: supplier.id,
    notes: TAG,
    lines: [{ productId: product.id, description: product.name, quantity: 5, unitCost: 10 }],
  });
  await prisma.purchaseOrder.update({ where: { id: orderId }, data: { status: 'SENT' } });
  const order = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { number: true, lines: { select: { id: true } } },
  });
  const lineId = order.lines[0]!.id;
  const received = await receiveGoods({
    orgId: org.id,
    orderId,
    warehouseId,
    lines: [{ orderLineId: lineId, quantity: 5, unitCost: 10 }],
    reference: `${TAG} delivery`,
  });
  check('five delivered', received.ok, true);
  const billRef = `${TAG}-BILL-1`;
  const billId = await bookBill({
    orgId: org.id,
    userId: staff.id,
    orderId,
    reference: billRef,
    subtotal: 50,
    taxTotal: 10,
    billedAt: new Date(),
  });

  const shelfAfterDelivery = await prisma.stockLevel.findUniqueOrThrow({
    where: { productId_warehouseId: { productId: product.id, warehouseId } },
    select: { onHand: true, avgCost: true },
  });
  const onHand = Number(shelfAfterDelivery.onHand);
  const avg = Number(shelfAfterDelivery.avgCost);

  /* ------------------------------------------------------------------
     Faulty parts back, and the credit note
     ------------------------------------------------------------------ */

  console.info('\n  Faulty parts back\n');

  await refuses('more than was received is refused', 'TOO_MANY', () =>
    sendReturn({
      orgId: org.id,
      userId: staff.id,
      orderId,
      reason: 'DEFECTIVE',
      lines: [{ orderLineId: lineId, quantity: 6 }],
    }),
  );
  await refuses('nothing is refused', 'NOTHING', () =>
    sendReturn({ orgId: org.id, userId: staff.id, orderId, reason: 'DEFECTIVE', lines: [] }),
  );

  const faulty = await sendReturn({
    orgId: org.id,
    userId: staff.id,
    orderId,
    reason: 'DEFECTIVE',
    notes: TAG,
    lines: [{ orderLineId: lineId, quantity: 2 }],
  });
  const shelfAfterReturn = await prisma.stockLevel.findUniqueOrThrow({
    where: { productId_warehouseId: { productId: product.id, warehouseId } },
    select: { onHand: true },
  });
  check('two come off the shelf', Number(shelfAfterReturn.onHand), onHand - 2);
  check('their cost is held', faulty.held, Math.round(2 * avg * 100) / 100);
  const movement = await prisma.stockMovement.findFirst({
    where: { referenceType: 'SupplierReturn', referenceId: faulty.returnId },
    select: { type: true, quantity: true },
  });
  check('as a return movement', [movement?.type, Number(movement?.quantity)], ['RETURN', -2]);

  await refuses('a credit note needs its number', 'NO_REFERENCE', () =>
    creditReturn({
      orgId: org.id,
      userId: staff.id,
      returnId: faulty.returnId,
      reference: ' ',
      net: 20,
      tax: 4,
    }),
  );
  const credited = await creditReturn({
    orgId: org.id,
    userId: staff.id,
    returnId: faulty.returnId,
    reference: `${TAG}-CN-1`,
    net: faulty.held,
    tax: Math.round(faulty.held * 20) / 100,
  });
  const bill = await prisma.supplierBill.findUniqueOrThrow({
    where: { id: billId },
    select: { amountPaid: true, total: true },
  });
  const gross = Math.round(faulty.held * 1.2 * 100) / 100;

  // What the credit is worth against what the bill still owes, rather than a
  // figure that happens to fit.
  //
  // This assumed the credit would always be smaller than the bill, which is
  // an assumption about the shelf. The parts go back at weighted average
  // cost, and the shelf's average is whatever every previous delivery has
  // made it -- the seed leaves five at PS8.10, so five more at PS10 average
  // PS9.05 and two of them credit PS21.72 against a PS60 bill. After
  // verify-controls has pressed its way around the product the same shelf
  // averages nearly PS39, the credit is PS93.38, and the bill can only take
  // PS60. The product was right both times: it applies what it can and holds
  // the rest, which is what heldCreditBySupplier is for. The check was
  // measuring shared state it did not create, and it passed one full run and
  // failed the next on unchanged code. Phase 78, and the same rule as
  // Phase 70.
  const billTotal = Number(bill.total);
  const applied = Math.min(gross, billTotal);

  check(
    'the credit comes off the bill, as far as the bill owes',
    [Number(bill.amountPaid), credited.unappliedMinor],
    [applied, Math.round((gross - applied) * 100)],
  );
  await refuses('a return is credited once', 'NOT_OPEN', () =>
    creditReturn({
      orgId: org.id,
      userId: staff.id,
      returnId: faulty.returnId,
      reference: 'X',
      net: 1,
      tax: 0,
    }),
  );

  /* --- refused ------------------------------------------------------ */

  const surplus = await sendReturn({
    orgId: org.id,
    userId: staff.id,
    orderId,
    reason: 'SURPLUS',
    lines: [{ orderLineId: lineId, quantity: 1 }],
  });
  await refuseReturn({
    orgId: org.id,
    userId: staff.id,
    returnId: surplus.returnId,
    reason: 'Opened packaging',
  });
  const refusedRow = await prisma.supplierReturn.findUniqueOrThrow({
    where: { id: surplus.returnId },
    select: { status: true },
  });
  check('a refused return is closed', refusedRow.status, 'REFUSED');
  const writeOff = await prisma.journalEntry.findFirst({
    where: {
      orgId: org.id,
      sourceType: 'SupplierReturn',
      sourceId: surplus.returnId,
      reference: { endsWith: '/R' },
    },
    select: { id: true },
  });
  check('and its value written off', Boolean(writeOff), true);

  /* --- a core -------------------------------------------------------- */

  console.info('\n  A core\n');

  const shelfBeforeCore = Number(
    (
      await prisma.stockLevel.findUniqueOrThrow({
        where: { productId_warehouseId: { productId: product.id, warehouseId } },
        select: { onHand: true },
      })
    ).onHand,
  );
  const core = await sendReturn({
    orgId: org.id,
    userId: staff.id,
    orderId,
    reason: 'CORE',
    lines: [{ orderLineId: lineId, quantity: 1, unitCost: 80 }],
  });
  const shelfAfterCore = Number(
    (
      await prisma.stockLevel.findUniqueOrThrow({
        where: { productId_warehouseId: { productId: product.id, warehouseId } },
        select: { onHand: true },
      })
    ).onHand,
  );
  check(
    'a core does not touch the shelf and holds nothing',
    [shelfAfterCore - shelfBeforeCore, core.held],
    [0, 0],
  );
  const coreCredit = await creditReturn({
    orgId: org.id,
    userId: staff.id,
    returnId: core.returnId,
    reference: `${TAG}-CN-2`,
    net: 80,
    tax: 0,
  });
  // Whatever the first credit left on the bill, the core charge pays off and
  // the remainder is held -- which is PS80 in full when the first credit
  // already covered the bill.
  const remaining = Math.round((billTotal - applied) * 100);
  check(
    'the core credit pays off the bill and the rest is held',
    coreCredit.unappliedMinor,
    8000 - remaining,
  );
  const held = await heldCreditBySupplier(org.id);
  check(
    'the held credit shows against the supplier',
    (held.get(supplier.id) ?? 0) >= (8000 - remaining) / 100,
    true,
  );
  const cogs = await prisma.journalLine.findFirst({
    where: {
      entry: { sourceType: 'SupplierReturn', sourceId: core.returnId },
      account: { code: ACCOUNT.COGS_PARTS },
    },
    select: { credit: true },
  });
  check('and the core charge comes off the cost of parts', Number(cogs?.credit), 80);

  await refuses('nothing goes back beyond what was received', 'TOO_MANY', () =>
    sendReturn({
      orgId: org.id,
      userId: staff.id,
      orderId,
      reason: 'CORE',
      lines: [{ orderLineId: lineId, quantity: 2 }],
    }),
  );

  const billRef2 = `${TAG}-BILL-2`;
  const bill2Id = await bookBill({
    orgId: org.id,
    userId: staff.id,
    orderId,
    reference: billRef2,
    subtotal: 10,
    taxTotal: 0,
    billedAt: new Date(),
  });
  const bill2 = await prisma.supplierBill.findUniqueOrThrow({
    where: { id: bill2Id },
    select: { amountPaid: true, status: true },
  });
  check(
    'the next bill takes the held credit',
    Number(bill2.amountPaid),
    Math.min(10, (8000 - remaining) / 100),
  );

  /* ------------------------------------------------------------------
     Sublet
     ------------------------------------------------------------------ */

  console.info('\n  Sublet work\n');

  const job = await createJob({
    orgId: org.id,
    userId: staff.id,
    locationId: null,
    customerId: customer.id,
    vehicleId: seeded.vehicleId,
    shortDescription: TAG,
  });
  await refuses('sublet work needs a description', 'NO_DESCRIPTION', () =>
    addSublet({
      orgId: org.id,
      userId: staff.id,
      jobId: job.id,
      supplierId: supplier.id,
      description: ' ',
      cost: 45,
      price: 75,
    }),
  );
  const { subletId } = await addSublet({
    orgId: org.id,
    userId: staff.id,
    jobId: job.id,
    supplierId: supplier.id,
    description: 'Four-wheel alignment',
    cost: 45,
    price: 75,
  });
  const line = await prisma.jobSublet.findUniqueOrThrow({
    where: { id: subletId },
    select: { partLine: { select: { unitPrice: true, unitCost: true, description: true } } },
  });
  check(
    'it is a line on the job at its charge and cost',
    [Number(line.partLine.unitPrice), Number(line.partLine.unitCost)],
    [75, 45],
  );
  await markSubletDone({ orgId: org.id, userId: staff.id, subletId });
  const subletBill = `${TAG}-SUB-1`;
  await billSublet({
    orgId: org.id,
    userId: staff.id,
    subletId,
    reference: subletBill,
    net: 50,
    tax: 10,
  });
  const billed = await prisma.jobSublet.findUniqueOrThrow({
    where: { id: subletId },
    select: {
      status: true,
      bill: { select: { total: true, orderId: true } },
      partLine: { select: { unitCost: true } },
    },
  });
  check(
    'the vendor bill is booked at the real cost',
    [billed.status, Number(billed.bill?.total), Number(billed.partLine.unitCost)],
    ['BILLED', 60, 50],
  );
  const subletCost = await prisma.journalLine.findFirst({
    where: {
      entry: { sourceType: 'JobSublet', sourceId: subletId },
      account: { code: ACCOUNT.COGS_SUBLET },
    },
    select: { debit: true },
  });
  check('to the cost of sublet work', Number(subletCost?.debit), 50);
  await refuses('a sublet is billed once', 'ALREADY_BILLED', () =>
    billSublet({
      orgId: org.id,
      userId: staff.id,
      subletId,
      reference: `${TAG}-SUB-2`,
      net: 50,
      tax: 10,
    }),
  );

  await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'COMPLETED' });
  const invoiceId = await issueInvoice({ orgId: org.id, userId: staff.id, jobId: job.id });
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { subtotal: true, lines: { select: { description: true } } },
  });
  check(
    'the customer is invoiced for it',
    [Number(invoice.subtotal), invoice.lines.some((l) => l.description.includes('alignment'))],
    [75, true],
  );
  await refuses('a closed job takes no sublet', 'JOB_CLOSED', () =>
    addSublet({
      orgId: org.id,
      userId: staff.id,
      jobId: job.id,
      supplierId: supplier.id,
      description: 'x',
      cost: 1,
      price: 1,
    }),
  );

  /* --- the books ----------------------------------------------------- */

  const lines = await postedLines(org.id, ALL_TIME);
  const balance = trialBalance(lines);
  check('the trial balance balances', balance.balanced, true);

  const cookie = await sessionFor(staff.id, org.id);
  await screenHas(
    'the order page sends parts back',
    `/purchasing/${orderId}`,
    cookie,
    'Send parts back',
  );
  await screenHas(
    'the returns page lists what went back',
    '/purchasing/returns',
    cookie,
    faulty.number,
  );
  await screenHas('the job page carries the sublet', `/jobs/${job.id}`, cookie, 'Sublet work');

  // One more sent back and left open, so the screen has a credit form to fill
  // in, and what it proposes can be read.
  //
  // It used to propose the held stock value -- what the shelf lost, at its
  // weighted average -- as the amount to put on the supplier's credit note.
  // Those are different figures whenever the shelf has been restocked at a
  // different price, which is always. The operator has the supplier's note in
  // front of them and types what it says, so nothing was ever posted wrong;
  // a proposal that is systematically wrong is still worse than none, because
  // it invites agreement. Phase 79.
  const open = await sendReturn({
    orgId: org.id,
    userId: staff.id,
    orderId,
    reason: 'DEFECTIVE',
    notes: TAG,
    lines: [{ orderLineId: lineId, quantity: 1 }],
  });

  const screen = await fetch(`${BASE}/purchasing/returns`, { headers: { cookie } });
  const markup = (await screen.text()).slice(0, 400_000);
  const row = markup.slice(markup.indexOf(open.number));
  const proposed = /name="net"[^>]*?value="([0-9.]+)"/.exec(row)?.[1];

  check(
    'the screen proposes what the supplier charged, not what the shelf lost',
    Number(proposed),
    10,
  );
  check('which is not the held value, on this shelf', Number(proposed) !== open.held, true);

  await forget(org.id);
  if (shelfBefore) {
    await prisma.stockLevel.update({
      where: { productId_warehouseId: { productId: product.id, warehouseId } },
      data: {
        onHand: shelfBefore.onHand,
        avgCost: shelfBefore.avgCost,
        reserved: shelfBefore.reserved,
      },
    });
  }
  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

async function sessionFor(userId: string, orgId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return `carnet_session=${token}`;
}

async function screenHas(label: string, path: string, cookie: string, text: string) {
  try {
    const response = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
    const body = await response.text();
    if (response.status !== 200) {
      failures += 1;
      console.error(`  FAIL   ${label}: ${path} answered ${response.status}`);
      return;
    }
    check(label, body.includes(text), true);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL   ${label}: no server at ${BASE} (${String(error)})`);
  }
}

async function forget(orgId: string) {
  const orders = await prisma.purchaseOrder.findMany({
    where: { orgId, notes: TAG },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  const returns = await prisma.supplierReturn.findMany({
    where: { orgId, orderId: { in: orderIds } },
    select: { id: true },
  });
  const bills = await prisma.supplierBill.findMany({
    where: { orgId, reference: { startsWith: TAG } },
    select: { id: true },
  });
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const sublets = await prisma.jobSublet.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true },
  });
  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true },
  });

  for (const source of [
    ...returns.map((r) => ({ sourceType: 'SupplierReturn', sourceId: r.id })),
    ...bills.map((b) => ({ sourceType: 'SupplierBill', sourceId: b.id })),
    ...sublets.map((s) => ({ sourceType: 'JobSublet', sourceId: s.id })),
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoices.map((i) => ({ sourceType: 'Invoice', sourceId: i.id })),
    ...orderIds.map((id) => ({ sourceType: 'PurchaseOrder', sourceId: id })),
  ])
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  const receipts = await prisma.goodsReceipt.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  for (const r of receipts)
    await prisma.journalEntry.deleteMany({
      where: { orgId, sourceType: 'GoodsReceipt', sourceId: r.id },
    });

  await prisma.stockMovement.deleteMany({
    where: {
      orgId,
      OR: [
        { referenceType: 'SupplierReturn', referenceId: { in: returns.map((r) => r.id) } },
        { referenceType: 'GoodsReceipt', referenceId: { in: receipts.map((r) => r.id) } },
        { referenceType: 'PurchaseOrder', referenceId: { in: orderIds } },
      ],
    },
  });
  await prisma.supplierCreditApplication.deleteMany({
    where: { billId: { in: bills.map((b) => b.id) } },
  });
  await prisma.supplierReturn.deleteMany({ where: { id: { in: returns.map((r) => r.id) } } });
  await prisma.jobSublet.deleteMany({ where: { id: { in: sublets.map((s) => s.id) } } });
  await prisma.supplierBill.deleteMany({ where: { id: { in: bills.map((b) => b.id) } } });
  await prisma.messageLog.deleteMany({
    where: { orgId, relatedId: { in: invoices.map((i) => i.id) } },
  });
  await prisma.invoice.deleteMany({ where: { id: { in: invoices.map((i) => i.id) } } });
  await prisma.outboxEvent.deleteMany({
    where: { orgId, type: { in: ['job.completed', 'invoice.issued'] }, processedAt: null },
  });
  await prisma.conversation.deleteMany({ where: { orgId, jobId: { in: jobIds } } });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.purchaseOrder.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.supplier.deleteMany({ where: { orgId, name: TAG } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
