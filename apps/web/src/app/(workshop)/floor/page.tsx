import {
  Badge,
  Button,
  Card,
  CardBody,
  PageHeader,
  Registration,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { floorNow } from '@/lib/diary';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'The floor' };
export const dynamic = 'force-dynamic';

/**
 * Where every car is, right now. FR-2905.
 *
 * A workshop's own answer to "where is that car" is to walk out and look, and
 * the screen version is only worth having if it says the same thing. So this
 * is what is in each bay at this minute, not what is booked into it today.
 * The diary already answers the second question and answers it better.
 *
 * Laid out as the bays are laid out, in a row, because that is how somebody
 * standing at the counter pictures the building.
 */
function until(end: Date, now: Date): string {
  const minutes = Math.round((end.getTime() - now.getTime()) / 60_000);

  if (minutes <= 0) return 'over its time';
  if (minutes < 60) return `${minutes} min left`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours}h left` : `${hours}h ${rest}m left`;
}

export default async function FloorPage() {
  const { orgId } = await requireSession('diary:read');

  const now = new Date();
  const floor = await floorNow(orgId, now);

  const busy = floor.filter((bay) => bay.occupant);
  const overrunning = busy.filter((bay) => bay.occupant!.endAt <= now);

  return (
    <>
      <PageHeader
        eyebrow="Workshop"
        title="The floor"
        description={`As at ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
        actions={
          <Link href="/diary">
            <Button size="sm" variant="secondary">
              The diary
            </Button>
          </Link>
        }
      />

      <StatRow className="mb-5">
        <StatTile label="Bays" value={floor.length} note="In this workshop" />
        <StatTile
          label="Occupied"
          value={busy.length}
          tone={busy.length === floor.length && floor.length > 0 ? 'warning' : 'brand'}
          note={busy.length === floor.length && floor.length > 0 ? 'Nothing free' : 'Cars in bays'}
        />
        <StatTile
          label="Over their time"
          value={overrunning.length}
          tone={overrunning.length > 0 ? 'danger' : 'neutral'}
          note="Still in the bay past the slot"
        />
        <StatTile label="Free" value={floor.length - busy.length} note="Ready for the next one" />
      </StatRow>

      {floor.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center">
            <p className="font-display text-[17px] font-semibold">No bays set up</p>
            <p className="mt-1.5 text-[13px] text-(--text-soft)">
              Add bays in settings and the floor appears here.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {floor.map((bay) => {
            const car = bay.occupant;
            const late = Boolean(car && car.endAt <= now);

            return (
              <Card
                key={bay.bayId}
                className={
                  late ? 'border-(--danger)' : car ? 'border-(--brand)' : 'border-(--border)'
                }
              >
                <CardBody className="grid min-h-44 gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-display text-[15px] font-semibold">{bay.name}</h2>
                    {car ? (
                      <Badge tone={late ? 'danger' : 'brand'} size="sm" dot>
                        {late ? 'over' : 'in use'}
                      </Badge>
                    ) : (
                      <Badge tone="success" size="sm">
                        free
                      </Badge>
                    )}
                  </div>

                  {car ? (
                    <div className="grid gap-1.5">
                      <Link
                        href={`/bookings/${car.id}`}
                        className="font-display text-[16px] font-semibold leading-snug hover:text-(--brand-text) hover:underline"
                      >
                        {car.title}
                      </Link>

                      {car.registration ? <Registration value={car.registration} /> : null}

                      <p className="text-[12px] text-(--text-soft)">{car.subtitle}</p>

                      <p
                        className={
                          late
                            ? 'text-[12px] font-medium text-(--danger)'
                            : 'text-[12px] text-(--text-faint)'
                        }
                      >
                        {until(car.endAt, now)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-(--text-faint)">Empty.</p>
                  )}

                  {bay.upcoming.length > 0 ? (
                    <div className="mt-auto border-t border-(--border) pt-2">
                      <p className="text-[11px] text-(--text-faint)">
                        Next:{' '}
                        {bay.upcoming[0]!.startAt.toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        {bay.upcoming[0]!.title}
                        {bay.upcoming.length > 1 ? ` and ${bay.upcoming.length - 1} more` : ''}
                      </p>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
