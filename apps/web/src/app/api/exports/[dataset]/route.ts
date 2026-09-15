import { exportDataset } from '@/lib/exports';
import { requireSession } from '@/lib/guard';

/**
 * GET /api/exports/<dataset>
 *
 * Every dataset a workshop owns, whole. Reading needs only the settings
 * permission a read-only or cancelled workshop still has: leaving with
 * everything is a promise the terms make.
 */
export async function GET(_request: Request, context: { params: Promise<{ dataset: string }> }) {
  const { orgId } = await requireSession('settings:read');
  const { dataset } = await context.params;
  const file = await exportDataset(orgId, dataset);
  if (!file) return new Response('No such dataset.', { status: 404 });
  return new Response(file.body, {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
