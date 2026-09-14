'use client';

import * as React from 'react';

/**
 * The diary you can pick things up in.
 *
 * Dragging is not the feature. Being able to move a car without opening a form
 * is the feature, and dragging is only the fastest way to say it on a machine
 * with a mouse. So everything here has a second route: each booking is also a
 * button that opens a move menu, which is what a keyboard, a screen reader and
 * a phone all use. Neither path is the fallback; they are two ways of saying
 * the same sentence.
 *
 * The drop is optimistic in appearance and pessimistic in fact. The card moves
 * the instant it is released, because a diary that pauses on every drag feels
 * broken, and it moves back with the reason attached if the server refuses.
 * Anything else teaches somebody to distrust what they see.
 *
 * The native HTML drag events are used rather than pointer maths. They are
 * ugly and they are what browsers already make accessible, scrollable and
 * cancellable with Escape, none of which is worth rebuilding badly.
 */

export interface BoardBooking {
  id: string;
  title: string;
  subtitle?: string | null;
  registration?: string | null;
  startAt: string;
  hours: number;
  status: string;
}

export interface BoardLane {
  id: string;
  label: string;
  emptyNote: string;
  hours: number;
  bookings: BoardBooking[];
}

export function DiaryBoard({
  lanes,
  laneKind,
  onMove,
  locale = 'en-GB',
}: {
  /** How times are written, from the workshop's region. */
  locale?: string;
  lanes: BoardLane[];
  /** What a lane represents, which is what a drop changes. */
  laneKind: 'bay' | 'technician' | 'none';
  onMove: (bookingId: string, laneId: string) => Promise<{ ok: boolean; reason: string }>;
}) {
  const [board, setBoard] = React.useState(lanes);
  const [held, setHeld] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);

  React.useEffect(() => setBoard(lanes), [lanes]);

  const movable = laneKind !== 'none';

  async function move(bookingId: string, toLane: string) {
    const from = board.find((lane) => lane.bookings.some((entry) => entry.id === bookingId));
    if (!from || from.id === toLane) return;

    const booking = from.bookings.find((entry) => entry.id === bookingId)!;
    const before = board;

    // Moved on screen straight away. A diary that waits on the network before
    // showing the card in its new place feels broken, and people drag twice.
    setBoard((current) =>
      current.map((lane) => {
        if (lane.id === from.id) {
          return {
            ...lane,
            bookings: lane.bookings.filter((entry) => entry.id !== bookingId),
            hours: Math.round((lane.hours - booking.hours) * 10) / 10,
          };
        }

        if (lane.id === toLane) {
          return {
            ...lane,
            bookings: [...lane.bookings, booking].sort((a, b) =>
              a.startAt.localeCompare(b.startAt),
            ),
            hours: Math.round((lane.hours + booking.hours) * 10) / 10,
          };
        }

        return lane;
      }),
    );

    setMenuFor(null);

    const result = await onMove(bookingId, toLane);

    if (!result.ok) {
      // Back where it came from, with the reason. Leaving it in the new place
      // would show a move the database did not make.
      setBoard(before);
      setNotice({ tone: 'bad', text: result.reason });
      return;
    }

    setNotice({ tone: 'good', text: result.reason });
  }

  return (
    <div className="grid gap-3">
      {notice ? (
        <p
          role="status"
          className={
            notice.tone === 'bad'
              ? 'rounded-(--radius-sm) bg-(--danger-soft) px-3 py-2 text-[13px] text-(--danger)'
              : 'rounded-(--radius-sm) bg-(--success-soft) px-3 py-2 text-[13px] text-(--success)'
          }
        >
          {notice.text}
        </p>
      ) : null}

      <div className="scroll-x">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${board.length}, minmax(14rem, 1fr))` }}
        >
          {board.map((lane) => (
            <section
              key={lane.id}
              onDragOver={(event) => {
                if (!movable || !held) return;
                event.preventDefault();
                setOver(lane.id);
              }}
              onDragLeave={() => setOver((current) => (current === lane.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);
                if (held) void move(held, lane.id);
                setHeld(null);
              }}
              className={[
                'rounded-(--radius-lg) border bg-(--surface) p-3 transition-colors',
                over === lane.id ? 'border-(--brand) bg-(--brand-soft)' : 'border-(--border)',
              ].join(' ')}
            >
              <header className="mb-2.5 flex items-baseline justify-between gap-2">
                <h2 className="font-display text-[14px] font-semibold">{lane.label}</h2>
                <span className="text-[11px] tabular-nums text-(--text-faint)">
                  {lane.hours > 0 ? `${lane.hours}h` : ''}
                </span>
              </header>

              {lane.bookings.length === 0 ? (
                <p className="py-3 text-[12px] text-(--text-faint)">{lane.emptyNote}</p>
              ) : (
                <ul className="grid gap-2">
                  {lane.bookings.map((entry) => (
                    <li key={entry.id} className="relative">
                      <div
                        draggable={movable}
                        onDragStart={() => setHeld(entry.id)}
                        onDragEnd={() => {
                          setHeld(null);
                          setOver(null);
                        }}
                        className={[
                          'rounded-(--radius-sm) border border-(--border) bg-(--surface-sunk) p-2.5',
                          movable ? 'cursor-grab active:cursor-grabbing' : '',
                          held === entry.id ? 'opacity-40' : '',
                        ].join(' ')}
                      >
                        <p className="text-[13px] font-medium">{entry.title}</p>
                        <p className="mt-0.5 text-[11px] text-(--text-soft)">
                          {new Date(entry.startAt).toLocaleTimeString(locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {entry.subtitle ? ` · ${entry.subtitle}` : ''}
                        </p>
                        {entry.registration ? (
                          <p className="mt-1 font-mono text-[11px] text-(--text-faint)">
                            {entry.registration}
                          </p>
                        ) : null}

                        {/* The second route. Everything the drag can do, this
                            can do, for a keyboard, a reader or a phone. */}
                        {movable ? (
                          <button
                            type="button"
                            onClick={() =>
                              setMenuFor((current) => (current === entry.id ? null : entry.id))
                            }
                            aria-expanded={menuFor === entry.id}
                            className="mt-2 text-[11px] text-(--brand-text) underline"
                          >
                            Move
                          </button>
                        ) : null}
                      </div>

                      {menuFor === entry.id ? (
                        <ul className="absolute left-0 right-0 top-full z-10 mt-1 grid max-h-56 gap-px overflow-auto rounded-(--radius-sm) border border-(--border) bg-(--surface) p-1 shadow-lg">
                          {board
                            .filter((target) => target.id !== lane.id)
                            .map((target) => (
                              <li key={target.id}>
                                <button
                                  type="button"
                                  onClick={() => void move(entry.id, target.id)}
                                  className="w-full rounded-(--radius-sm) px-2.5 py-2 text-left text-[12px] hover:bg-(--surface-sunk)"
                                >
                                  {target.label}
                                </button>
                              </li>
                            ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>

      {movable ? (
        <p className="text-[12px] text-(--text-faint)">
          Drag a card to another {laneKind === 'bay' ? 'bay' : 'person'}, or use Move on the card. A
          clash is refused and says why.
        </p>
      ) : null}
    </div>
  );
}
