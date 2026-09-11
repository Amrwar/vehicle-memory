import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'No signal' };

/**
 * What the service worker falls back to when a page has never been opened on
 * this device before. FR-3504.
 *
 * Deliberately plain and deliberately honest. It says what is missing and what
 * still works, because somebody under a car needs to know whether to walk
 * outside or carry on.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-5 py-12">
      <p className="text-[12px] font-medium tracking-wide text-(--brand-text) uppercase">Carnet</p>
      <h1 className="font-display text-[24px] leading-tight font-semibold">No signal</h1>
      <p className="text-[15px] leading-relaxed text-(--text-soft)">
        This page has not been opened on this device before, so there is nothing saved to show you.
      </p>
      <p className="text-[15px] leading-relaxed text-(--text-soft)">
        Your jobs, your clock and any inspection you have already opened still work. Anything you
        record is kept on the device and sent the moment there is a signal.
      </p>
      <a
        href="/shop"
        className="mt-2 inline-block min-h-[48px] rounded-(--radius) border border-(--border) px-4 py-3 text-center text-[15px] font-medium"
      >
        Back to my jobs
      </a>
    </main>
  );
}
