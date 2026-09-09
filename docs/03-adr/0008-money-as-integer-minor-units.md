# ADR-0008: Money as integer minor units

**Status:** Accepted
**Date:** 2026-09-09

## Context

This system prices jobs, computes tax per line, splits discounts across lines,
posts double-entry journals that must balance exactly, and distributes a
revenue share across contributing workshops.

Floating point cannot do any of that reliably. `0.1 + 0.2 !== 0.3`, and an
invoice that is a penny out is a defect the bookkeeper will find, will not
forget, and will reasonably take as evidence that the ledger cannot be trusted.

## Decision

Money is an integer number of minor units with an explicit currency:
`{ minor: 140800, currency: 'GBP' }` is 1,408.00.

- No floating-point arithmetic anywhere in the money path.
- Rounding is half away from zero, which is what tax authorities and
  accountants expect. Banker's rounding is defensible statistically and
  indefensible when a customer checks the arithmetic at the counter.
- Currencies with zero or three minor digits (JPY, KWD) are handled by a scale
  table, not by assuming two.
- Allocation preserves totals exactly: splitting 100p three ways yields
  34/33/33, never 33/33/33 with a lost penny.
- Persisted as PostgreSQL `NUMERIC`, never `float8` or `double precision`.

**Tax is computed per line and then summed**, never by applying a rate to the
subtotal. A document mixing 20% VAT parts with a zero-rated fee gives different
answers each way, and only the per-line answer is correct.

**Each line is rounded before summing.** Summing unrounded values and rounding
once produces a total that does not equal the sum of the printed lines. A
customer adding up the invoice by hand must reach the printed total.

## Alternatives considered

| Option | Why not |
| --- | --- |
| **JavaScript `number` for currency** | Wrong, and the failure is intermittent and looks like a rounding preference rather than a bug. |
| **decimal.js or big.js** | Correct, and a reasonable choice. Rejected because integer minor units are simpler, faster, allocate no objects per operation, and make the rounding decision explicit at every point rather than configured once and forgotten. |
| **Prisma `Decimal` throughout the domain** | Would import an ORM type into the framework-free domain layer, violating ADR-0003. Decimals are converted at the boundary. |

## Consequences

- Conversion at every boundary: Prisma `Decimal` to `Money` on read, back on
  write. This is deliberate friction at the exact point where a mistake would
  otherwise be invisible.
- Property-tested: allocation always sums to the original, in both signs.
- The largest representable amount is bounded by `Number.MAX_SAFE_INTEGER`,
  which is about 90 trillion pence. Sufficient, and asserted on construction.
