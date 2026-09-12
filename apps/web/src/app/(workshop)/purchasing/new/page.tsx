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
  Textarea,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { CatalogueError, createPurchaseOrder, orderFormOptions } from '@/lib/catalogue';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'New purchase order' };
export const dynamic = 'force-dynamic';

/** How many lines the form offers. Enough for a real order, few enough to scroll. */
const LINES = 8;

/**
 * Raising an order by hand.
 *
 * Orders have arrived two ways since Phase 2: from a purchase request that
 * somebody approved, and from the reorder suggestions. Neither covers the
 * commonest case in a small workshop, which is somebody ringing the factor
 * for a part and wanting the order written down before the van arrives.
 *
 * The result is a draft. Approval is a separate act on the order itself, so
 * writing the order down and committing the workshop to paying for it remain
 * two decisions, possibly by two people.
 */

function numberFrom(value: FormDataEntryValue | null, fallback = 0): number {
  const raw = String(value ?? '').replace(/[£,\s]/g, '');
  if (raw === '') return fallback;
  return Number(raw);
}

async function raise(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');

  const lines = Array.from({ length: LINES }, (_, index) => ({
    productId: String(formData.get(`line.${index}.productId`) ?? '') || null,
    description: String(formData.get(`line.${index}.description`) ?? ''),
    quantity: numberFrom(formData.get(`line.${index}.quantity`), 0),
    unitCost: numberFrom(formData.get(`line.${index}.unitCost`), 0),
  }));

  const expected = String(formData.get('expectedAt') ?? '');

  let id: string;

  try {
    id = await createPurchaseOrder({
      orgId,
      userId: user.userId,
      supplierId: String(formData.get('supplierId') ?? ''),
      expectedAt: expected ? new Date(`${expected}T12:00:00`) : null,
      notes: String(formData.get('notes') ?? ''),
      lines,
    });
  } catch (error) {
    if (!(error instanceof CatalogueError)) throw error;

    redirect(
      `/purchasing/new?${new URLSearchParams({
        problem: error.message,
        supplierId: String(formData.get('supplierId') ?? ''),
      }).toString()}`,
    );
  }

  redirect(`/purchasing/${id}`);
}

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; supplierId?: string }>;
}) {
  const { orgId } = await requireSession('inventory:write');
  const params = await searchParams;

  const { suppliers, products } = await orderFormOptions(orgId);

  return (
    <>
      <BackLink href="/purchasing">Purchasing</BackLink>

      <PageHeader
        eyebrow="Inventory"
        title="New purchase order"
        description="Written down as a draft. Approving it is a separate step."
      />

      {params.problem ? (
        <Alert tone="danger" className="mb-5">
          {params.problem}
        </Alert>
      ) : null}

      {suppliers.length === 0 ? (
        <Card className="mb-5">
          <CardBody className="flex flex-wrap items-center justify-between gap-3 text-[14px]">
            <span>There are no suppliers to order from yet.</span>
            <Link href="/suppliers/new">
              <Button variant="primary">Add a supplier</Button>
            </Link>
          </CardBody>
        </Card>
      ) : null}

      <form action={raise} className="grid gap-5">
        <Card>
          <CardHeader title="Who and when" />
          <CardBody className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Supplier">
              <Select name="supplierId" defaultValue={params.supplierId ?? ''} required>
                <option value="">Choose a supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Expected" hint="Optional">
              <Input name="expectedAt" type="date" />
            </Field>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Lines"
            description="Pick a part from the catalogue, or describe something that is not in it yet."
          />
          <div className="scroll-x">
            <table className="w-full min-w-[44rem] text-[13px]">
              <thead>
                <tr className="border-b border-(--border) text-left text-(--text-faint)">
                  <th className="px-4 py-2 font-medium">Part</th>
                  <th className="px-2 py-2 font-medium">Or a description</th>
                  <th className="w-24 px-2 py-2 font-medium">Qty</th>
                  <th className="w-32 px-2 py-2 pr-4 font-medium">Unit cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)">
                {Array.from({ length: LINES }, (_, index) => (
                  <tr key={index}>
                    <td className="px-4 py-1.5">
                      <Select name={`line.${index}.productId`} defaultValue="">
                        <option value="">—</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.partNumber} · {product.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        name={`line.${index}.description`}
                        placeholder={index === 0 ? 'Wiper blade set, 26 inch' : ''}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        name={`line.${index}.quantity`}
                        inputMode="decimal"
                        className="tabular-nums"
                        placeholder="1"
                      />
                    </td>
                    <td className="px-2 py-1.5 pr-4">
                      <Input
                        name={`line.${index}.unitCost`}
                        inputMode="decimal"
                        className="tabular-nums"
                        placeholder="0.00"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CardBody className="text-[12px] leading-relaxed text-(--text-faint)">
            Costs are before VAT. A line with a part and no cost uses whatever you type here, not
            the catalogue price, because the quote in front of you is newer.
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Notes for the supplier" description="Optional" />
          <CardBody>
            <Textarea
              name="notes"
              rows={2}
              placeholder="Deliver to the rear entrance, before 10."
            />
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="lg" disabled={suppliers.length === 0}>
            Save as a draft
          </Button>
        </div>
      </form>
    </>
  );
}
