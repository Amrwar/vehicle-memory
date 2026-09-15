/**
 * Reading a CSV somebody else wrote. Phase 33.
 *
 * RFC 4180 with the tolerances real exports need: a byte-order mark, either
 * line ending, quoted fields with doubled quotes and embedded newlines, a
 * semicolon or a tab where a European spreadsheet used one, and trailing
 * empty lines. It does not guess types; every cell is a string, and the
 * dataset's rules decide what it means.
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

const CANDIDATES = [',', ';', '\t', '|'];

/** The delimiter that splits the first line into the most fields, ties to the comma. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  let best = ',';
  let most = -1;
  for (const candidate of CANDIDATES) {
    const count = splitLine(first, candidate).length;
    if (count > most) {
      most = count;
      best = candidate;
    }
  }
  return best;
}

function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

export function parseCsv(input: string, delimiter?: string): ParsedCsv {
  const text = input.replace(/^\uFEFF/, '');
  const sep = delimiter ?? detectDelimiter(text);
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const kept = records.filter((r) => r.some((cell) => cell.trim() !== ''));
  const headers = (kept.shift() ?? []).map((h) => h.trim());
  const width = headers.length;
  const rows = kept.map((r) => {
    const cells = r.map((c) => c.trim());
    while (cells.length < width) cells.push('');
    return cells.slice(0, width);
  });
  return { headers, rows, delimiter: sep };
}
