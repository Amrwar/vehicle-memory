'use client';

import { Button } from '@carnet/ui';
import { useFormStatus } from 'react-dom';

import { useT } from '@/components/language-provider';

/**
 * A submit button that stops being one while the form is in flight. FR-7801.
 *
 * The first line of defence against a double-click, and deliberately only the
 * first: a button is a courtesy, not a guarantee. Somebody on a slow
 * connection presses twice because nothing appeared to happen, and that is a
 * reasonable thing for a person to do; the server has to be safe about it
 * whatever the button did. Every write this button sits above is also
 * declared in the register at docs/04-engineering/09-repeating-a-write.md,
 * and the ones that would do real damage are held off in the database rather
 * than in the browser.
 *
 * What it adds is honesty on screen. A button that goes quiet and says it is
 * working stops the second press being attempted at all, which is better for
 * everybody than absorbing it afterwards and explaining later.
 */
export function SubmitOnce({
  children,
  busy,
  variant = 'primary',
  size,
  block,
  className,
}: {
  children: React.ReactNode;
  /** What it says while the form is in flight. Defaults to "Working…". */
  busy?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'touch';
  block?: boolean;
  className?: string;
}) {
  const t = useT();
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      block={block}
      className={className}
      disabled={pending}
      // Read out rather than shown: somebody using a screen reader gets the
      // same "it is working" the sighted person gets from the label change.
      aria-busy={pending}
      aria-disabled={pending}
    >
      {pending ? (busy ?? t('Working…')) : children}
    </Button>
  );
}
