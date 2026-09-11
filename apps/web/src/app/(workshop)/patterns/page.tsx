import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Weekday } from '@carnet/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/guard';
import { patternsFor, setPattern } from '@/lib/planning';

export const metadata: Metadata = { title: 'Working hours' };
export const dynamic = 'force-dynamic';

/**
 * When people are contracted to be here. FR-3302.
 *
 * This replaces a single number typed on a site record, which every capacity
 * figure in the product has been standing on since Phase 1. It knew nothing
 * about part-time hours, nothing about the apprentice at college on Fridays,
 * and nothing about anybody's holiday.
 *
 * A weekday with no hours is a day somebody is not in, and the row is deleted
 * rather than stored as zero to zero. The database refuses the second form
 * outright, which is the right place for that rule to live: the figure it
 * feeds is what a customer gets promised.
 */
const DAYS: { weekday: Weekday; label: string; short: string }[] = [
  { weekday: 1, label: 'Monday', short: 'Mon' },
  { weekday: 2, label: 'Tuesday', short: 'Tue' },
  { weekday: 3, label: 'Wednesday', short: 'Wed' },
  { weekday: 4, label: 'Thursday', short: 'Thu' },
  { weekday: 5, label: 'Friday', short: 'Fri' },
  { weekday: 6, label: 'Saturday', short: 'Sat' },
  { weekday: 7, label: 'Sunday', short: 'Sun' },
];

/** Minutes from midnight as the value an `<input type="time">` wants. */
function toTime(minutes: number | null | undefined): string {
  if (minutes == null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function fromTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

async function save(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('people:write');

  const start = fromTime(String(formData.get('start') ?? ''));
  const end = fromTime(String(formData.get('end') ?? ''));
  const breakMinutes = Number(String(formData.get('break') ?? '0')) || 0;

  await setPattern({
    orgId,
    userId: user.userId,
    employeeId: String(formData.get('employeeId') ?? ''),
    weekday: Number(String(formData.get('weekday') ?? '1')) as Weekday,
    // Either both or neither. A start with no end is not a shift, and
    // guessing the missing half would put hours on the board nobody agreed to.
    startMinute: start !== null && end !== null ? start : null,
    endMinute: start !== null && end !== null ? end : null,
    breakMinutes,
  });

  redirect('/patterns');
}

export default async function PatternsPage() {
  const { orgId } = await requireSession('people:read');

  const people = await patternsFor(orgId);

  // A new workshop has people and no hours, which is a different state from
  // having no people, and the page has to say which. Being silent about it
  // leaves capacity reading zero with nothing to explain why.
  const nobodyHasHours = people.every((person) => person.week.every((day) => day === null));

  const weekMinutes = (week: (typeof people)[number]['week']) =>
    week.reduce(
      (total, day) =>
        total + (day ? Math.max(0, day.endMinute - day.startMinute - day.breakMinutes) : 0),
      0,
    );

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Working hours"
        description="When each person is contracted to be here, which is what capacity is worked out from"
      />

      <Card className="mb-5">
        <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
          Leave a day blank and it means somebody is not in. Approved holiday comes off on top of
          this automatically, so a week off does not need editing here and putting back afterwards.{' '}
          <Link href="/capacity" className="font-medium text-(--brand-text) hover:underline">
            Capacity
          </Link>{' '}
          shows what these hours add up to.
        </CardBody>
      </Card>

      {people.length > 0 && nobodyHasHours ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">Nobody has working hours recorded yet.</strong> Until
            they do, capacity reads as nought and the day cannot be planned, because there is
            nothing to plan it against. Fill in one person and it starts working.
          </CardBody>
        </Card>
      ) : null}

      {people.length === 0 ? (
        <EmptyState
          title="Nobody on the books"
          description="Working hours belong to employees. Add people first and they appear here."
          action={
            <Link
              href="/people"
              className="text-[13px] font-medium text-(--brand-text) hover:underline"
            >
              The team
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {people.map((person) => (
            <Card key={person.employeeId} className="overflow-hidden">
              <CardHeader
                title={person.name}
                description={`${person.jobTitle ?? 'No job title'} · ${(weekMinutes(person.week) / 60).toFixed(1)} hours a week`}
              />
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Day</Th>
                      <Th>From</Th>
                      <Th>To</Th>
                      <Th>Break</Th>
                      <Th> </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => {
                      const pattern = person.week[day.weekday - 1];

                      return (
                        <Tr key={day.weekday}>
                          <Td className="font-medium">{day.label}</Td>
                          <Td colSpan={4}>
                            <form action={save} className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="employeeId" value={person.employeeId} />
                              <input type="hidden" name="weekday" value={day.weekday} />
                              <Input
                                type="time"
                                name="start"
                                defaultValue={toTime(pattern?.startMinute)}
                                aria-label={`${person.name}, ${day.label}, from`}
                                className="w-28"
                              />
                              <Input
                                type="time"
                                name="end"
                                defaultValue={toTime(pattern?.endMinute)}
                                aria-label={`${person.name}, ${day.label}, to`}
                                className="w-28"
                              />
                              <Input
                                type="number"
                                name="break"
                                min={0}
                                step={5}
                                defaultValue={pattern?.breakMinutes ?? 0}
                                aria-label={`${person.name}, ${day.label}, break in minutes`}
                                className="w-24"
                              />
                              <Button type="submit" size="sm" variant="secondary">
                                Save
                              </Button>
                            </form>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
