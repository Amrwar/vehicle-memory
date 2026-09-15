/**
 * A document as a PDF. Phase 42.
 *
 * The PDF is the printed page, rendered by a headless browser: the same HTML,
 * the same print stylesheet, the same translation and right-to-left layout.
 * A second layout written for a PDF library would drift from the paper, and
 * no PDF library shapes Arabic the way a browser does.
 *
 * On the server platform the browser comes from @sparticuz/chromium; on a
 * developer's machine from Playwright's own install. When no browser can be
 * started the caller falls back to the print page, so a customer is never
 * left without a document, only without the file.
 */

export interface PdfRequest {
  /** The print page, on this same site. */
  url: string;
  /** The reader's own cookies, so the page is rendered as they would see it. */
  cookies: { name: string; value: string }[];
}

async function launch() {
  // Imported here rather than at the top, so a platform without the browser
  // falls back to the print page instead of failing the route as it loads.
  const { chromium } = await import('playwright-core');
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!serverless) return chromium.launch({ headless: true });
  const { default: packaged } = await import('@sparticuz/chromium');
  return chromium.launch({
    headless: true,
    args: packaged.args,
    executablePath: await packaged.executablePath(),
  });
}

/** The page as an A4 PDF, or null when it could not be rendered. */
export async function renderPdf(request: PdfRequest): Promise<Uint8Array | null> {
  let browser: Awaited<ReturnType<typeof launch>> | null = null;
  try {
    browser = await launch();
    const target = new URL(request.url);
    const context = await browser.newContext();
    if (request.cookies.length > 0) {
      await context.addCookies(
        request.cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          url: target.origin,
        })),
      );
    }
    const page = await context.newPage();
    const response = await page.goto(target.toString(), {
      waitUntil: 'networkidle',
      timeout: 25_000,
    });
    if (!response || !response.ok()) return null;
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return new Uint8Array(pdf);
  } catch (error) {
    console.error('[pdf] could not render', request.url, String(error).slice(0, 300));
    return null;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
