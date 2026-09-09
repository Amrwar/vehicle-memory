import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './cn';

/* ===========================================================================
   Button
   =========================================================================== */

const button = cva(
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap ' +
    'transition-colors select-none ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Solid tokens, not the ink tokens: a button surface and a
        // brand-coloured icon have opposite contrast needs, and one value
        // cannot serve both across two themes.
        primary:
          'bg-(--brand-solid) text-(--on-brand-solid) hover:bg-(--brand-solid-hover) ' +
          'shadow-sm',
        secondary:
          'bg-(--surface) text-(--text) border border-(--border-strong) ' +
          'hover:bg-(--surface-sunk) hover:border-(--text-faint)',
        ghost: 'text-(--text-soft) hover:bg-(--surface-sunk) hover:text-(--text)',
        // White holds contrast on the danger colour in both themes.
        danger: 'bg-(--danger) text-white hover:brightness-110 shadow-sm',
        accent:
          'bg-(--accent-solid) text-(--on-accent-solid) hover:bg-(--accent-solid-hover) shadow-sm',
        link: 'text-(--brand-text) underline underline-offset-2 hover:opacity-80',
      },
      size: {
        sm: 'h-8 px-2.5 text-[13px] rounded-(--radius-sm)',
        md: 'h-9 px-3.5 text-[13px] rounded-(--radius-md)',
        lg: 'h-11 px-5 text-[15px] rounded-(--radius-md)',
        /* Shop floor: 48px minimum, gloves on. NFR-605. */
        touch: 'min-h-(--touch) px-5 text-[15px] rounded-(--radius-md)',
        icon: 'h-9 w-9 rounded-(--radius-md)',
        'icon-touch': 'h-(--touch) w-(--touch) rounded-(--radius-md)',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'secondary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(button({ variant, size, block }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

/* ===========================================================================
   Badge

   Every badge carries a label. Colour never conveys meaning alone (NFR-603).
   =========================================================================== */

const badge = cva(
  'inline-flex items-center gap-1.5 font-medium whitespace-nowrap ' +
    'rounded-(--radius-xs) border',
  {
    variants: {
      tone: {
        neutral: 'bg-(--surface-sunk) text-(--text-soft) border-(--border)',
        brand: 'bg-(--brand-soft) text-(--brand-text) border-(--brand-soft)',
        accent: 'bg-(--accent-soft) text-(--accent-text) border-(--accent-soft)',
        success: 'bg-(--success-soft) text-(--success) border-(--success-soft)',
        warning: 'bg-(--warning-soft) text-(--warning) border-(--warning-soft)',
        danger: 'bg-(--danger-soft) text-(--danger) border-(--danger-soft)',
        info: 'bg-(--info-soft) text-(--info) border-(--info-soft)',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[10px] tracking-wide uppercase font-mono',
        md: 'px-2 py-0.5 text-[12px]',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {
  /** Small leading dot, for statuses read at a glance across a list. */
  dot?: boolean;
}

export function Badge({ className, tone, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badge({ tone, size }), className)} {...props}>
      {dot ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" /> : null}
      {children}
    </span>
  );
}

/* ===========================================================================
   Surfaces

   Border first, shadow only where something genuinely lifts off the page.
   Not everything is a card.
   =========================================================================== */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-(--surface) border border-(--border) rounded-(--radius-lg)', className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  title,
  action,
  description,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 px-4 py-3 border-b border-(--border)',
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {title ? (
          <h2 className="text-[15px] font-semibold leading-tight truncate">{title}</h2>
        ) : null}
        {description ? (
          <p className="text-[12px] text-(--text-faint) mt-0.5">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

/* ===========================================================================
   Form controls
   =========================================================================== */

const control =
  'w-full bg-(--surface) text-(--text) border border-(--border-strong) ' +
  'rounded-(--radius-md) px-3 text-[13px] placeholder:text-(--text-faint) ' +
  'transition-colors focus:border-(--brand) disabled:opacity-60 ' +
  'disabled:bg-(--surface-sunk)';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; touch?: boolean }
>(({ className, invalid, touch, ...props }, ref) => (
  <input
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      control,
      touch ? 'min-h-(--touch) text-[15px]' : 'h-9',
      invalid && 'border-(--danger)',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    aria-invalid={invalid || undefined}
    className={cn(control, 'py-2 leading-relaxed', invalid && 'border-(--danger)', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { touch?: boolean }
>(({ className, touch, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(control, touch ? 'min-h-(--touch) text-[15px]' : 'h-9', 'pr-8', className)}
    {...props}
  />
));
Select.displayName = 'Select';

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-(--text-soft)">
        {label}
        {required ? (
          <span className="text-(--danger) ml-0.5" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-(--danger)">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-(--text-faint)">{hint}</p>
      ) : null}
    </div>
  );
}

/* ===========================================================================
   Feedback
   =========================================================================== */

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'bg-(--info-soft) border-(--info) text-(--info)',
    success: 'bg-(--success-soft) border-(--success) text-(--success)',
    warning: 'bg-(--warning-soft) border-(--warning) text-(--warning)',
    danger: 'bg-(--danger-soft) border-(--danger) text-(--danger)',
  } as const;

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'border-l-[3px] rounded-r-(--radius-sm) px-3.5 py-2.5 text-[13px]',
        tones[tone],
        className,
      )}
    >
      {title ? <p className="font-semibold mb-0.5">{title}</p> : null}
      {children ? <div className="text-(--text-soft)">{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('text-center px-6 py-12', className)}>
      <p className="font-display text-[15px] font-semibold">{title}</p>
      {description ? (
        <p className="text-[13px] text-(--text-faint) mt-1 max-w-sm mx-auto">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ===========================================================================
   Layout helpers
   =========================================================================== */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-3 pb-4 mb-5 border-b border-(--border)',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="text-[22px] font-semibold leading-tight">{title}</h1>
        {description ? <p className="text-[13px] text-(--text-faint) mt-1">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-(--border)', className)} />;
}
