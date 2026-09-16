import {
  describePayrollRun,
  fromDecimal,
  PAYROLL_EXPORT_IDS,
  PAYROLL_EXPORTS,
  PlanLimitError,
} from '@carnet/core';
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
import { tFor } from '@/lib/i18n';
import { once, onceToken, StillGoingError } from '@/lib/once';
import {
  addPayAdjustment,
  approveTimesheet,
  awaitingApproval,
  awaitingPayroll,
  markPayrollPaid,
  PayrollError,
  payrollRuns,
  payrollSettings,
  removePayAdjustment,
  runPayroll,
  savePayrollSettings,
  submitTimesheet,
  waitingSheets,
} from '@/lib/payroll';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Payroll') };
}
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
    if (!(error instanceof PayrollError) && !(error instanceof PlanLimitError)) throw error;
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
    if (!(error instanceof PayrollError) && !(error instanceof PlanLimitError)) throw error;
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

/** A bonus or a deduction on a sheet that has not gone yet. Phase 43. */
async function adjust(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payroll:approve');

  try {
    await once({
      orgId,
      key: ['pay-adjustment', String(formData.get('once') ?? '')],
      work: () =>
        addPayAdjustment({
          orgId,
          userId: user.userId,
          timesheetId: String(formData.get('timesheetId') ?? ''),
          kind: String(formData.get('kind') ?? ''),
          label: String(formData.get('label') ?? ''),
          amount: Number(String(formData.get('amount') ?? '').replace(',', '.')),
        }),
    });
  } catch (error) {
    if (!(error instanceof PayrollError) && !(error instanceof StillGoingError)) throw error;
    redirect(`/payroll?problem=${encodeURIComponent(error.message)}#adjustments`);
  }

  redirect('/payroll?done=adjusted#adjustments');
}

async function unadjust(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payroll:approve');

  try {
    await removePayAdjustment({
      orgId,
      userId: user.userId,
      adjustmentId: String(formData.get('adjustmentId') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof PayrollError)) throw error;
    redirect(`/payroll?problem=${encodeURIComponent(error.message)}#adjustments`);
  }

  redirect('/payroll?done=adjusted#adjustments');
}

async function saveSettings(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payroll:approve');

  try {
    await savePayrollSettings({
      orgId,
      userId: user.userId,
      overtimeMultiplier: Number(
        String(formData.get('overtimeMultiplier') ?? '').replace(',', '.'),
      ),
      exportFormat: String(formData.get('exportFormat') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof PayrollError)) throw error;
    redirect(`/payroll?problem=${encodeURIComponent(error.message)}#settings`);
  }

  redirect('/payroll?done=settings#settings');
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; done?: string; run?: string }>;
}) {
  const { orgId, user, region } = await requireSession('payroll:read');
  const notice = await searchParams;

  // A key for this drawing of the page; a bonus added twice by a double-click
  // is the same bonus. Phase 46.
  const token = onceToken();
  const t = await tFor();

  const [toApprove, toRun, runs, employees, waiting, settings] = await Promise.all([
    awaitingApproval(orgId),
    awaitingPayroll(orgId),
    payrollRuns(orgId),
    prisma.employee.findMany({
      where: { orgId, isActive: true },
      orderBy: { reference: 'asc' },
      select: { id: true, reference: true, displayName: true },
    }),
    waitingSheets(orgId),
    payrollSettings(orgId),
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
        eyebrow={t('Team')}
        title={t('Payroll')}
        description={t('Hours approved here are handed to whoever runs the payroll, as a file')}
        actions={
          <Link href="/people">
            <Button>{t('People')}</Button>
          </Link>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('To approve')}
          value={toApprove.length}
          tone={toApprove.length > 0 ? 'warning' : 'neutral'}
          note={t('Submitted timesheets')}
        />
        <StatTile
          label={t('Ready for payroll')}
          value={toRun.reduce((total, period) => total + period.sheets.length, 0)}
          tone={toRun.length > 0 ? 'brand' : 'neutral'}
          note={toRun.length === 1 ? t('1 period') : t('{count} periods', { count: toRun.length })}
        />
        <StatTile
          label={t('Awaiting payment')}
          value={runs.filter((r) => r.status === 'EXPORTED').length}
          note={t('Exported, not yet marked paid')}
        />
      </StatRow>

      {notice.problem ? (
        <Alert tone="danger" className="mb-5">
          {t(notice.problem)}
        </Alert>
      ) : null}

      {notice.done ? (
        <Alert tone="success" className="mb-5">
          {notice.done === 'exported' ? (
            <>
              {t('Handed to payroll.')}{' '}
              <a
                href={`/api/reports/payroll?run=${notice.run ?? ''}`}
                className="font-medium underline underline-offset-2"
              >
                {t('Download the file')}
              </a>{' '}
              {t('and mark the run paid once the money has gone.')}
            </>
          ) : notice.done === 'paid' ? (
            t('Marked paid. Wages have been posted to the ledger.')
          ) : notice.done === 'approved' ? (
            t('Approved. The hours will not move again.')
          ) : notice.done === 'adjusted' ? (
            t('Saved. It goes into the file when the period is handed over.')
          ) : notice.done === 'settings' ? (
            t('Saved. Timesheets submitted from now on use it.')
          ) : (
            t('Submitted. A manager approves it next.')
          )}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('To approve')}
              description={t(
                'Submitted hours. Once approved they do not change; a correction goes on the next period.',
              )}
            />
            {toApprove.length === 0 ? (
              <EmptyState
                title={t('Nothing waiting')}
                description={t('Submitted timesheets appear here.')}
              />
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
                      {t('{from} to {to}', {
                        from: sheet.periodStart.toLocaleDateString(region.locale),
                        to: sheet.periodEnd.toLocaleDateString(region.locale),
                      })}
                    </span>
                    <span className="tabular-nums">
                      {t('{ordinary}h + {overtime}h OT', {
                        ordinary: (sheet.ordinaryMinutes / 60).toFixed(1),
                        overtime: (sheet.overtimeMinutes / 60).toFixed(1),
                      })}
                    </span>
                    <span className="ms-auto font-medium tabular-nums">
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={Number(sheet.gross)}
                      />
                    </span>
                    {mayWrite ? (
                      <form action={approve}>
                        <input type="hidden" name="timesheetId" value={sheet.id} />
                        <Button type="submit" size="sm" variant="primary">
                          {t('Approve')}
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
              title={t('Ready for payroll')}
              description={t('Approved hours, one run per period. The run produces the file.')}
            />
            {toRun.length === 0 ? (
              <EmptyState
                title={t('Nothing approved and unpaid')}
                description={t('Approve timesheets above and they gather here by period.')}
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {toRun.map((period) => (
                  <li key={period.periodStart.toISOString()} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3 text-[13px]">
                      <span className="font-medium">
                        {t('{from} to {to}', {
                          from: period.periodStart.toLocaleDateString(region.locale),
                          to: period.periodEnd.toLocaleDateString(region.locale),
                        })}
                      </span>
                      <span className="text-(--text-faint)">
                        {period.sheets.length === 1
                          ? t('1 person')
                          : t('{count} people', { count: period.sheets.length })}
                      </span>
                      <span className="ms-auto font-medium tabular-nums">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={period.gross.minor / 100}
                        />
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
                            {t('Hand to payroll')}
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

          <Card id="adjustments" className="overflow-hidden">
            <CardHeader
              title={t('Bonuses and deductions')}
              description={t(
                'Added to a sheet until its period is handed over. Tax and pension are not typed here; the payroll software works them out.',
              )}
            />
            {waiting.length === 0 ? (
              <EmptyState
                title={t('No timesheet is waiting')}
                description={t('Submit a period and it can carry a bonus or a deduction.')}
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {waiting.map((sheet) => (
                  <li key={sheet.id} className="grid gap-2 px-4 py-3 text-[13px]">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="font-medium">{sheet.employee.displayName}</span>
                      <span className="text-(--text-faint)">
                        {t('{from} to {to}', {
                          from: sheet.periodStart.toLocaleDateString(region.locale),
                          to: sheet.periodEnd.toLocaleDateString(region.locale),
                        })}
                      </span>
                      <Badge tone="neutral" size="sm">
                        {t(sheet.status.toLowerCase())}
                      </Badge>
                    </div>
                    {sheet.adjustments.length > 0 ? (
                      <ul className="grid gap-1">
                        {sheet.adjustments.map((entry) => (
                          <li key={entry.id} className="flex flex-wrap items-center gap-2">
                            <Badge tone={entry.kind === 'BONUS' ? 'success' : 'warning'} size="sm">
                              {entry.kind === 'BONUS' ? t('Bonus') : t('Deduction')}
                            </Badge>
                            <bdi>{entry.label}</bdi>
                            <span className="ms-auto tabular-nums">
                              {entry.kind === 'DEDUCTION' ? '−' : '+'}
                              <Money
                                currency={region.currency}
                                locale={region.locale}
                                amount={Number(entry.amount)}
                              />
                            </span>
                            {mayWrite ? (
                              <form action={unadjust}>
                                <input type="hidden" name="adjustmentId" value={entry.id} />
                                <Button type="submit" size="sm" variant="ghost">
                                  {t('Remove')}
                                </Button>
                              </form>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {mayWrite ? (
                      <form
                        action={adjust}
                        className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_7rem_auto] sm:items-end"
                      >
                        <input type="hidden" name="timesheetId" value={sheet.id} />
                        <input type="hidden" name="once" value={`${token}:${sheet.id}`} />
                        <Field label={t('Kind')}>
                          <Select name="kind" defaultValue="BONUS">
                            <option value="BONUS">{t('Bonus')}</option>
                            <option value="DEDUCTION">{t('Deduction')}</option>
                          </Select>
                        </Field>
                        <Field label={t('What for')}>
                          <Input
                            name="label"
                            required
                            minLength={2}
                            maxLength={80}
                            placeholder={t('Quarter target met')}
                          />
                        </Field>
                        <Field label={t('Amount')}>
                          <Input name="amount" required inputMode="decimal" placeholder="50.00" />
                        </Field>
                        <Button type="submit" size="sm" variant="secondary">
                          {t('Add')}
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
              title={t('Runs')}
              description={t('Every file handed over, and whether the money has gone.')}
            />
            {runs.length === 0 ? (
              <EmptyState
                title={t('No runs yet')}
                description={t('The first run appears here once approved hours are handed over.')}
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {runs.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]"
                  >
                    <span className="font-medium">
                      {t('{from} to {to}', {
                        from: entry.periodStart.toLocaleDateString(region.locale),
                        to: entry.periodEnd.toLocaleDateString(region.locale),
                      })}
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
                      {t(entry.status.toLowerCase())}
                    </Badge>
                    <span className="text-(--text-faint)">
                      {t(
                        describePayrollRun({
                          status: entry.status,
                          employeeCount: entry.employeeCount,
                          gross: fromDecimal(entry.gross.toString()),
                          periodEnd: entry.periodEnd,
                        }),
                      )}
                    </span>
                    <span className="ms-auto flex flex-wrap items-center gap-2">
                      <span className="text-(--text-faint)">{t('File')}:</span>
                      {PAYROLL_EXPORT_IDS.map((format) => (
                        <a
                          key={format}
                          href={`/api/reports/payroll?run=${entry.id}&format=${format}`}
                          className="text-(--brand-text) underline underline-offset-2"
                        >
                          {t(PAYROLL_EXPORTS[format].name)}
                        </a>
                      ))}
                      {mayWrite && entry.status === 'EXPORTED' ? (
                        <form action={paid}>
                          <input type="hidden" name="runId" value={entry.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            {t('Mark paid')}
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
              title={t('Submit a period')}
              description={t('Turns a person’s attendance into a timesheet, frozen as it stands')}
            />
            <form action={submit}>
              <CardBody className="grid gap-3">
                <Field label={t('Who')}>
                  <Select name="employeeId" required defaultValue="">
                    <option value="">{t('Choose a person')}</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.reference} · {employee.displayName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('From')}>
                    <Input name="from" type="date" defaultValue={iso(monday)} required />
                  </Field>
                  <Field label={t('To')}>
                    <Input name="to" type="date" defaultValue={iso(sunday)} required />
                  </Field>
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!mayWrite || employees.length === 0}
                >
                  {t('Submit the timesheet')}
                </Button>
              </CardBody>
            </form>
          </Card>

          <Card id="settings">
            <CardHeader
              title={t('How pay is worked out')}
              description={t('Overtime is the hours past each person’s contracted week')}
            />
            <form action={saveSettings}>
              <CardBody className="grid gap-3">
                <Field
                  label={t('Overtime multiplier')}
                  hint={t('1.5 is time and a half. Applies to timesheets submitted from now on.')}
                >
                  <Input
                    name="overtimeMultiplier"
                    type="number"
                    step="0.01"
                    min={1}
                    max={3}
                    required
                    defaultValue={settings.overtimeMultiplier}
                    disabled={!mayWrite}
                  />
                </Field>
                <Field label={t('The file payroll gets')}>
                  <Select
                    name="exportFormat"
                    defaultValue={settings.exportFormat}
                    disabled={!mayWrite}
                  >
                    {PAYROLL_EXPORT_IDS.map((format) => (
                      <option key={format} value={format}>
                        {t(PAYROLL_EXPORTS[format].name)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <ul className="grid gap-1.5 text-[12px] leading-relaxed text-(--text-faint)">
                  {PAYROLL_EXPORT_IDS.map((format) => (
                    <li key={format}>
                      <span className="font-medium text-(--text-soft)">
                        {t(PAYROLL_EXPORTS[format].name)}
                      </span>
                      {' · '}
                      {t(PAYROLL_EXPORTS[format].description)}
                    </li>
                  ))}
                </ul>
                <Button type="submit" variant="secondary" disabled={!mayWrite}>
                  {t('Save')}
                </Button>
              </CardBody>
            </form>
          </Card>

          <Card>
            <CardBody className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
              <p className="font-medium text-(--text)">{t('What the file is')}</p>
              <p>
                {t(
                  'Hours split into ordinary and overtime, pay at the workshop’s own cost rate, and the bonuses and deductions added here, in the shape the payroll software imports. None of the three shapes is certified by a payroll vendor; each is mapped once on its import screen. Tax, pension and net pay are worked out there, not here.',
                )}
              </p>
              <p>
                {t(
                  'Marking a run paid posts gross wages, bonuses included, to the ledger and out of the bank. The deductions between gross and net come from the payroll software’s own report.',
                )}
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
