import {
  CUSTOMER_PRINT_KINDS,
  can,
  keyState,
  labelSheets,
  PRINT_PERMISSION,
  type PrintKind,
  readingLocaleFor,
  type Region,
  safeLocale,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { currentUser } from './auth';
import { siteUrl } from './credentials';
import { currentLanguage } from './i18n';
import { bandsFor } from './tax';

/**
 * Paper. Phase 42.
 *
 * Who may read a printed document, and what goes on it. A member of the
 * workshop reads what their role allows; a customer reads the invoices,
 * quotes and inspection reports for their own cars, and nothing else. A
 * document another workshop wrote is not found, rather than refused, so its
 * existence is not confirmed.
 */

export interface Letterhead {
  name: string;
  legalName: string | null;
  taxNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string[];
}

export interface Reader {
  audience: 'workshop' | 'customer';
  orgId: string;
  region: Region;
  letterhead: Letterhead;
}

interface Owner {
  orgId: string;
  /** Portal logins of the customers this document is addressed to. */
  customerLogins: (string | null)[];
}

async function ownerOf(kind: PrintKind, id: string): Promise<Owner | null> {
  switch (kind) {
    case 'invoice': {
      const row = await prisma.invoice.findUnique({
        where: { id },
        select: { orgId: true, customer: { select: { portalUserId: true } } },
      });
      return row && { orgId: row.orgId, customerLogins: [row.customer.portalUserId] };
    }
    case 'estimate': {
      const row = await prisma.estimate.findUnique({
        where: { id },
        select: {
          orgId: true,
          job: {
            select: {
              customer: { select: { portalUserId: true } },
              billTo: { select: { portalUserId: true } },
            },
          },
        },
      });
      return (
        row && {
          orgId: row.orgId,
          customerLogins: [row.job.customer.portalUserId, row.job.billTo?.portalUserId ?? null],
        }
      );
    }
    case 'inspection': {
      const row = await prisma.inspection.findUnique({
        where: { id },
        select: { job: { select: { orgId: true, customer: { select: { portalUserId: true } } } } },
      });
      return row && { orgId: row.job.orgId, customerLogins: [row.job.customer.portalUserId] };
    }
    case 'work-order':
    case 'key-tag': {
      const row = await prisma.job.findUnique({ where: { id }, select: { orgId: true } });
      return row && { orgId: row.orgId, customerLogins: [] };
    }
    case 'counter-sale': {
      const row = await prisma.counterSale.findUnique({ where: { id }, select: { orgId: true } });
      return row && { orgId: row.orgId, customerLogins: [] };
    }
    case 'labels':
      return null;
  }
}

async function letterheadFor(orgId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      name: true,
      legalName: true,
      taxNumber: true,
      email: true,
      phone: true,
      website: true,
      country: true,
      baseCurrency: true,
      locale: true,
      timezone: true,
      locations: {
        where: { isActive: true },
        orderBy: { isDefault: 'desc' },
        take: 1,
        select: {
          addressLine1: true,
          addressLine2: true,
          locality: true,
          postcode: true,
          phone: true,
        },
      },
    },
  });
  const site = org.locations[0];
  const language = await currentLanguage();
  const region: Region = {
    country: org.country,
    currency: org.baseCurrency,
    locale: readingLocaleFor(language, {
      locale: safeLocale(org.locale, 'en-GB'),
      country: org.country,
    }),
    timezone: org.timezone,
  };
  return {
    region,
    letterhead: {
      name: org.name,
      legalName: org.legalName,
      taxNumber: org.taxNumber,
      email: org.email,
      phone: org.phone ?? site?.phone ?? null,
      website: org.website,
      address: [site?.addressLine1, site?.addressLine2, site?.locality, site?.postcode].filter(
        (part): part is string => Boolean(part),
      ),
    },
  };
}

/**
 * The reader of a document, or null when this person may not read it. Labels
 * are the workshop's own and are read against the signed-in workshop.
 */
export async function readerFor(kind: PrintKind, id: string): Promise<Reader | null> {
  const user = await currentUser();
  if (!user) return null;

  if (kind === 'labels') {
    if (!user.orgId || !can(user.role, PRINT_PERMISSION.labels)) return null;
    return { audience: 'workshop', orgId: user.orgId, ...(await letterheadFor(user.orgId)) };
  }

  const owner = await ownerOf(kind, id);
  if (!owner) return null;

  if (user.orgId === owner.orgId && can(user.role, PRINT_PERMISSION[kind])) {
    return { audience: 'workshop', orgId: owner.orgId, ...(await letterheadFor(owner.orgId)) };
  }
  // A technician reads the jobs they are on, so they print those and no others.
  if (
    user.orgId === owner.orgId &&
    (kind === 'work-order' || kind === 'key-tag') &&
    can(user.role, 'job:read:assigned')
  ) {
    const assigned = await prisma.jobTechnician.count({
      where: { jobId: id, userId: user.userId },
    });
    if (assigned > 0) {
      return { audience: 'workshop', orgId: owner.orgId, ...(await letterheadFor(owner.orgId)) };
    }
  }
  if (CUSTOMER_PRINT_KINDS.includes(kind) && owner.customerLogins.includes(user.userId)) {
    return { audience: 'customer', orgId: owner.orgId, ...(await letterheadFor(owner.orgId)) };
  }
  return null;
}

/* ------------------------------------------------------------------------- */
/* What goes on each                                                          */
/* ------------------------------------------------------------------------- */

export async function invoiceDocument(orgId: string, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, orgId },
    include: {
      customer: {
        select: {
          displayName: true,
          email: true,
          addressLine1: true,
          locality: true,
          postcode: true,
        },
      },
      job: {
        select: {
          number: true,
          vehicle: { select: { make: true, model: true, registration: true, vin: true } },
        },
      },
      lines: { orderBy: { sortOrder: 'asc' } },
      payments: { select: { amount: true } },
      creditNotes: { select: { amount: true } },
    },
  });
  if (!invoice) return null;
  const paid = invoice.payments.reduce((total, p) => total + Number(p.amount), 0);
  const credited = invoice.creditNotes.reduce((total, n) => total + Number(n.amount), 0);
  return {
    invoice,
    bands: await bandsFor('INVOICE', invoice.id),
    outstanding: Math.max(0, Number(invoice.total) - paid - credited),
    link: `${siteUrl()}/portal/invoices`,
  };
}

export async function estimateDocument(orgId: string, id: string) {
  const estimate = await prisma.estimate.findFirst({
    where: { id, orgId },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      job: {
        select: {
          number: true,
          shortDescription: true,
          customer: { select: { displayName: true } },
          vehicle: { select: { make: true, model: true, registration: true, vin: true } },
        },
      },
    },
  });
  if (!estimate) return null;
  return { estimate, link: `${siteUrl()}/portal/estimates/${estimate.id}` };
}

export async function inspectionDocument(orgId: string, id: string) {
  const inspection = await prisma.inspection.findFirst({
    where: { id, job: { orgId } },
    include: {
      performedBy: { select: { name: true } },
      results: { orderBy: [{ sortOrder: 'asc' }] },
      job: {
        select: {
          number: true,
          odometerInKm: true,
          customer: { select: { displayName: true } },
          vehicle: {
            select: { id: true, make: true, model: true, registration: true, vin: true },
          },
        },
      },
    },
  });
  if (!inspection) return null;
  return { inspection, link: `${siteUrl()}/portal/vehicles/${inspection.job.vehicle.id}` };
}

export async function workOrderDocument(orgId: string, id: string) {
  const job = await prisma.job.findFirst({
    where: { id, orgId },
    include: {
      customer: { select: { displayName: true, mobile: true } },
      vehicle: {
        select: { make: true, model: true, year: true, registration: true, vin: true },
      },
      bay: { select: { name: true } },
      technicians: { include: { user: { select: { name: true } } } },
      jobTypes: { include: { jobType: { select: { name: true } } } },
      tasks: { orderBy: { sortOrder: 'asc' } },
      labourLines: { orderBy: { sortOrder: 'asc' } },
      partLines: { orderBy: { sortOrder: 'asc' } },
      checks: { where: { kind: 'IN' }, orderBy: { createdAt: 'asc' }, take: 1 },
      inspections: {
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 1,
        select: {
          results: {
            where: { severity: { in: ['CRITICAL', 'ADVISORY'] } },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, itemName: true, severity: true, note: true },
          },
        },
      },
      keyEvents: {
        orderBy: { at: 'asc' },
        select: { id: true, action: true, hook: true, at: true, by: { select: { name: true } } },
      },
    },
  });
  if (!job) return null;
  const keys = keyState(
    job.keyEvents.map((event) => ({
      id: event.id,
      action: event.action,
      hook: event.hook,
      byName: event.by?.name ?? null,
      at: event.at,
    })),
  );
  return { job, keys, link: `${siteUrl()}/jobs/${job.id}` };
}

export async function counterSaleDocument(orgId: string, id: string) {
  const sale = await prisma.counterSale.findFirst({
    where: { id, orgId },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      tenders: true,
      soldBy: { select: { name: true } },
      customer: { select: { displayName: true } },
    },
  });
  if (!sale) return null;
  return { sale, bands: await bandsFor('COUNTER_SALE', sale.id) };
}

/**
 * Parts to label, from "id:copies,id:copies". Only this workshop's parts;
 * an id from elsewhere is simply not printed.
 */
export async function labelsDocument(orgId: string, spec: string) {
  const requests = spec
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id = '', copies = '1'] = entry.split(':');
      return { id, copies: Number(copies) };
    });
  const products = await prisma.product.findMany({
    where: { orgId, id: { in: requests.map((request) => request.id) } },
    select: {
      id: true,
      partNumber: true,
      name: true,
      sellPrice: true,
      stockLevels: { take: 1, select: { binLocation: true } },
    },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const sheets = labelSheets(requests.filter((request) => byId.has(request.id)));
  return {
    sheets: sheets.map((sheet) => sheet.map((productId) => byId.get(productId)!)),
    link: (productId: string) => `${siteUrl()}/parts/${productId}`,
  };
}
