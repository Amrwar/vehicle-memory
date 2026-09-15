import { describe, expect, it } from 'vitest';

import {
  checkWalk,
  handoffNamed,
  pressesBefore,
  pressesFor,
  WORKFLOWS,
  workflowById,
  workflowsAsMarkdown,
} from './workflow';

describe('the five workflows, counted', () => {
  it('has five workflows and every hand-off names one screen', () => {
    expect(WORKFLOWS).toHaveLength(5);
    for (const workflow of WORKFLOWS) {
      expect(workflow.handoffs.length).toBeGreaterThan(0);
      for (const step of workflow.handoffs) {
        expect(step.screen).toBeTruthy();
        expect(step.presses).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never costs more presses now than it did before', () => {
    for (const workflow of WORKFLOWS) {
      expect(pressesFor(workflow)).toBeLessThanOrEqual(pressesBefore(workflow));
      for (const step of workflow.handoffs) expect(step.presses).toBeLessThanOrEqual(step.before);
    }
  });

  it('halves the work between arriving and paid', () => {
    const arrives = workflowById('arrives');
    const needsWork = workflowById('needs-work');
    const completed = workflowById('completed');
    const before = pressesBefore(arrives) + pressesBefore(needsWork) + pressesBefore(completed);
    const now = pressesFor(arrives) + pressesFor(needsWork) + pressesFor(completed);
    expect(now * 2).toBeLessThanOrEqual(before);
  });

  it('keeps the whole of a job on the job screen until the invoice', () => {
    const needsWork = workflowById('needs-work');
    const desk = needsWork.handoffs.filter((step) => step.screen !== 'customer phone');
    for (const step of desk) expect(['job', 'tablet']).toContain(step.screen);
  });

  it('names hand-offs uniquely', () => {
    const names = WORKFLOWS.flatMap((w) => w.handoffs.map((h) => h.name));
    expect(new Set(names).size).toBe(names.length);
    expect(handoffNamed('Extra work found mid-job').presses).toBe(1);
    expect(() => handoffNamed('nothing of the sort')).toThrow();
  });

  it('checks a walk against the budget', () => {
    expect(
      checkWalk([
        { handoff: 'Booking to job, at the desk', screen: 'booking', presses: 1 },
        { handoff: 'Approval to a job with the work on it', screen: 'job', presses: 0 },
      ]),
    ).toEqual([]);

    const breaches = checkWalk([
      { handoff: 'Booking to job, at the desk', screen: 'job', presses: 3 },
      { handoff: 'Made up', screen: 'job', presses: 0 },
    ]);
    expect(breaches.map((b) => b.reason)).toEqual([
      'over budget',
      'second screen',
      'unknown hand-off',
    ]);
  });

  it('writes itself down as a table', () => {
    const md = workflowsAsMarkdown();
    expect(md).toContain('### The vehicle needs work');
    expect(md).toContain('| Extra work found mid-job | job | 7 | 1 |');
    expect(md).toContain('**Whole workflow**');
  });
});
