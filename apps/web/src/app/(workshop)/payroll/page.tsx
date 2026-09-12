import { describePayrollRun, fromDecimal } from '@carnet/core';
import { prisma } from '@carnet/db';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Money,
  PageHeader,
  Select,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { can, requireSession } from '@/lib/guard';
import {
  approveTimesheet,
  awaitingApproval,
  awaitingPayroll,
  markPayrollPaid,
  PayrollError,
  payrollRuns,
  runPayroll,
  submitTimesheet,
} from '@/lib/payroll';

export const metadata: Metadata = { title: 'Payroll' };
export const dynamic = 'force-dynamic';

/**
 * Hours to payroll.
 *
 * Four steps, top to bottom in the order they happen: a period is submitted
 * for a person, a manager approves it, the approved sheets for one period are
 * handed over as a file, and once the money has left the bank the run is
 * marked paid and the wages post. The product never works out tax. It hands
 * the hours to whatever does.
 */

function dateOnly(value: string, endOfDay = false): Date {
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return date;
}

async function submit(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payroll:approve');

  try {
    await submitTimesheet({
      orgId,
      userId: user.userId,
      employeeId: String(formData.get('employeeId') ?? ''),
      periodStart: dateOnly(String(formData.get('from') ?? '')),
      periodEnd: dateOnly(String(formData.get('to') ?? ''), true),
    });
  } catch (error) {
    if (!(error instanceof PayrollError)) throw error;
    redirect(`/payroll?problem=${encodeURIComponent(error.message)}`);
  }

  redirect('/payroll?done=submitted');
}

async function approve(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payroll:approve');

  try {
    await approveTimesheet({
      orgId,
      userId: user.userId,
      timesheetId: String(formData.get('timesheetId') ?? ''),
    });
  } catch (error) {
    redirect(
      `/payroll?problem=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`,
    );
  }

  redirect('/payroll?done=approved');
}

async function run(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payroll:approve');

  let runId: string;

  try {
    runId = await runPayroll({
      orgId,
      userId: user.userId,
      periodStart: new Date(String(formData.get('periodStart') ?? '')),
      periodEnd: new Date(String(formData.get('periodEnd') ?? '')),
    });
  } catch (error) {
    if (!(error instanceof PayrollError)) throw error;
    redirect(`/payroll?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/payroll?done=exported&run=${runId}`);
}

async function paid(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payroll:approve');

  try {
    await markPayrollPaid({
      orgId,
      userId: user.userId,
      runId: String(formData.get('runId') ?? ''),
    });
  } catch (error) {
    redirect(
      `/payroll?problem=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`,
    );
  }

  redirect('/payroll?done=paid');
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; done?: string; run?: string }>;
}) {
  const { orgId, user } = await requireSession('payroll:read');
  const notice = await searchParams;

  const [toApprove, toRun, runs, employees] = await Promise.all([
    awaitingApproval(orgId),
    awaitingPayroll(orgId),
    payrollRuns(orgId),
    prisma.employee.findMany({
      where: { orgId, isActive: true },
      orderBy: { reference: 'asc' },
      select: { id: true, reference: true, displayName: true },
    }),
  ]);

  const mayWrite = can(user.role, 'payroll:approve');

  // Last full week, Monday to Sunday, as the default period to submit.
  const today = new Date();
  const day = (today.getUTCDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - day - 7),
  );
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="Payroll"
        description="Hours approved here are handed to whoever runs the payroll, as a file"
        actions={
          <Link href="/people">
            <Button>People</Button>
          </Link>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label="To approve"
          value={toApprove.length}
          tone={toApprove.length > 0 ? 'warning' : 'neutral'}
          note="Submitted timesheets"
        />
        <StatTile
          label="Ready for payroll"
          value={toRun.reduce((total, period) => total + period.sheets.length, 0)}
          tone={toRun.length > 0 ? 'brand' : 'neutral'}
          note={`${toRun.length} period${toRun.length === 1 ? '' : 's'}`}
        />
        <StatTile
          label="Awaiting payment"
          value={runs.filter((r) => r.status === 'EXPORTED').length}
          note="Exported, not yet marked paid"
        />
      </StatRow>

      {notice.problem ? (
        <Alert tone="danger" className="mb-5">
          {notice.problem}
        </Alert>
      ) : null}

      {notice.done ? (
        <Alert tone="success" className="mb-5">
          {notice.done === 'exported' ? (
            <>
              Handed to payroll.{' '}
              <a
                href={`/api/reports/payroll?run=${notice.run ?? ''}`}
                className="font-medium underline underline-offset-2"
              >
                Download the file
              </a>{' '}
              and mark the run paid once the money has gone.
            </>
          ) : notice.done === 'paid' ? (
            'Marked paid. Wages have been posted to the ledger.'
          ) : notice.done === 'approved' ? (
            'Approved. The hours will not move again.'
          ) : (
            'Submitted. A manager approves it next.'
          )}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title="To approve"
              description="Submitted hours. Once approved they do not change; a correction goes on the next period."
            />
            {toApprove.length === 0 ? (
              <EmptyState title="Nothing waiting" description="Submitted timesheets appear here." />
            ) : (
              <ul className="divide-y divide-(--border)">
                {toApprove.map((sheet) => (
                  <li
                    key={sheet.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]"
                  >
                    <span className="font-medium">{sheet.employee.displayName}</span>
                    <span className="datum text-(--text-faint)">{sheet.employee.reference}</span>
                    <span className="text-(--text-faint)">
                      {sheet.periodStart.toLocaleDateString('en-GB')} to{' '}
                      {sheet.periodEnd.toLocaleDateString('en-GB')}
                    </span>
                    <span className="tabular-nums">
                      {(sheet.ordinaryMinutes / 60).toFixed(1)}h +{' '}
                      {(sheet.overtimeMinutes / 60).toFixed(1)}h OT
                    </span>
                    <span className="ml-auto font-medium tabular-nums">
                      <Money amount={Number(sheet.gross)} />
                    </span>
                    {mayWrite ? (
                      <form action={approve}>
                        <input type="hidden" name="timesheetId" value={sheet.id} />
                        <Button type="submit" size="sm" variant="primary">
                          Approve
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Ready for payroll"
              description="Approved hours, one run per period. The run produces the file."
            />
            {toRun.length === 0 ? (
              <EmptyState
                title="Nothing approved and unpaid"
                description="Approve timesheets above and they gather here by period."
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {toRun.map((period) => (
                  <li key={period.periodStart.toISOString()} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3 text-[13px]">
                      <span className="font-medium">
                        {period.periodStart.toLocaleDateString('en-GB')} to{' '}
                        {period.periodEnd.toLocaleDateString('en-GB')}
                      </span>
                      <span className="text-(--text-faint)">
                        {period.sheets.length} {period.sheets.length === 1 ? 'person' : 'people'}
                      </span>
                      <span className="ml-auto font-medium tabular-nums">
                        <Money amount={period.gross.minor / 100} />
                      </span>
                      {mayWrite ? (
                        <form action={run}>
                          <input
                            type="hidden"
                            name="periodStart"
                            value={period.periodStart.toISOString()}
                          />
                          <input
                            type="hidden"
                            name="periodEnd"
                            value={period.periodEnd.toISOString()}
                          />
                          <Button type="submit" size="sm" variant="primary">
                            Hand to payroll
                          </Button>
                        </form>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[12px] text-(--text-faint)">
                      {period.sheets.map((sheet) => sheet.employeeName).join(', ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Runs"
              description="Every file handed over, and whether the money has gone."
            />
            {runs.length === 0 ? (
              <EmptyState
                title="No runs yet"
                description="The first run appears here once approved hours are handed over."
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {runs.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]"
                  >
                    <span className="font-medium">
                      {entry.periodStart.toLocaleDateString('en-GB')} to{' '}
                      {entry.periodEnd.toLocaleDateString('en-GB')}
                    </span>
                    <Badge
                      tone={
                        entry.status === 'PAID'
                          ? 'success'
                          : entry.status === 'EXPORTED'
                            ? 'warning'
                            : 'neutral'
                      }
                      size="sm"
                    >
                      {entry.status.toLowerCase()}
                    </Badge>
                    <span className="text-(--text-faint)">
                      {describePayrollRun({
                        status: entry.status,
                        employeeCount: entry.employeeCount,
                        gross: fromDecimal(entry.gross.toString()),
                        periodEnd: entry.periodEnd,
                      })}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <a
                        href={`/api/reports/payroll?run=${entry.id}`}
                        className="text-(--brand-text) underline underline-offset-2"
                      >
                        File
                      </a>
                      {mayWrite && entry.status === 'EXPORTED' ? (
                        <form action={paid}>
                          <input type="hidden" name="runId" value={entry.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            Mark paid
                          </Button>
                        </form>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader
              title="Submit a period"
              description="Turns a person's attendance into a timesheet, frozen as it stands"
            />
            <form action={submit}>
              <CardBody className="grid gap-3">
                <Field label="Who">
                  <Select name="employeeId" required defaultValue="">
                    <option value="">Choose a person</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.reference} · {employee.displayName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="From">
                    <Input name="from" type="date" defaultValue={iso(monday)} required />
                  </Field>
                  <Field label="To">
                    <Input name="to" type="date" defaultValue={iso(sunday)} required />
                  </Field>
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!mayWrite || employees.length === 0}
                >
                  Submit the timesheet
                </Button>
              </CardBody>
            </form>
          </Card>

          <Card>
            <CardBody className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
              <p className="font-medium text-(--text)">What the file is</p>
              <p>
                One row per person: reference, name, period, ordinary and overtime hours, and gross
                at the workshop's own cost rate. Every payroll package imports a CSV shaped like
                this. Tax, pension and net pay are worked out there, not here.
              </p>
              <p>
                Marking a run paid posts gross wages to the ledger and out of the bank. The
                deductions between gross and net come from the payroll software's own report.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
