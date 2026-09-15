import { vi } from 'vitest';

const mockPage = {
  setViewport: vi.fn(),
  setContent: vi.fn(),
  screenshot: vi.fn(async () => new Uint8Array(Buffer.from('png-bytes'))),
  setJavaScriptEnabled: vi.fn(),
  setRequestInterception: vi.fn(),
  on: vi.fn(),
  close: vi.fn(async () => undefined),
};

const mockBrowser = {
  connected: true,
  newPage: vi.fn(async () => mockPage),
};

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(async () => mockBrowser),
  },
}));

const { HtmlLayerRendererService } = await import('./html-layer-renderer.service.js');

describe('HtmlLayerRendererService', () => {
  const service = new HtmlLayerRendererService();

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowser.connected = true;
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockPage.screenshot.mockResolvedValue(new Uint8Array(Buffer.from('png-bytes')));
  });

  it('renders HTML to a PNG buffer with a transparent, clipped viewport', async () => {
    const result = await service.RenderToPng('<div>hi</div>', 100, 50);

    expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 100, height: 50 });
    // A margin/padding reset is prepended ahead of the caller's HTML (see
    // RESET_STYLE in html-layer-renderer.service.ts) so the layer fills its
    // declared box exactly instead of drifting by Chromium's default 8px
    // body margin.
    expect(mockPage.setContent).toHaveBeenCalledWith(
      '<style>html,body{margin:0;padding:0;overflow:hidden}</style><div>hi</div>',
      expect.any(Object),
    );
    expect(mockPage.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'png',
        omitBackground: true,
        clip: { x: 0, y: 0, width: 100, height: 50 },
      }),
    );
    expect(result).toEqual(Buffer.from('png-bytes'));
  });

  it('disables JavaScript and aborts all network requests on the page', async () => {
    await service.RenderToPng('<div>hi</div>', 10, 10);

    expect(mockPage.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
  });

  it('retries once with a fresh browser when the page crashes', async () => {
    mockPage.screenshot
      .mockRejectedValueOnce(new Error('Protocol error: Session closed.'))
      .mockResolvedValueOnce(new Uint8Array(Buffer.from('recovered')));

    const result = await service.RenderToPng('<div>hi</div>', 10, 10);

    expect(result).toEqual(Buffer.from('recovered'));
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
  });
});
