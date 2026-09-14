import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Money } from '@carnet/ui';
import * as React from 'react';

import type { DecisionPreview } from '@/lib/portal';

/**
 * The screen where a customer decides what work to have done.
 *
 * Every box starts unticked. A form that arrives with everything selected is
 * not asking a question, it is presenting a default, and the approval it
 * produces is worth nothing the first time somebody disputes it.
 *
 * Prices are per line and the running total is not calculated here, because
 * doing it in the browser means a figure the server never saw. The customer
 * sees each line's price and the estimate's total; the server does the
 * arithmetic on what actually came back.
 *
 * Safety items are marked and can still be turned down. It is their car. The
 * system's job is to be sure they were told, and to keep the record of it.
 */
export interface ReviewEstimate {
  id: string;
  status: string;
  currency: string;
  subtotal: unknown;
  taxTotal: unknown;
  total: unknown;
  notes: string | null;
  validUntil: Date | null;
  job: {
    shortDescription: string;
    org: { name: string; phone: string | null };
    vehicle: {
      make: string | null;
      model: string | null;
      year: number | null;
      registration: string | null;
    };
  };
  lines: {
    id: string;
    kind: string;
    description: string;
    detail: string | null;
    quantity: unknown;
    lineTotal: unknown;
    isOptional: boolean;
    decision: string;
    inspectionResult: { severity: string; note: string | null } | null;
  }[];
}

export function EstimateReview({
  estimate,
  preview,
  action,
  hiddenFields,
  error,
  locale = 'en-GB',
}: {
  /** How dates are written, from the workshop's region. */
  locale?: string;
  estimate: ReviewEstimate;
  preview: DecisionPreview;
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string>;
  error?: string;
}) {
  const vehicle = estimate.job.vehicle;
  const name = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');

  return (
    <>
      <p className="eyebrow">{estimate.job.org.name}</p>
      <h1 className="mt-1 font-display text-[24px] font-semibold leading-tight">
        A quote for your {name || 'vehicle'}
      </h1>
      <p className="mt-1 text-[14px] text-(--text-soft)">
        {estimate.job.shortDescription}
        {vehicle.registration ? ` · ${vehicle.registration}` : ''}
      </p>

      {error ? (
        <Alert tone="danger" className="mt-4" title="That did not go through">
          {error}
        </Alert>
      ) : null}

      {preview.blockedReason ? (
        <Alert tone="info" className="mt-4" title="This quote is closed">
          {preview.blockedReason}
          {estimate.job.org.phone ? ` You can call them on ${estimate.job.org.phone}.` : ''}
        </Alert>
      ) : null}

      <form action={action} className="mt-5 grid gap-4">
        {Object.entries(hiddenFields ?? {}).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}

        <Card>
          <CardHeader
            title="What we recommend"
            description="Tick what you would like done. Anything left unticked will not be carried out."
          />
          <CardBody className="grid gap-3">
            {estimate.lines.map((line) => {
              const critical = line.inspectionResult?.severity === 'CRITICAL';

              return (
                <label
                  key={line.id}
                  htmlFor={`line-${line.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-(--radius-sm) border border-(--border) p-3"
                >
                  <input
                    id={`line-${line.id}`}
                    type="checkbox"
                    name="line"
                    value={line.id}
                    disabled={Boolean(preview.blockedReason)}
                    defaultChecked={line.decision === 'APPROVED'}
                    className="mt-1 size-4 shrink-0"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{line.description}</span>
                      {critical ? (
                        <Badge tone="danger" size="sm">
                          safety
                        </Badge>
                      ) : line.isOptional ? (
                        <Badge tone="neutral" size="sm">
                          optional
                        </Badge>
                      ) : null}
                    </span>

                    {line.detail ? (
                      <span className="mt-0.5 block text-[13px] text-(--text-soft)">
                        {line.detail}
                      </span>
                    ) : null}

                    {line.inspectionResult?.note ? (
                      <span className="mt-0.5 block text-[13px] text-(--text-soft)">
                        The technician noted: {line.inspectionResult.note}
                      </span>
                    ) : null}
                  </span>

                  <span className="shrink-0 font-medium tabular-nums">
                    <Money amount={Number(line.lineTotal)} currency={estimate.currency} />
                  </span>
                </label>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="grid gap-1.5 text-[14px]">
            <div className="flex justify-between text-(--text-soft)">
              <span>Before tax, if you take everything</span>
              <Money amount={Number(estimate.subtotal)} currency={estimate.currency} />
            </div>
            <div className="flex justify-between text-(--text-soft)">
              <span>Tax</span>
              <Money amount={Number(estimate.taxTotal)} currency={estimate.currency} />
            </div>
            <div className="flex justify-between border-t border-(--border) pt-1.5 font-display text-[17px] font-semibold">
              <span>Total</span>
              <Money amount={Number(estimate.total)} currency={estimate.currency} />
            </div>
            <p className="mt-1 text-[12px] text-(--text-faint)">
              You will only be charged for what you tick.
              {estimate.validUntil
                ? ` This price holds until ${estimate.validUntil.toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'long',
                  })}.`
                : ''}
            </p>
          </CardBody>
        </Card>

        {estimate.notes ? (
          <Card>
            <CardHeader title="From the workshop" />
            <CardBody className="text-[14px] leading-relaxed text-(--text-soft)">
              {estimate.notes}
            </CardBody>
          </Card>
        ) : null}

        {preview.blockedReason ? null : (
          <Card>
            <CardBody className="grid gap-4">
              <Field
                label="Your name"
                htmlFor="approvedByName"
                required
                hint="So the workshop knows who agreed to the work."
              >
                <Input id="approvedByName" name="approvedByName" required autoComplete="name" />
              </Field>

              <Field label="Anything to add?" htmlFor="note" hint="Optional.">
                <Input id="note" name="note" />
              </Field>

              <p className="text-[13px] leading-relaxed text-(--text-soft)">
                Sending this tells the workshop exactly which items to carry out. Anything you have
                left unticked will not be done, and will stay on the vehicle&rsquo;s record as
                recommended work that was turned down.
              </p>

              <div>
                <Button type="submit" size="lg" variant="primary">
                  Send my answer
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </form>
    </>
  );
}
