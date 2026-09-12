/**
 * The buttons that led nowhere.
 *
 *   npx tsx infra/scripts/verify-records.ts
 *
 * Four controls sat on the product for months with nothing behind them: "New
 * customer", "New part", "New order" and "Send estimate". Each looked like a
 * feature and each was a link to an error page or a button that did nothing.
 * The crawler that should have caught them read a 200 and moved on, because
 * the framework streams the not-found screen inside a payload the status code
 * knows nothing about.
 *
 * This exercises the write paths that now answer them, and the one property
 * every message-sending path has to hold: the row is not left waiting for a
 * sweep that runs once a day when somebody is standing at the counter.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { CatalogueError, CustomerError, QuoteError } from '@carnet/core';
import { prisma } from '@carnet/db';

import { createProduct, createPurchaseOrder } from '../../apps/web/src/lib/catalogue';
import { createCustomer, possibleDuplicate } from '../../apps/web/src/lib/customers';
import { sendEstimate } from '../../apps/web/src/lib/estimates';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function refuses(
  label: string,
  kind: new (...args: never[]) => Error,
  code: string,
  run: () => Promise<unknown>,
) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    const actual = (error as { code?: string }).code;
    if (error instanceof kind && actual === code) {
      console.info(`  ok     ${label}: ${code}`);
    } else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

const TAG = 'vfy-records';
const EMAIL = `${TAG}@example.test`;
const PART = `VFY-REC-001`;

async function forget(orgId: string) {
  await prisma.messageLog.deleteMany({
    where: { orgId, relatedType: 'Estimate', subject: { contains: 'Probe' } },
  });
  await prisma.messageLog.deleteMany({ where: { toAddress: EMAIL } });
  await prisma.estimateShare.deleteMany({ where: { estimate: { notes: TAG } } });
  await prisma.estimate.deleteMany({ where: { orgId, notes: TAG } });
  await prisma.purchaseOrder.deleteMany({ where: { orgId, notes: TAG } });
  await prisma.stockLevel.deleteMany({
    where: { product: { orgId, partNumber: { startsWith: 'VFY' } } },
  });
  await prisma.product.deleteMany({ where: { orgId, partNumber: { startsWith: 'VFY' } } });
  await prisma.customer.deleteMany({ where: { orgId, email: EMAIL } });
  await prisma.customer.deleteMany({ where: { orgId, notes: TAG } });
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  await forget(org.id);

  console.info('\nA new customer');

  await refuses('nobody with no name', CustomerError, 'NO_NAME', () =>
    createCustomer({
      orgId: org.id,
      userId: staff.id,
      details: { kind: 'INDIVIDUAL', email: EMAIL },
    }),
  );

  // A record with no way to reach somebody cannot be sent a quote or told the
  // car is ready. It is a note, not a customer.
  await refuses('nobody with no way to reach them', CustomerError, 'NO_CONTACT', () =>
    createCustomer({
      orgId: org.id,
      userId: staff.id,
      details: { kind: 'INDIVIDUAL', firstName: 'Probe', lastName: 'Person' },
    }),
  );

  const customerId = await createCustomer({
    orgId: org.id,
    userId: staff.id,
    details: {
      kind: 'INDIVIDUAL',
      firstName: ' Probe ',
      lastName: 'Person',
      email: EMAIL.toUpperCase(),
      mobile: '07700 900 123',
      postcode: 'sk4 2hl',
      notes: TAG,
    },
  });

  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { displayName: true, email: true, postcode: true, marketingEmailConsent: true },
  });

  check('the name is assembled once, for the invoice', customer.displayName, 'Probe Person');
  check('the address is stored in lower case', customer.email, EMAIL);
  check('and the postcode in upper', customer.postcode, 'SK4 2HL');
  check('marketing consent is off unless somebody said so', customer.marketingEmailConsent, false);

  // Two customers called J Smith are ordinary. Two sharing a mobile number are
  // one person entered twice, and that is how a history ends up in halves.
  await refuses('the same person a second time', CustomerError, 'DUPLICATE', () =>
    createCustomer({
      orgId: org.id,
      userId: staff.id,
      details: { kind: 'INDIVIDUAL', firstName: 'P', lastName: 'Person', mobile: '07700900123' },
    }),
  );

  const match = await possibleDuplicate(org.id, { mobile: '07700900123' });
  check('the match names who they already are', match?.displayName, 'Probe Person');

  const second = await createCustomer({
    orgId: org.id,
    userId: staff.id,
    details: { kind: 'COMPANY', companyName: 'Probe Fleet Ltd', mobile: '07700900123', notes: TAG },
    allowDuplicate: true,
  });
  check('but somebody who has checked can go ahead', Boolean(second), true);

  console.info('\nA new part');

  await refuses('a part with no number', CatalogueError, 'NO_PART_NUMBER', () =>
    createProduct({
      orgId: org.id,
      userId: staff.id,
      details: { partNumber: '  ', name: 'Thing', costPrice: 1, sellPrice: 2 },
    }),
  );

  await refuses('a price below zero', CatalogueError, 'BAD_PRICE', () =>
    createProduct({
      orgId: org.id,
      userId: staff.id,
      details: { partNumber: PART, name: 'Thing', costPrice: -1, sellPrice: 2 },
    }),
  );

  const productId = await createProduct({
    orgId: org.id,
    userId: staff.id,
    details: {
      partNumber: ' vfy-rec-001 ',
      name: 'Probe brake pads',
      costPrice: 18.5,
      sellPrice: 42,
      reorderPoint: 2,
      reorderQty: 4,
    },
  });

  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { partNumber: true, stockLevels: { select: { onHand: true, avgCost: true } } },
  });

  check('the part number is normalised', product.partNumber, PART);
  check('a stocked part starts with a stock row', product.stockLevels.length, 1);
  check('at zero on hand', Number(product.stockLevels[0]?.onHand), 0);
  check('carrying the opening cost', Number(product.stockLevels[0]?.avgCost), 18.5);

  // Case and spacing are how people type; hyphens are part of the number, so
  // "VFY REC 001" is deliberately a different part. Somebody typing a lower
  // case one with a space on the end is the same part.
  await refuses('the same part number again, however typed', CatalogueError, 'DUPLICATE_PART', () =>
    createProduct({
      orgId: org.id,
      userId: staff.id,
      details: { partNumber: 'vfy-rec-001 ', name: 'Again', costPrice: 1, sellPrice: 2 },
    }),
  );

  const unstocked = await createProduct({
    orgId: org.id,
    userId: staff.id,
    details: {
      partNumber: 'VFY-REC-002',
      name: 'Fitted from the van',
      costPrice: 5,
      sellPrice: 9,
      isStocked: false,
    },
  });
  const noRow = await prisma.stockLevel.count({ where: { productId: unstocked } });
  check('a part never held has no stock row to lie about', noRow, 0);

  console.info('\nA new purchase order');

  const supplier = await prisma.supplier.findFirstOrThrow({
    where: { orgId: org.id, isActive: true },
    select: { id: true },
  });

  await refuses('an order with nothing on it', CatalogueError, 'NO_LINES', () =>
    createPurchaseOrder({
      orgId: org.id,
      userId: staff.id,
      supplierId: supplier.id,
      lines: [],
      notes: TAG,
    }),
  );

  await refuses('a line with no quantity', CatalogueError, 'BAD_LINE', () =>
    createPurchaseOrder({
      orgId: org.id,
      userId: staff.id,
      supplierId: supplier.id,
      notes: TAG,
      lines: [{ description: 'Wiper', quantity: 0, unitCost: 4 }],
    }),
  );

  const before = await prisma.documentSequence.findUnique({
    where: { orgId_kind: { orgId: org.id, kind: 'PURCHASE_ORDER' } },
    select: { next: true },
  });

  const orderId = await createPurchaseOrder({
    orgId: org.id,
    userId: staff.id,
    supplierId: supplier.id,
    notes: TAG,
    lines: [
      { productId, description: '', quantity: 4, unitCost: 18.5 },
      { description: 'Wiper blade set', quantity: 2, unitCost: 6.25 },
      { description: '   ', quantity: 0, unitCost: 0 },
    ],
  });

  const order = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      number: true,
      status: true,
      subtotal: true,
      lines: { orderBy: { sortOrder: 'asc' } },
    },
  });

  check('it is a draft, for somebody to approve', order.status, 'DRAFT');
  check('blank lines are dropped', order.lines.length, 2);
  check(
    'a catalogue line takes its name from the catalogue',
    order.lines[0]?.description,
    `${PART} Probe brake pads`,
  );
  check('the subtotal is the lines', Number(order.subtotal), 4 * 18.5 + 2 * 6.25);
  check('and it has a number', /^PO-\d+$/.test(order.number), true);

  const after = await prisma.documentSequence.findUniqueOrThrow({
    where: { orgId_kind: { orgId: org.id, kind: 'PURCHASE_ORDER' } },
    select: { next: true },
  });
  check('the sequence moved on by one', after.next - (before?.next ?? 1), 1);

  console.info('\nSending a quote');

  // A job whose customer can be reached, with a fresh draft quote on it.
  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customer: { email: { not: null } } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      customer: { select: { email: true } },
      estimates: { select: { version: true }, orderBy: { version: 'desc' }, take: 1 },
    },
  });

  const version = (job.estimates[0]?.version ?? 0) + 1;

  const empty = await prisma.estimate.create({
    data: {
      orgId: org.id,
      jobId: job.id,
      version,
      status: 'DRAFT',
      notes: TAG,
      createdByUserId: staff.id,
    },
    select: { id: true },
  });

  await refuses('a quote with nothing on it', QuoteError, 'EMPTY', () =>
    sendEstimate({ orgId: org.id, userId: staff.id, estimateId: empty.id }),
  );

  await prisma.estimateLine.create({
    data: {
      estimateId: empty.id,
      kind: 'LABOUR',
      description: 'Probe diagnosis',
      quantity: 1,
      unitPrice: 0,
      sortOrder: 0,
    },
  });

  await refuses('a quote that adds up to nothing', QuoteError, 'ZERO', () =>
    sendEstimate({ orgId: org.id, userId: staff.id, estimateId: empty.id }),
  );

  await prisma.estimate.update({
    where: { id: empty.id },
    data: { subtotal: 120, taxTotal: 24, total: 144 },
  });

  const shareId = await sendEstimate({ orgId: org.id, userId: staff.id, estimateId: empty.id });

  const share = await prisma.estimateShare.findUniqueOrThrow({
    where: { id: shareId },
    select: { tokenHash: true, sentTo: true, channel: true, expiresAt: true },
  });

  check('a link was issued to the customer', share.sentTo, job.customer.email);
  check('by email, because they have one', share.channel, 'EMAIL');
  check('only its fingerprint is stored', share.tokenHash.length, 64);
  check('and it expires', share.expiresAt > new Date(), true);

  const sent = await prisma.estimate.findUniqueOrThrow({
    where: { id: empty.id },
    select: { status: true, sentAt: true, job: { select: { status: true } } },
  });

  check('the quote is marked sent', sent.status, 'SENT');
  check('at a time', sent.sentAt !== null, true);
  check('and the job is waiting on the customer', sent.job.status, 'AWAITING_APPROVAL');

  const message = await prisma.messageLog.findFirstOrThrow({
    where: { orgId: org.id, relatedType: 'Estimate', relatedId: empty.id },
    select: { toAddress: true, body: true, status: true, sentAt: true },
  });

  check('the message went to the customer, not to an id', message.toAddress, job.customer.email);
  check(
    'it carries a link the fingerprint does not reveal',
    message.body.includes(share.tokenHash),
    false,
  );
  check('and it carries a link at all', message.body.includes('/e/'), true);

  // The sweep that drains the queue runs once a day on this hosting plan. A
  // message somebody is waiting on cannot sit in it, so it is pushed straight
  // out. With the console transport that means SENT within the same call.
  check('it did not wait for the daily sweep', message.status !== 'QUEUED', true);

  await refuses('sending the same quote twice', QuoteError, 'NOT_DRAFT', () =>
    sendEstimate({ orgId: org.id, userId: staff.id, estimateId: empty.id }),
  );

  console.info('\nClearing up');

  // The job was moved on by the send; put it back so the seed is as it was.
  await prisma.job.update({ where: { id: job.id }, data: { status: job.status } });
  await prisma.estimateLine.deleteMany({ where: { estimateId: empty.id } });
  await forget(org.id);

  const left = await prisma.product.count({
    where: { orgId: org.id, partNumber: { startsWith: 'VFY-REC' } },
  });
  check('the probe left nothing behind', left, 0);

  console.info(
    failures === 0 ? '\nEvery button now leads somewhere.' : `\n${failures} check(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
