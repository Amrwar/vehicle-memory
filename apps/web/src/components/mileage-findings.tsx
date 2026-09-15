import type { HistoryFinding } from '@carnet/core';
import { Badge, Card, CardBody, CardHeader } from '@carnet/ui';
import * as React from 'react';

import { tFor } from '@/lib/i18n';

/**
 * What the mileage record says about itself.
 *
 * Shown on the passport, which is the page a stranger reads before handing
 * over money for a car. Everything about the presentation follows from that.
 *
 * There is no score. A number out of ten would be quoted in an advert or used
 * to knock a thousand pounds off a price, and it cannot carry the reasoning
 * that produced it. Each finding stands on its own with what it rests on.
 *
 * Certainty is shown, not implied. "The odometer read less than it had two
 * years earlier" is arithmetic and is stated as fact. "The car has covered
 * less ground lately" is a pattern that also fits retirement or a second car,
 * and is stated as a question. Presenting the two the same way would make the
 * first look like an opinion and the second like an accusation.
 */
export async function MileageFindings({
  findings,
  summary,
  readings,
}: {
  findings: readonly HistoryFinding[];
  summary: string;
  readings: number;
}) {
  const t = await tFor();
  const serious = findings.filter((finding) => finding.severity === 'SERIOUS');
  const concerns = findings.filter((finding) => finding.severity === 'CONCERN');
  const notes = findings.filter((finding) => finding.severity === 'INFO');

  return (
    <Card className={serious.length > 0 ? 'border-(--danger)' : undefined}>
      <CardHeader
        title={t('The mileage record')}
        description={t(
          'Checked across every workshop that has recorded a reading. {count} on file.',
          { count: readings },
        )}
      />
      <CardBody className="grid gap-4">
        <p
          className={
            serious.length > 0
              ? 'text-[14px] font-medium leading-relaxed text-(--danger)'
              : 'text-[14px] leading-relaxed text-(--text-soft)'
          }
        >
          {t(summary)}
        </p>

        {[...serious, ...concerns].map((finding, index) => (
          <div
            key={`${finding.kind}-${index}`}
            className="border-s-[3px] border-(--border) ps-3.5"
            style={
              finding.severity === 'SERIOUS'
                ? { borderColor: 'var(--danger)' }
                : { borderColor: 'var(--warning)' }
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t(finding.summary)}</span>
              <Badge tone={finding.confidence === 'CERTAIN' ? 'danger' : 'warning'} size="sm">
                {finding.confidence === 'CERTAIN'
                  ? t('arithmetic')
                  : finding.confidence === 'LIKELY'
                    ? t('likely')
                    : t('worth asking')}
              </Badge>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-(--text-soft)">
              {t(finding.detail)}
            </p>
          </div>
        ))}

        {notes.length > 0 ? (
          <div className="border-t border-(--border) pt-3">
            <p className="eyebrow">{t('About the record itself')}</p>
            <ul className="mt-1.5 grid gap-1.5">
              {notes.map((finding, index) => (
                <li key={`${finding.kind}-${index}`} className="text-[13px] text-(--text-soft)">
                  {t(finding.summary)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-[12px] leading-relaxed text-(--text-faint)">
          {t(
            'This checks the readings against each other. It cannot see mileage covered while nobody was writing anything down, and it is not a warranty.',
          )}
        </p>
      </CardBody>
    </Card>
  );
}
