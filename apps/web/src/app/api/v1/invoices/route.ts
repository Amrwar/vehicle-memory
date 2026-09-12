import { sinceFrom } from '@carnet/core';
import { prisma } from '@carnet/db';

import { apiRefusal, authenticateApiKey } from '@/lib/api-keys';

/**
 * GET /api/v1/invoices?since=2026-09-01
 *
 * The organisation's invoices with their lines and payments, for accounting
 * software to pull. Amounts are decimal strings, because a currency amount
 * that has been through a floating-point number is not the amount any more.
 */
export async function GET(request: Request) {
  try {
    const { orgId } = await authenticateApiKey(request);
    const url = new URL(request.url);
    const since = sinceFrom(url.searchParams.get('since'));

    const invoices = await prisma.invoice.findMany({
      where: { orgId, status: { not: 'VOID' }, updatedAt: { gte: since } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        number: true,
        status: true,
        currency: true,
        subtotal: true,
        taxTotal: true,
        total: true,
        amountPaid: true,
        issuedAt: true,
        dueAt: true,
        updatedAt: true,
        customer: { select: { id: true, displayName: true, email: true } },
        job: { select: { number: true, vehicle: { select: { vin: true, registration: true } } } },
        lines: {
          orderBy: { sortOrder: 'asc' },
          select: {
            kind: true,
            description: true,
            quantity: true,
            unitPrice: true,
            taxAmount: true,
            lineTotal: true,
          },
        },
        payments: { select: { amount: true, method: true, reference: true, receivedAt: true } },
      },
    });

    return Response.json({
      since,
      count: invoices.length,
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        currency: invoice.currency,
        subtotal: invoice.subtotal.toString(),
        taxTotal: invoice.taxTotal.toString(),
        total: invoice.total.toString(),
        amountPaid: invoice.amountPaid.toString(),
        issuedAt: invoice.issuedAt,
        dueAt: invoice.dueAt,
        updatedAt: invoice.updatedAt,
        customer: invoice.customer,
        job: invoice.job ? { number: invoice.job.number, vehicle: invoice.job.vehicle } : null,
        lines: invoice.lines.map((line) => ({
          kind: line.kind,
          description: line.description,
          quantity: line.quantity.toString(),
          unitPrice: line.unitPrice.toString(),
          tax: line.taxAmount.toString(),
          total: line.lineTotal.toString(),
        })),
        payments: invoice.payments.map((payment) => ({
          amount: payment.amount.toString(),
          method: payment.method,
          reference: payment.reference,
          receivedAt: payment.receivedAt,
        })),
      })),
    });
  } catch (error) {
    return apiRefusal(error);
  }
}
