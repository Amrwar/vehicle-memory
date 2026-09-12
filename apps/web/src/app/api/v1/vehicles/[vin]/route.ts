import { normaliseVin, summariseNetwork } from '@carnet/core';
import { prisma } from '@carnet/db';

import { apiRefusal, authenticateApiKey } from '@/lib/api-keys';
import { documentsFor } from '@/lib/documents';
import { networkHistory } from '@/lib/network';

/**
 * GET /api/v1/vehicles/{vin}
 *
 * A vehicle's passport as the calling workshop is entitled to read it: the
 * identity, the summary of who has recorded what, and every entry with
 * another workshop's commercial detail withheld. Exactly what a signed-in
 * owner of the same organisation sees on the vehicle's page, and nothing more.
 * A vehicle the organisation has no entitlement to is not found rather than
 * forbidden, so the endpoint does not confirm which VINs exist.
 */
export async function GET(request: Request, context: { params: Promise<{ vin: string }> }) {
  try {
    const { orgId } = await authenticateApiKey(request);
    const { vin } = await context.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { vin: normaliseVin(vin) },
      select: {
        id: true,
        vin: true,
        registration: true,
        make: true,
        model: true,
        year: true,
        lastOdometerKm: true,
        lastOdometerAt: true,
        eventCount: true,
        chainHead: true,
      },
    });

    const history = vehicle ? await networkHistory(orgId, vehicle.id) : null;

    if (!vehicle || !history) {
      return Response.json(
        { error: 'NOT_FOUND', message: 'No such vehicle on your books.' },
        { status: 404 },
      );
    }

    const summary = summariseNetwork(history, orgId);
    const documents = await documentsFor(vehicle.id, { orgId, userId: 'api', ownsVehicle: false });

    return Response.json({
      vehicle: {
        vin: vehicle.vin,
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        lastOdometerKm: vehicle.lastOdometerKm,
        lastOdometerAt: vehicle.lastOdometerAt,
        entries: vehicle.eventCount,
        chainHead: vehicle.chainHead,
      },
      history: {
        recordedHere: summary.ownEntries,
        recordedElsewhere: summary.otherEntries,
        otherWorkshops: summary.otherWorkshops,
        statement: summary.statement,
      },
      // The paperwork, with links that expire in an hour. Readable by any
      // workshop entitled to the vehicle: it is the car's, like the events.
      documents: documents.map((document) => ({
        id: document.id,
        kind: document.kind,
        title: document.title,
        reference: document.reference,
        issuedAt: document.issuedAt,
        expiresAt: document.expiresAt,
        expiry: document.expiry,
        mimeType: document.mimeType,
        addedBy: document.addedBy,
        url: document.url,
      })),
      events: history.map((event) => ({
        id: event.id,
        type: event.type,
        title: event.title,
        summary: event.summary,
        occurredAt: event.occurredAt,
        odometerKm: event.odometerKm,
        verification: event.verification,
        recordedBy: event.recordedByOrgName,
        recordedHere: event.recordedByOrgId === orgId,
        detail: event.payload,
      })),
    });
  } catch (error) {
    return apiRefusal(error);
  }
}
