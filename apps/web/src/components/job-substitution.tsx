import { EVIDENCE_SENTENCE } from '@carnet/core';
import { Badge, Button, Card, CardBody, CardHeader } from '@carnet/ui';

import { tFor } from '@/lib/i18n';
import type { whatElseWouldDo } from '@/lib/sourcing';

type Found = Awaited<ReturnType<typeof whatElseWouldDo>>;

export interface SubstitutionLine {
  partLineId: string;
  description: string;
  partNumber: string | null;
  found: Found;
  /** Already swapped: what it went on instead of, and who said so. */
  already: {
    original: string;
    evidence: keyof typeof EVIDENCE_SENTENCE;
    confirmedBy: string | null;
    confirmedAt: Date;
  } | null;
}

/**
 * What else would do, when the part on the job cannot be got.
 *
 * Every workshop substitutes; the whole question is what somebody knew when
 * they did it. So there is no confidence score on this screen, because a
 * score is invented and an invented number is how the wrong pads reach a car
 * whose owner is braking. Each alternative carries a sentence instead.
 *
 * The badge is the reason it is here at all, and only two records can be that
 * reason: we have made this exact swap before, or a supplier lists both under
 * one number. Anything else true about it — that we fitted it to this car,
 * that a catalogue vouches for it — is shown after, in smaller type, because
 * suiting the same car was never a claim that two parts interchange.
 *
 * Nothing swaps itself. A person presses the button, and the line then carries
 * the part, the part it replaced, the evidence and the name, together, because
 * the database will not accept them apart. Years later the customer can be
 * told exactly what went on their car and who decided it.
 *
 * Phase 87.
 */
export async function JobSubstitution({
  jobId,
  lines,
  canWrite,
  swap,
}: {
  jobId: string;
  lines: SubstitutionLine[];
  canWrite: boolean;
  swap: (formData: FormData) => Promise<void>;
}) {
  const t = await tFor();
  if (lines.length === 0) return null;

  return (
    <Card id="substitutes">
      <CardHeader
        title={t('What else would do')}
        description={t(
          'Alternatives for the parts on this job, each with what we know about it. Nothing is swapped until somebody here confirms it.',
        )}
      />

      <CardBody className="grid gap-4 text-[13px]">
        {lines.map((line) => (
          <div key={line.partLineId} className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{line.description}</span>
              {line.partNumber ? (
                <span className="datum text-[11px] text-(--text-faint)">{line.partNumber}</span>
              ) : null}
            </div>

            {line.already ? (
              <p className="rounded-(--radius-md) border border-(--border) p-2.5">
                {t('Fitted in place of {part}', { part: line.already.original })}
                {' — '}
                {t(EVIDENCE_SENTENCE[line.already.evidence])}
                {line.already.confirmedBy
                  ? ` · ${t('confirmed by {who}', { who: line.already.confirmedBy })}`
                  : ''}
              </p>
            ) : line.found.candidates.length === 0 ? (
              <p className="text-(--text-faint)">
                {t('Nothing on record would do instead of this part.')}
              </p>
            ) : (
              <ul className="grid gap-1">
                {line.found.candidates.map((one) => (
                  <li
                    key={one.productId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-md) border border-(--border) p-2.5"
                  >
                    <span className="font-medium">{one.name}</span>
                    <span className="datum text-[11px] text-(--text-faint)">{one.partNumber}</span>
                    {one.brand ? <span className="text-(--text-faint)">{one.brand}</span> : null}
                    <Badge tone={one.strongest === 'SUBSTITUTED_BEFORE' ? 'success' : 'neutral'}>
                      {t(EVIDENCE_SENTENCE[one.strongest])}
                    </Badge>
                    {one.corroboration.length > 0 ? (
                      <span className="text-[11px] text-(--text-faint)">
                        {one.corroboration.map((kind) => t(EVIDENCE_SENTENCE[kind])).join(' · ')}
                      </span>
                    ) : null}
                    <span className="text-(--text-faint)">
                      {one.inStock > 0
                        ? t('{count} on the shelf', { count: one.inStock })
                        : t('None on the shelf')}
                    </span>
                    <span className="ms-auto">
                      {canWrite ? (
                        <form action={swap}>
                          <input type="hidden" name="jobId" value={jobId} />
                          <input type="hidden" name="partLineId" value={line.partLineId} />
                          <input type="hidden" name="productId" value={one.productId} />
                          <Button type="submit" variant="secondary" className="text-[12px]">
                            {t('Fit this instead')}
                          </Button>
                        </form>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
