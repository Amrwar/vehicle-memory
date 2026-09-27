import { type CauseOutcome, causeSentence, evidenceSentence, type RankedCause } from '@carnet/core';
import { Badge, Button, Card, CardBody, CardHeader, Field, Select } from '@carnet/ui';

import { tFor } from '@/lib/i18n';

/**
 * What this workshop has found this complaint to be, and what this technician
 * found today.
 *
 * The two halves are deliberately the other way round from how a suggestion
 * engine would arrange them. **What there is to rule on comes first**, in the
 * catalogue's order, with no counts against it — because a technician reading
 * a list sorted by what the workshop usually finds has been led, and a corpus
 * built from led answers confirms itself for ever. The evidence sits
 * underneath, as history, clearly about other cars.
 *
 * Nothing here says what is wrong with the car on the ramp. The strongest
 * sentence on the screen is a count of jobs somebody finished. ADR-0016.
 */
export async function JobDiagnosis({
  jobId,
  catalogue,
  diagnosis,
  evidence,
  jobsBehind,
  canWrite,
  open,
  rule,
}: {
  jobId: string;
  catalogue: { id: string; label: string }[];
  diagnosis: {
    id: string;
    symptom: { id: string; label: string };
    settledAt: Date | null;
    causes: {
      id: string;
      outcome: CauseOutcome | null;
      cause: { id: string; label: string };
      decidedBy: { name: string } | null;
    }[];
  } | null;
  evidence: RankedCause[];
  jobsBehind: number;
  canWrite: boolean;
  open: (formData: FormData) => Promise<void>;
  rule: (formData: FormData) => Promise<void>;
}) {
  const t = await tFor();

  const tone: Record<CauseOutcome, 'success' | 'danger' | 'neutral'> = {
    CONFIRMED: 'success',
    REJECTED: 'danger',
    UNDETERMINED: 'neutral',
  };

  const wording: Record<CauseOutcome, string> = {
    CONFIRMED: t('Confirmed'),
    REJECTED: t('Ruled out'),
    UNDETERMINED: t('Not determined'),
  };

  const sentence = diagnosis
    ? evidenceSentence({
        symptom: diagnosis.symptom.label,
        jobs: jobsBehind,
        causes: evidence.length,
      })
    : null;

  return (
    <Card id="diagnosis">
      <CardHeader
        title={t('Diagnosis')}
        description={t(
          'What the complaint was, what was ruled on, and what this workshop has found it to be before. Nothing here is a guess about this car.',
        )}
      />

      <CardBody className="grid gap-4 text-[13px]">
        {!diagnosis ? (
          catalogue.length === 0 ? (
            <p className="text-(--text-faint)">
              {t('No complaints are set up yet. A workshop adds its own in settings.')}
            </p>
          ) : (
            <form action={open} className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input type="hidden" name="jobId" value={jobId} />
              <Field label={t('What did they come in with?')}>
                <Select name="symptomId" required>
                  {catalogue.map((symptom) => (
                    <option key={symptom.id} value={symptom.id}>
                      {symptom.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <Button type="submit" variant="secondary" disabled={!canWrite}>
                  {t('Start a diagnosis')}
                </Button>
              </div>
            </form>
          )
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{diagnosis.symptom.label}</span>
              <Badge tone={diagnosis.settledAt ? 'success' : 'warning'}>
                {diagnosis.settledAt ? t('Settled') : t('Still open')}
              </Badge>
            </div>

            {/* What there is to rule on. In the catalogue's order, with no
                counts beside it: a list sorted by what usually happens is a
                list that tells somebody what to find. */}
            <ul className="grid gap-2">
              {diagnosis.causes.map((one) => (
                <li
                  key={one.id}
                  className="grid gap-2 rounded-(--radius-md) border border-(--border) p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{one.cause.label}</p>
                    {one.outcome ? (
                      <p className="text-[12px] text-(--text-faint)">
                        {wording[one.outcome]}
                        {one.decidedBy ? ` · ${one.decidedBy.name}` : ''}
                      </p>
                    ) : null}
                  </div>

                  {one.outcome ? (
                    <Badge tone={tone[one.outcome]}>{wording[one.outcome]}</Badge>
                  ) : (
                    <form action={rule} className="flex flex-wrap gap-1.5">
                      <input type="hidden" name="jobId" value={jobId} />
                      <input type="hidden" name="diagnosisId" value={diagnosis.id} />
                      <input type="hidden" name="causeId" value={one.cause.id} />
                      {(['CONFIRMED', 'REJECTED', 'UNDETERMINED'] as const).map((outcome) => (
                        <Button
                          key={outcome}
                          type="submit"
                          name="outcome"
                          value={outcome}
                          size="sm"
                          variant={outcome === 'CONFIRMED' ? 'primary' : 'secondary'}
                          disabled={!canWrite}
                        >
                          {wording[outcome]}
                        </Button>
                      ))}
                    </form>
                  )}
                </li>
              ))}
            </ul>

            {/* And underneath, the history. About other cars, and said so. */}
            <div className="rounded-(--radius-md) border border-(--border) bg-(--surface-sunk) p-3">
              <p className="eyebrow mb-2">{t('What it has turned out to be here')}</p>

              <p className="mb-3 text-[12px] leading-relaxed text-(--text-soft)">
                {sentence ? t(sentence.key, sentence.vars) : null}
              </p>

              {evidence.length > 0 ? (
                <ul className="grid gap-1.5">
                  {evidence.map((cause) => {
                    const line = causeSentence(cause);
                    return (
                      <li key={cause.causeCode} className="flex flex-wrap justify-between gap-2">
                        <span>{cause.label}</span>
                        <span className="text-[12px] text-(--text-faint)">
                          {t(line.key, line.vars)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
