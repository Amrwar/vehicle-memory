import { priceWarning } from '@carnet/core';
import { prisma } from '@carnet/db';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { CatalogueError, createProduct } from '@/lib/catalogue';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'New part' };
export const dynamic = 'force-dynamic';

/**
 * Adding a part to the catalogue.
 *
 * The parts list has offered this button since Phase 2 and nothing answered
 * it, so the only parts in any workshop's catalogue were the ones the seed put
 * there. Everything a job consumed had to be one of those or a free-text line
 * with no stock behind it.
 *
 * Two things are required: the number on the box and a name a customer would
 * understand. Prices are asked for and warned about rather than demanded,
 * because a part is often added while the supplier's invoice is still in the
 * van.
 */

function numberFrom(formData: FormData, key: string, fallback = 0): number {
  const raw = String(formData.get(key) ?? '').replace(/[£,\s]/g, '');
  if (raw === '') return fallback;
  return Number(raw);
}

async function save(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');

  const details = {
    partNumber: String(formData.get('partNumber') ?? ''),
    name: String(formData.get('name') ?? ''),
    brand: String(formData.get('brand') ?? ''),
    unit: String(formData.get('unit') ?? 'each'),
    costPrice: numberFrom(formData, 'costPrice'),
    sellPrice: numberFrom(formData, 'sellPrice'),
    reorderPoint: numberFrom(formData, 'reorderPoint'),
    reorderQty: numberFrom(formData, 'reorderQty'),
    barcode: String(formData.get('barcode') ?? ''),
    categoryId: String(formData.get('categoryId') ?? '') || null,
    // A checkbox that is ticked sends "on" and one that is not sends nothing
    // at all, so absence is the answer rather than a missing field.
    isStocked: formData.get('isStocked') === 'on',
  };

  let id: string;

  try {
    id = await createProduct({ orgId, userId: user.userId, details });
  } catch (error) {
    if (!(error instanceof CatalogueError)) throw error;

    const params = new URLSearchParams({ problem: error.message });
    for (const key of [
      'partNumber',
      'name',
      'brand',
      'unit',
      'costPrice',
      'sellPrice',
      'reorderPoint',
      'reorderQty',
      'barcode',
      'categoryId',
    ] as const) {
      const value = String(formData.get(key) ?? '');
      if (value) params.set(key, value);
    }

    redirect(`/parts/new?${params.toString()}`);
  }

  redirect(`/parts/${id}`);
}

export default async function NewPartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await requireSession('inventory:write');
  const params = await searchParams;

  const categories = await prisma.productCategory.findMany({
    where: { orgId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  // Said as they type, on the way back from a refused save, so the same
  // sentence they would see at month end is in front of them now.
  const warning =
    params.costPrice || params.sellPrice
      ? priceWarning({
          costPrice: Number(params.costPrice ?? 0) || 0,
          sellPrice: Number(params.sellPrice ?? 0) || 0,
        })
      : null;

  return (
    <>
      <BackLink href="/parts">All parts</BackLink>

      <PageHeader
        eyebrow="Inventory"
        title="New part"
        description="The number on the box and a name a customer would understand."
      />

      {params.problem ? (
        <Alert tone="danger" className="mb-5">
          {params.problem}
        </Alert>
      ) : null}

      {warning ? (
        <Alert tone="warning" className="mb-5">
          {warning}
        </Alert>
      ) : null}

      <form action={save} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid gap-5">
          <Card>
            <CardHeader title="What it is" />
            <CardBody className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
                <Field label="Part number" hint="As printed by the supplier">
                  <Input
                    name="partNumber"
                    defaultValue={params.partNumber ?? ''}
                    required
                    autoFocus
                    spellCheck={false}
                    className="font-mono uppercase"
                    placeholder="BP-1042"
                  />
                </Field>
                <Field label="Name" hint="Goes on the invoice">
                  <Input
                    name="name"
                    defaultValue={params.name ?? ''}
                    required
                    placeholder="Front brake pads, ceramic"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Brand" hint="Optional">
                  <Input name="brand" defaultValue={params.brand ?? ''} placeholder="Brembo" />
                </Field>
                <Field label="Sold by">
                  <Select name="unit" defaultValue={params.unit ?? 'each'}>
                    <option value="each">Each</option>
                    <option value="pair">Pair</option>
                    <option value="set">Set</option>
                    <option value="litre">Litre</option>
                    <option value="metre">Metre</option>
                    <option value="kg">Kilogram</option>
                  </Select>
                </Field>
                <Field label="Category" hint="Optional">
                  <Select name="categoryId" defaultValue={params.categoryId ?? ''}>
                    <option value="">None</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Barcode" hint="Optional. Scanned at the counter.">
                <Input
                  name="barcode"
                  defaultValue={params.barcode ?? ''}
                  spellCheck={false}
                  className="font-mono"
                />
              </Field>
            </CardBody>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader title="Prices" description="Before VAT" />
            <CardBody className="grid gap-4">
              <Field label="Cost" hint="What you pay. Sets the opening average cost.">
                <Input
                  name="costPrice"
                  inputMode="decimal"
                  defaultValue={params.costPrice ?? ''}
                  placeholder="0.00"
                  className="tabular-nums"
                />
              </Field>
              <Field label="Sell price" hint="What the customer pays">
                <Input
                  name="sellPrice"
                  inputMode="decimal"
                  defaultValue={params.sellPrice ?? ''}
                  placeholder="0.00"
                  className="tabular-nums"
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Stock" description="Leave both at zero to be told nothing" />
            <CardBody className="grid gap-4">
              <label className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                <input
                  type="checkbox"
                  name="isStocked"
                  defaultChecked
                  className="mt-0.5 h-4 w-4 shrink-0 accent-(--brand-solid)"
                />
                <span>
                  Held in stock. Untick for something fitted straight off the supplier&rsquo;s van,
                  which then never shows as out.
                </span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Reorder at" hint="Warn when on hand falls to this">
                  <Input
                    name="reorderPoint"
                    inputMode="numeric"
                    defaultValue={params.reorderPoint ?? ''}
                    placeholder="0"
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Reorder quantity" hint="How many to suggest">
                  <Input
                    name="reorderQty"
                    inputMode="numeric"
                    defaultValue={params.reorderQty ?? ''}
                    placeholder="0"
                    className="tabular-nums"
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          <Button type="submit" variant="primary" size="lg" block>
            Add the part
          </Button>
        </div>
      </form>
    </>
  );
}
