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
import type { SkillLevel } from '@carnet/core';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/guard';
import { addSkill, matrixFor, setSkill } from '@/lib/planning';

export const metadata: Metadata = { title: 'Skills' };
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
  { value: 'LEARNING', label: 'Learning' },
  { value: 'COMPETENT', label: 'Competent' },
  { value: 'EXPERT', label: 'Expert' },
];

const TONE = { LEARNING: 'warning', COMPETENT: 'brand', EXPERT: 'success' } as const;

async function create(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('people:write');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/skills?error=' + encodeURIComponent('A skill needs a name.'));

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

  const matrix = await matrixFor(orgId);

  const singlePoints = matrix.skills.filter((skill) => skill.only !== null);
  const uncovered = matrix.skills.filter((skill) => skill.cover === 0);

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Skills"
        description="Who is signed off on what, and where the workshop is one person deep"
      />

      {error ? (
        <Alert tone="danger" title="That did not work" className="mb-5">
          {error}
        </Alert>
      ) : null}

      <StatRow className="mb-5">
        <StatTile label="Skills" value={matrix.skills.length} note="In this workshop's own words" />
        <StatTile label="People" value={matrix.rows.length} note="Currently employed" />
        <StatTile
          label="One person deep"
          value={singlePoints.length}
          tone={singlePoints.length > 0 ? 'warning' : 'neutral'}
          note="Lost the day they are ill"
        />
        <StatTile
          label="Nobody at all"
          value={uncovered.length}
          tone={uncovered.length > 0 ? 'danger' : 'neutral'}
          note="Work that has to go out"
        />
      </StatRow>

      {singlePoints.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {singlePoints.length} skill{singlePoints.length === 1 ? '' : 's'} rest on one person.
            </strong>{' '}
            {singlePoints.map((skill) => `${skill.name} is only ${skill.only}`).join('; ')}. That is
            not a problem today. It is a problem on the day they are ill and three cars are booked
            in for it.
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title="The matrix"
          description="Every skill keeps its column even when nobody has it. The blanks are the point."
        />
        {matrix.rows.length === 0 || matrix.skills.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            description="Add the kinds of work this workshop does, then sign people off on them. Scheduling will not give somebody work they are not signed off on."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Person</Th>
                  {matrix.skills.map((skill) => (
                    <Th key={skill.skillId}>
                      {skill.name}
                      <span className="block text-[10px] font-normal text-(--text-faint)">
                        {skill.cover === 0
                          ? 'nobody'
                          : skill.cover === 1
                            ? 'one person'
                            : `${skill.cover} people`}
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
                                  {entry.label}
                                </option>
                              ))}
                            </Select>
                            <Button type="submit" size="sm" variant="secondary">
                              Save
                            </Button>
                          </form>
                          {level ? (
                            <Badge tone={TONE[level]} size="sm" className="mt-1">
                              {level.toLowerCase()}
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
          title="Add a skill"
          description="Named by this workshop. A truck garage and a tyre bay do not share a vocabulary."
        />
        <form action={create}>
          <CardBody className="grid gap-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
            <Field label="Name">
              <Input name="name" required placeholder="MOT testing" />
            </Field>
            <Field label="What it covers" hint="Optional. Shown under the column heading.">
              <Input name="note" placeholder="Class 4 and class 7" />
            </Field>
            <Button type="submit" variant="primary">
              Add
            </Button>
          </CardBody>
        </form>
      </Card>
    </>
  );
}
