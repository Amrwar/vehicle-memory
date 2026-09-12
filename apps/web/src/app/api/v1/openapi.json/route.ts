import { openApiDocument } from '@/lib/openapi';

/**
 * GET /api/v1/openapi.json
 *
 * The contract, served from the same registry the committed copy is built
 * from. No key needed: a document that describes how to authenticate is not
 * itself worth authenticating.
 */
export function GET() {
  return Response.json(openApiDocument, {
    headers: { 'cache-control': 'public, max-age=3600' },
  });
}
