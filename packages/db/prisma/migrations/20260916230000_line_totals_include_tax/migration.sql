-- A line's total includes its tax. Phase 47.
--
-- Everywhere the application writes an invoice line it stores the total after
-- tax: issueInvoice saves `taxOnLine(...).total`, and the revenue split reads
-- `lineTotal - taxAmount` to recover the net. The seed wrote the net figure
-- into the same column, so on any workshop built from the seed every report
-- that splits revenue by kind understated it by exactly the tax.
--
-- Nobody would have noticed from the invoice, which carries its own subtotal
-- and total and was right all along. It shows up only when the figures are
-- recomputed from the rows underneath them, which is what the books audit does
-- and why it exists.
--
-- Rows written by the application are already tax-inclusive and are left
-- alone: a line is repaired only where it is exactly its own net figure while
-- carrying a tax amount, which is the signature of the older spelling.

UPDATE "invoice_lines"
SET "lineTotal" = ROUND("lineTotal" + "taxAmount", 2)
WHERE "taxAmount" > 0
  AND "lineTotal" > 0
  -- The line still reads as net: its total has no tax in it.
  AND ROUND("lineTotal" * (1 + ("taxAmount" / "lineTotal")), 2) = ROUND("lineTotal" + "taxAmount", 2)
  AND EXISTS (
    SELECT 1 FROM "invoices" i
    WHERE i."id" = "invoice_lines"."invoiceId"
      -- Only where the invoice's own total agrees with the net reading, so a
      -- line that was already correct is never touched.
      AND ROUND(i."subtotal", 2) = (
        SELECT ROUND(SUM(l."lineTotal"), 2)
        FROM "invoice_lines" l
        WHERE l."invoiceId" = i."id"
      )
  );
