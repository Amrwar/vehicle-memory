import { COMEBACK_CAUSE_LABEL, COMEBACK_CAUSES, isOurs } from '@carnet/core';
import { Badge, Button, Card, CardBody, CardHeader, Select } from '@carnet/ui';
import Link from 'next/link';

import type { caseFileFor } from '@/lib/casefile';
import { tFor } from '@/lib/i18n';

/**
 * The case file: everything about the job this car came back from.
 *
 * Marking a comeback has been possible since Phase 26 — a link and a sentence.
 * What was never possible was answering the question the link raises. Somebody
 * standing in front of a returned car had to open the original job, the
 * inspection, the parts and the clock in four places and hold it together in
 * their head, which is why it was mostly not done.
 *
 * So the story is on one screen, in the order somebody would ask it: what they
 * came in with, what we decided it was, what we fitted, who did it, what the
 * inspection and the sign-off said — and then what they have come back with.
 *
 * The cause is the one thing here that is not already recorded, because it is a
 * judgement somebody makes. Everything above it is the evidence for making it.
 * Phase 86.
 */
export async function JobCaseFile({
  file,
  canWrite,
  setCause,
  jobId,
}: {
  jobId: string;
  file: NonNullable<Awaited<ReturnType<typeof caseFileFor>>>;
  canWrite: boolean;
  setCause: (formData: FormData) => Promise<void>;
}) {
  const t = await tFor();
  const { original } = file;

  const line = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        <span className="text-(--text-faint)">{label}</span>
        <span className="min-w-0">{value}</span>
      </div>
    ) : null;

  return (
    <Card
      id="casefile"
      className={file.cause && isOurs(file.cause) ? 'border-(--warning)' : undefined}
    >
      <CardHeader
        title={t('Why it came back')}
        description={t(
          'The job it came back from, in the order somebody would ask about it. Everything here was already recorded; the cause is the one judgement to make.',
        )}
      />

      <CardBody className="grid gap-4 text-[13px]">
        <div className="grid gap-1.5 rounded-(--radius-md) border border-(--border) p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/jobs/${original.id}`}
              className="font-medium text-(--brand-text) hover:underline"
            >
              #{original.number}
            </Link>
            {file.cause ? (
              <Badge tone={isOurs(file.cause) ? 'warning' : 'neutral'}>
                {t(COMEBACK_CAUSE_LABEL[file.cause])}
              </Badge>
            ) : (
              <Badge tone="neutral">{t('Cause not established')}</Badge>
            )}
          </div>

          {line(t('They came in with'), original.complaint)}
          {line(t('We decided it was'), original.diagnosisNote)}

          {original.settled.map((one) => (
            <div key={one.symptom} className="flex flex-wrap gap-x-2 gap-y-0.5">
              <span className="text-(--text-faint)">{t('Confirmed on that job')}</span>
              <span className="min-w-0">
                {one.symptom}
                {one.confirmed.length > 0 ? ` — ${one.confirmed.join(', ')}` : ''}
              </span>
            </div>
          ))}

          {line(
            t('We fitted'),
            original.parts.length > 0
              ? original.parts.map((part) => `${part.quantity}× ${part.description}`).join(', ')
              : null,
          )}
          {line(t('Done by'), original.technicians.join(', ') || null)}
          {line(
            t('The inspection'),
            original.inspection
              ? t('{critical} critical, {advisory} advisory', {
                  critical: original.inspection.criticalCount,
                  advisory: original.inspection.advisoryCount,
                })
              : null,
          )}
          {line(
            t('Signed off'),
            original.signOff
              ? original.signOff.passed
                ? `${t('Passed')}${original.signOff.checkedBy ? ` · ${original.signOff.checkedBy.name}` : ''}`
                : t('Not passed')
              : null,
          )}
          {line(t('They have come back with'), file.newComplaint)}
          {line(t('Said at the time'), file.saidAtTheTime)}
        </div>

        {file.missing.length > 0 ? (
          <p className="text-[12px] text-(--text-faint)">
            {t('Still to fill in: {what}', { what: file.missing.join(', ') })}
          </p>
        ) : null}

        <form action={setCause} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="jobId" value={jobId} />
          <Select
            name="cause"
            defaultValue={file.cause ?? ''}
            className="w-64"
            disabled={!canWrite}
          >
            <option value="" disabled>
              {t('What caused it?')}
            </option>
            {COMEBACK_CAUSES.map((cause) => (
              <option key={cause} value={cause}>
                {t(COMEBACK_CAUSE_LABEL[cause])}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary" disabled={!canWrite}>
            {t('Record the cause')}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
