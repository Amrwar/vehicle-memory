/**
 * Belonging to more than one workshop. Phase 63. FR-108.
 *
 * A contractor services two garages on alternate days. A bookkeeper keeps the
 * books for four. An owner opens a second site under a separate company. All
 * three are one person with two or more memberships, and the schema has
 * allowed it since the first month: `acceptInvitation` attaches an existing
 * account to a new organisation without complaint.
 *
 * What did not exist was any way to say which one you are in. `currentUser()`
 * read the organisation off the session and, when that did not match an active
 * membership, fell back to `memberships[0]` — an arbitrary row, in whatever
 * order Postgres returned it. So the second workshop was reachable only by
 * luck, and which one you landed in was not a decision anybody made.
 *
 * The requirement is one sentence and the second half is the hard half: a
 * person MAY belong to more than one organisation and MUST switch between them
 * **explicitly**. Explicit rules out the convenient behaviours:
 *
 *   Not "whichever they used last" decided by a query with no ORDER BY.
 *   Not "the first one" — first by what?
 *   Not "whichever the URL implies", because then a link is a tenant switch
 *     and every link somebody is sent becomes one.
 *
 * A silent switch is worse than an error message. A technician who types a
 * customer's telephone number into the wrong workshop has not lost data; they
 * have put one workshop's customer into another workshop's records, which is
 * the thing this product must never do.
 *
 * So: no organisation at all until a person chooses one, except in the case
 * where there is nothing to choose between. One active membership is not a
 * choice, and stopping to ask about it would be ceremony rather than consent.
 */

import type { Role } from './roles';

export interface Belonging {
  orgId: string;
  orgName: string;
  role: Role;
  /** False for somebody who has left or been taken off. */
  isActive: boolean;
}

/**
 * Which organisation a person is put into when they sign in.
 *
 * Null means "ask them". The caller leaves the session with no organisation,
 * and the guard sends them to choose — which is a different state from a
 * portal customer with no memberships at all, and has to stay different.
 */
export function orgOnSignIn(belongings: readonly Belonging[]): string | null {
  const active = belongings.filter((one) => one.isActive);
  return active.length === 1 ? active[0]!.orgId : null;
}

/** Whether a person must be asked, rather than placed. */
export function mustChoose(belongings: readonly Belonging[]): boolean {
  return belongings.filter((one) => one.isActive).length > 1;
}

/**
 * Whether this person may act in this organisation, right now.
 *
 * The answer is used both to let somebody in and to keep them in: a session
 * carrying an organisation the person has since been taken off must stop
 * working at the next request, not at the next sign-in.
 */
export function mayEnter(belongings: readonly Belonging[], orgId: string): boolean {
  return belongings.some((one) => one.orgId === orgId && one.isActive);
}

/**
 * The membership a request acts under — or null, which means the person is
 * signed in and in no organisation, and must choose one.
 *
 * There is deliberately no fallback. A fallback here is a silent switch, and
 * the whole requirement is that there are none.
 */
export function actingAs(
  belongings: readonly Belonging[],
  sessionOrgId: string | null,
): Belonging | null {
  if (!sessionOrgId) return null;
  return belongings.find((one) => one.orgId === sessionOrgId && one.isActive) ?? null;
}

/**
 * Which sessions end when somebody is taken off a workshop's team.
 *
 * Sessions are per person, and until Phase 63 taking somebody off ended every
 * one of them. With one membership each that was indistinguishable from
 * correct. With two it is a workshop reaching into another workshop and
 * signing somebody out of it — a side effect on a tenant the actor has no
 * relationship with, which is the worst category of defect this product has.
 *
 * Only the sessions actually in that organisation end. A session with no
 * organisation at all is somebody sitting on the chooser; it belongs to
 * nobody's workshop and is left alone.
 */
export function sessionsEndedByLeaving(
  sessions: readonly { id: string; orgId: string | null }[],
  orgId: string,
): string[] {
  return sessions.filter((one) => one.orgId === orgId).map((one) => one.id);
}

/**
 * What the chooser says, given how many there are.
 *
 * Written as a sentence rather than a count because "1 workshops" is the sort
 * of thing that survives to a pilot.
 */
export function describeChoice(belongings: readonly Belonging[]): string {
  const active = belongings.filter((one) => one.isActive);

  if (active.length === 0) return 'You are not on any workshop’s team.';
  if (active.length === 1) return `You work at ${active[0]!.orgName}.`;
  if (active.length === 2) {
    return `You work at ${active[0]!.orgName} and ${active[1]!.orgName}. Choose which one you are in.`;
  }
  return `You work at ${active.length} workshops. Choose which one you are in.`;
}

/**
 * The refusal, when somebody asks for an organisation that is not theirs.
 *
 * One sentence for every reason: not a member, membership ended, no such
 * organisation. A refusal that distinguishes them confirms an organisation
 * exists to somebody who has no business knowing, which is the same leak the
 * security model insists on 404 for elsewhere.
 */
export const NOT_YOURS = 'That is not a workshop you work at.';
