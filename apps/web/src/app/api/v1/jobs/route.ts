import { sinceFrom } from '@carnet/core';
import { prisma } from '@carnet/db';

import { apiRefusal, authenticateApiKey } from '@/lib/api-keys';

/**
 * GET /api/v1/jobs?since=2026-09-01&status=COMPLETED
 *
 * The organisation's own jobs, newest first, for whatever the workshop already
 * runs to sync from. Bounded to a year and to two hundred rows: an
 * integration that wants everything asks in pages by moving `since`.
 */
export async function GET(request: Request) {
  try {
    const { orgId } = await authenticateApiKey(request);
    const url = new URL(request.url);
    const since = sinceFrom(url.searchParams.get('since'));
    const status = url.searchParams.get('status');

    const jobs = await prisma.job.findMany({
      where: {
        orgId,
        updatedAt: { gte: since },
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        number: true,
        status: true,
        shortDescription: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        invoicedAt: true,
        odometerInKm: true,
        customer: { select: { id: true, displayName: true } },
        vehicle: { select: { vin: true, registration: true, make: true, model: true } },
        invoices: {
          where: { status: { not: 'VOID' } },
          select: { number: true, total: true, status: true },
        },
      },
    });

    return Response.json({
      since,
      count: jobs.length,
      jobs: jobs.map((job) => ({
        id: job.id,
        number: job.number,
        status: job.status,
        description: job.shortDescription,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        invoicedAt: job.invoicedAt,
        odometerKm: job.odometerInKm,
        customer: job.customer,
        vehicle: job.vehicle,
        invoices: job.invoices.map((invoice) => ({
          number: invoice.number,
          total: Number(invoice.total),
          status: invoice.status,
        })),
      })),
    });
  } catch (error) {
    return apiRefusal(error);
  }
}
