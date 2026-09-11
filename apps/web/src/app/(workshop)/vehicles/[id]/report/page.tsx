import { randomBytes } from 'node:crypto';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Registration,
  Vin,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { prisma } from '@carnet/db';
import { BackLink } from '@/components/back-link';
import { hashShareToken } from '@/lib/auth';
import { audit, requireSession } from '@/lib/guard';
import { reportFor } from '@/lib/handover';
import { orgCanReadVehicle } from '@/lib/passport';

export const metadata: Metadata = { title: 'Vehicle report' };
export const dynamic = 'force-dynamic';

/**
 * The report a seller hands a buyer. FR-3203.
 *
 * Three parts, always in this order: what the record says, what it does not
 * cover, and whether it is intact. The middle one is what earns the other
 * two. A report listing twenty-seven service events and saying nothing about
 * the four years before them is built to be misread, and the person it
 * misleads is the one with the money.
 *
 * There is no score. A number invites comparison between two cars whose
 * records cover completely different things, and the comparison would be
 * wrong in a way nobody could see.
 */
const KIND = {
  PRIVATE: 'Private owner',
  COMPANY: 'Company',
  FLEET: 'Fleet',
  DEALER: 'Dealer',
  FINANCE: 'Finance company',
} as const;

/**
 * Issues a code a buyer can check the vehicle with.
 *
 * The code is random and only its digest is stored, which is the same shape
 * every capability in this product uses: a link that leaks cannot be read
 * back out of the database, and revoking it is a single row.
 *
 * Shown once, on the next render, and never again. A code that can be
 * retrieved from a screen weeks later is a code that outlives the sale it was
 * made for.
 */
async function issueCode(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('vehicle:write');
  const vehicleId = String(formData.get('vehicleId') ?? '');

  if (!(await orgCanReadVehicle(orgId, vehicleId))) notFound();

  const token = randomBytes(18).toString('base64url');

  // Ninety days. Long enough for a sale to go through, short enough that a
  // code on a printed advert stops working once the car is gone.
  const expiresAt = new Date(Date.now() + 90 * 86_400_000);

  await prisma.passportShare.create({
    data: {
      vehicleId,
      tokenHash: hashShareToken(token),
      label: 'Buyer check code',
      createdByUserId: user.userId,
      expiresAt,
    },
  });

  await audit({
    orgId,
    actorUserId: user.userId,
    action: 'vehicle.check-code.issued',
    entityType: 'Vehicle',
    entityId: vehicleId,
    after: { expiresAt: expiresAt.toISOString() },
  });

  redirect(`/vehicles/${vehicleId}/report?code=${encodeURIComponent(token)}`);
}

function held(months: number): string {
  if (months < 1) return 'less than a month';
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`;
  return `${Math.floor(months / 12)} years`;
}

export default async function VehicleReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { orgId } = await requireSession('vehicle:read');
  const { id } = await params;
  const { code } = await searchParams;

  const permitted = await orgCanReadVehicle(orgId, id);
  if (!permitted) notFound();

  const report = await reportFor(id);
  if (!report) notFound();

  const name = [report.vehicle.year, report.vehicle.make, report.vehicle.model]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className="mb-3">
        <BackLink href={`/vehicles/${id}`}>Back to the vehicle</BackLink>
      </div>

      <PageHeader
        eyebrow="Carnet vehicle report"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {name}
            {report.vehicle.registration ? (
              <Registration value={report.vehicle.registration} />
            ) : null}
          </span>
        }
        description={report.verdict}
      />

      <Card
        className={`mb-5 ${report.chain === 'BROKEN' ? 'border-(--danger)' : report.chain === 'INTACT' ? 'border-(--success)' : ''}`}
      >
        <CardBody className="flex flex-wrap items-center gap-3">
          <Badge
            tone={
              report.chain === 'INTACT'
                ? 'success'
                : report.chain === 'BROKEN'
                  ? 'danger'
                  : 'neutral'
            }
            dot
          >
            {report.chain === 'INTACT'
              ? 'Verified'
              : report.chain === 'BROKEN'
                ? 'Does not check out'
                : 'Unverified'}
          </Badge>
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed">{report.chainWords}</p>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader title="What the record says" />
            <ul className="divide-y divide-(--border)">
              {report.headline.map((line) => (
                <li
                  key={line.label}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="text-[13px] text-(--text-soft)">{line.label}</span>
                  <span
                    className={`datum text-[13px] font-medium ${
                      line.concern === 'STOP'
                        ? 'text-(--danger)'
                        : line.concern === 'WARN'
                          ? 'text-(--warning)'
                          : ''
                    }`}
                  >
                    {line.value}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-[13px] text-(--text-soft)">VIN</span>
                <Vin value={report.vehicle.vin} />
              </li>
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Owners"
              description="How many, and how long each kept it. No names: those belong to them."
            />
            <ul className="divide-y divide-(--border)">
              {report.owners.map((owner) => (
                <li key={owner.position} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[13px]">
                    Owner {owner.position} · {KIND[owner.kind]}
                  </span>
                  <span className="text-[12px] text-(--text-faint)">
                    {held(owner.months)}
                    {owner.current ? ', still' : ''}
                  </span>
                </li>
              ))}
              {report.owners.length === 0 ? (
                <li className="px-4 py-3 text-[13px] text-(--text-soft)">
                  No ownership on record.
                </li>
              ) : null}
            </ul>
          </Card>
        </div>

        <div className="grid gap-5">
          <Card className="border-(--warning)">
            <CardHeader
              title="What this does not cover"
              description="Said here rather than left for somebody to discover."
            />
            <CardBody>
              <ul className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
                {report.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {report.questions.length > 0 ? (
            <Card>
              <CardHeader
                title="Worth asking about"
                description="Each of these has an innocent explanation and at least one that is not."
              />
              <CardBody>
                <ul className="grid gap-2 text-[13px] leading-relaxed">
                  {report.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Give a buyer a code"
              description="They check the same figures at /verify, with no account and nothing about the owner."
            />
            {code ? (
              <CardBody className="grid gap-2">
                <p className="text-[13px]">Written down now, or it is gone:</p>
                <p className="datum rounded-md border border-(--border) bg-(--surface-sunken) px-3 py-2 text-[15px] font-semibold break-all">
                  {code}
                </p>
                <p className="text-[12px] text-(--text-faint)">
                  Good for ninety days. Only its fingerprint is stored, so this screen is the one
                  chance to copy it. Issue another whenever you need one.
                </p>
              </CardBody>
            ) : (
              <form action={issueCode}>
                <input type="hidden" name="vehicleId" value={id} />
                <CardBody>
                  <Button type="submit">Issue a check code</Button>
                </CardBody>
              </form>
            )}
          </Card>

          <Card>
            <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
              <Link href={`/vehicles/${id}`} className="font-medium text-(--brand-text) underline">
                Back to the vehicle
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
