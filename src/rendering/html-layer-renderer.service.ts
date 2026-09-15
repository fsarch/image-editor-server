import { Injectable, Logger } from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';

// Module-wide, lazily-created and reused across requests - mirrors
// pdf-render-backend's src/controllers/render/render.service.ts, which
// found that a fresh Chromium launch dominates render latency by roughly an
// order of magnitude versus reusing a pooled browser.
let BROWSER: Promise<Browser> | undefined;

const logger = new Logger('html-layer-renderer');

async function getBrowser(forceRecreate: boolean): Promise<Browser> {
  let shouldRecreateBrowser = forceRecreate;

  if (!BROWSER) {
    shouldRecreateBrowser = true;
    logger.log('no existing browser, creating new one');
  } else if (!shouldRecreateBrowser) {
    try {
      const browser = await BROWSER;

      if (!browser.connected) {
        shouldRecreateBrowser = true;
        logger.log('existing browser not connected, force recreating');
      }
    } catch (error) {
      shouldRecreateBrowser = true;
      logger.error('error while waiting for existing browser, force recreating', { error });
    }
  }

  if (shouldRecreateBrowser) {
    logger.log('creating new browser instance');
    BROWSER = puppeteer.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // The container's /dev/shm is typically capped at 64MB; Chromium's
        // default shared-memory rendering blows through that and the
        // renderer process silently dies mid-request (surfaces as
        // "TargetCloseError: Session closed"). Fall back to disk instead.
        '--disable-dev-shm-usage',
      ],
    });
  }

  // At this point BROWSER is always assigned: either it already was (the
  // !BROWSER branch above would have forced a recreate otherwise) or it was
  // just (re)assigned in the `if (shouldRecreateBrowser)` block.
  return BROWSER as Promise<Browser>;
}

function isTargetClosedError(error: unknown): boolean {
  return error instanceof Error && /session closed|target closed/i.test(error.message);
}

async function usePage<T>(cb: (page: Page) => Promise<T>): Promise<T> {
  // A crashed renderer only shows up once we try to use the page (e.g. on
  // setViewport), so retry once against a freshly created browser rather
  // than failing the whole render on what is usually a transient crash.
  for (let attempt = 0; attempt < 2; attempt++) {
    const browser = await getBrowser(attempt > 0);

    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    page.on('request', (interceptedRequest) => interceptedRequest.abort());
    await page.setRequestInterception(true);

    try {
      return await cb(page);
    } catch (error) {
      if (attempt === 0 && isTargetClosedError(error)) {
        logger.warn('page crashed while rendering HTML layer, retrying with fresh browser', {
          error,
        });
        continue;
      }
      throw error;
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  // Unreachable, but keeps TypeScript happy.
  throw new Error('Failed to render HTML layer after retry');
}

// Chromium's UA stylesheet gives `body` an 8px margin by default; left
// alone, an HTML layer's content would render offset from (0,0) instead of
// filling the layer's declared width/height exactly, unlike every other
// layer type (text/shape/image), none of which have an implicit offset.
// `overflow:hidden` guards against layer HTML that (often unintentionally,
// e.g. `width:100vw` plus `padding` under the default content-box sizing)
// ends up a few pixels taller/wider than its own viewport - Puppeteer's
// screenshot never renders scrollbar UI regardless, so this doesn't change
// what a viewer of the final PNG sees, but it keeps the rendered box's
// layout from ever depending on a scrollbar-adjusted viewport width.
// Prepended (not injected into/replacing the caller's HTML), so an author
// who sets their own margin/padding/overflow via a later rule of equal
// specificity still wins the cascade - this only neutralizes UA defaults.
const RESET_STYLE = '<style>html,body{margin:0;padding:0;overflow:hidden}</style>';

@Injectable()
export class HtmlLayerRendererService {
  public async RenderToPng(html: string, width: number, height: number): Promise<Buffer> {
    return usePage(async (page) => {
      await page.setViewport({ width, height });
      await page.setContent(`${RESET_STYLE}${html}`, { waitUntil: 'domcontentloaded', timeout: 10_000 });

      const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: true, // transparent background, so it composites cleanly onto the canvas
        clip: { x: 0, y: 0, width, height },
      });

      return Buffer.from(screenshot);
    });
  }
}
