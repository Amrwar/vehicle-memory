import type { QualityItem } from '@carnet/core';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@carnet/ui';

import { tFor } from '@/lib/i18n';

/**
 * The sign-off sheet, on the job, at the point somebody would sign it.
 *
 * Every line is answerable and none is pre-answered. A sheet that arrived with
 * the ticks already in would be a sheet nobody read, and the only thing a
 * quality check is worth is that somebody had to look at each line to get
 * past it. Phase 85.
 *
 * There is one button. It records the answers and lets the outcome fall out of
 * them: a sheet with a required line unanswered fails, and the failure names
 * the lines. Offering "Pass" and "Fail" as two buttons would let somebody pass
 * a sheet they had not filled in, which is the thing being prevented.
 */
export async function JobQuality({
  jobId,
  sheet,
  checks,
  canWrite,
  record,
}: {
  jobId: string;
  sheet: QualityItem[];
  checks: {
    id: string;
    passed: boolean;
    notes: string | null;
    createdAt: Date;
    checkedBy: { name: string } | null;
    answers: {
      confirmed: boolean | null;
      value: string | null;
      item: { id: string; label: string; kind: string; required: boolean };
    }[];
  }[];
  canWrite: boolean;
  record: (formData: FormData) => Promise<void>;
}) {
  const t = await tFor();
  const last = checks[0];

  return (
    <Card id="quality">
      <CardHeader
        title={t('Sign-off')}
        description={t(
          'The last look before the car goes back. A line left blank is a line not checked, and the sheet does not pass until every required one is answered.',
        )}
      />

      <CardBody className="grid gap-4 text-[13px]">
        {last ? (
          <div className="grid gap-1.5 rounded-(--radius-md) border border-(--border) p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={last.passed ? 'success' : 'danger'}>
                {last.passed ? t('Passed') : t('Not passed')}
              </Badge>
              {last.checkedBy ? (
                <span className="text-(--text-faint)">{last.checkedBy.name}</span>
              ) : null}
            </div>

            {last.notes ? <p className="text-(--text-soft)">{last.notes}</p> : null}

            <ul className="grid gap-0.5 text-[12px] text-(--text-faint)">
              {last.answers.map((answer) => (
                <li key={answer.item.id} className="flex flex-wrap justify-between gap-2">
                  <span>{answer.item.label}</span>
                  <span>{answer.value ?? (answer.confirmed ? t('Yes') : t('No'))}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {sheet.length === 0 ? (
          <p className="text-(--text-faint)">
            {t('This workshop has no sign-off sheet yet. Add the lines in settings.')}
          </p>
        ) : (
          <form action={record} className="grid gap-3">
            <input type="hidden" name="jobId" value={jobId} />

            <ul className="grid gap-2">
              {sheet.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-md) border border-(--border) p-2.5"
                >
                  <span className="min-w-0">
                    {item.label}
                    {item.required ? null : (
                      <span className="ms-1.5 text-[11px] text-(--text-faint)">
                        {t('optional')}
                      </span>
                    )}
                  </span>

                  {item.kind === 'CONFIRM' ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name={`confirm:${item.id}`}
                        className="h-5 w-5"
                        disabled={!canWrite}
                      />
                      <span className="text-[12px] text-(--text-faint)">{t('Checked#line')}</span>
                    </label>
                  ) : (
                    <Input
                      name={`value:${item.id}`}
                      className="w-40"
                      disabled={!canWrite}
                      aria-label={item.label}
                    />
                  )}
                </li>
              ))}
            </ul>

            <Input name="notes" placeholder={t('Anything worth saying')} disabled={!canWrite} />

            <div>
              <Button type="submit" variant="primary" disabled={!canWrite}>
                {t('Record the sign-off')}
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
