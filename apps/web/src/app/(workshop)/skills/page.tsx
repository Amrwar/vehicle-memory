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
  PageHeader,
  Select,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import { msg, type SkillLevel } from '@carnet/core';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { addSkill, matrixFor, setSkill } from '@/lib/planning';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Skills') };
}
export const dynamic = 'force-dynamic';

/**
 * Who can do what. FR-3303.
 *
 * A workshop whose only distinction is "technician" produces a rota somebody
 * redoes by hand every morning, because the rota does not know that only one
 * of them is an MOT tester.
 *
 * Two things make this screen worth having rather than being a table of
 * badges. Every skill keeps a column even when nobody has it, because the gap
 * is the point. And a skill only one person holds is named, because that is
 * the skill the workshop loses the day they are ill, and nothing else in the
 * product would ever say so.
 */
const LEVELS: { value: SkillLevel; label: string }[] = [
  { value: 'LEARNING', label: msg('Learning') },
  { value: 'COMPETENT', label: msg('Competent') },
  { value: 'EXPERT', label: msg('Expert') },
];

const TONE = { LEARNING: 'warning', COMPETENT: 'brand', EXPERT: 'success' } as const;

async function create(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('people:write');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/skills?error=' + encodeURIComponent(msg('A skill needs a name.')));

  await addSkill({
    orgId,
    userId: user.userId,
    name,
    note: String(formData.get('note') ?? ''),
  });

  redirect('/skills');
}

async function sign(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('people:write');

  const level = String(formData.get('level') ?? '');

  await setSkill({
    orgId,
    userId: user.userId,
    employeeId: String(formData.get('employeeId') ?? ''),
    skillId: String(formData.get('skillId') ?? ''),
    // An empty choice withdraws the sign-off rather than storing a "cannot":
    // a row asserting an absence and no row at all would eventually disagree.
    level: level ? (level as SkillLevel) : null,
  });

  redirect('/skills');
}

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { orgId } = await requireSession('people:read');
  const { error } = await searchParams;
  const t = await tFor();

  const matrix = await matrixFor(orgId);

  const singlePoints = matrix.skills.filter((skill) => skill.only !== null);
  const uncovered = matrix.skills.filter((skill) => skill.cover === 0);

  return (
    <>
      <PageHeader
        eyebrow={t('People')}
        title={t('Skills')}
        description={t('Who is signed off on what, and where the workshop is one person deep')}
      />

      {error ? (
        <Alert tone="danger" title={t('That did not work')} className="mb-5">
          {t(error)}
        </Alert>
      ) : null}

      <StatRow className="mb-5">
        <StatTile
          label={t('Skills')}
          value={matrix.skills.length}
          note={t('In this workshop’s own words')}
        />
        <StatTile label={t('People')} value={matrix.rows.length} note={t('Currently employed')} />
        <StatTile
          label={t('One person deep')}
          value={singlePoints.length}
          tone={singlePoints.length > 0 ? 'warning' : 'neutral'}
          note={t('Lost the day they are ill')}
        />
        <StatTile
          label={t('Nobody at all')}
          value={uncovered.length}
          tone={uncovered.length > 0 ? 'danger' : 'neutral'}
          note={t('Work that has to go out')}
        />
      </StatRow>

      {singlePoints.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {singlePoints.length === 1
                ? t('1 skill rests on one person.')
                : t('{count} skills rest on one person.', { count: singlePoints.length })}
            </strong>{' '}
            {singlePoints
              .map((skill) =>
                t('{skill} is only {person}', { skill: skill.name, person: skill.only ?? '' }),
              )
              .join('; ')}
            .{' '}
            {t(
              'That is not a problem today. It is a problem on the day they are ill and three cars are booked in for it.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title={t('The matrix')}
          description={t(
            'Every skill keeps its column even when nobody has it. The blanks are the point.',
          )}
        />
        {matrix.rows.length === 0 || matrix.skills.length === 0 ? (
          <EmptyState
            title={t('Nothing recorded yet')}
            description={t(
              'Add the kinds of work this workshop does, then sign people off on them. Scheduling will not give somebody work they are not signed off on.',
            )}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Person')}</Th>
                  {matrix.skills.map((skill) => (
                    <Th key={skill.skillId}>
                      {skill.name}
                      <span className="block text-[11px] font-normal text-(--text-faint)">
                        {skill.cover === 0
                          ? t('nobody')
                          : skill.cover === 1
                            ? t('one person')
                            : t('{count} people', { count: skill.cover })}
                      </span>
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <Tr key={row.employeeId}>
                    <Td>
                      <span className="font-medium">{row.name}</span>
                      <span className="block text-[11px] text-(--text-faint)">
                        {matrix.titles.get(row.employeeId) ?? ''}
                      </span>
                    </Td>
                    {matrix.skills.map((skill, column) => {
                      const level = row.levels[column];

                      return (
                        <Td key={skill.skillId}>
                          <form action={sign} className="flex items-center gap-1">
                            <input type="hidden" name="employeeId" value={row.employeeId} />
                            <input type="hidden" name="skillId" value={skill.skillId} />
                            <Select
                              name="level"
                              defaultValue={level ?? ''}
                              aria-label={`${row.name}, ${skill.name}`}
                              className="text-[12px]"
                            >
                              <option value="">—</option>
                              {LEVELS.map((entry) => (
                                <option key={entry.value} value={entry.value}>
                                  {t(entry.label)}
                                </option>
                              ))}
                            </Select>
                            <Button type="submit" size="sm" variant="secondary">
                              {t('Save')}
                            </Button>
                          </form>
                          {level ? (
                            <Badge tone={TONE[level]} size="sm" className="mt-1">
                              {t(level.toLowerCase())}
                            </Badge>
                          ) : null}
                        </Td>
                      );
                    })}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader
          title={t('Add a skill')}
          description={t(
            'Named by this workshop. A truck garage and a tyre bay do not share a vocabulary.',
          )}
        />
        <form action={create}>
          <CardBody className="grid gap-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
            <Field label={t('Name')}>
              <Input name="name" required placeholder={t('MOT testing')} />
            </Field>
            <Field
              label={t('What it covers')}
              hint={t('Optional. Shown under the column heading.')}
            >
              <Input name="note" placeholder={t('Class 4 and class 7')} />
            </Field>
            <Button type="submit" variant="primary">
              {t('Add')}
            </Button>
          </CardBody>
        </form>
      </Card>
    </>
  );
}
