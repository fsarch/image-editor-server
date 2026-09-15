import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RenderEngineService } from './render-engine.service.js';
import { CanvasCompositorService } from './canvas-compositor.service.js';
import { HtmlLayerRendererService } from './html-layer-renderer.service.js';
import { ProjectVersion } from '../database/entities/project-version.entity.js';
import { Parameter, ParameterType } from '../database/entities/parameter.entity.js';
import { Layer, LayerType } from '../database/entities/layer.entity.js';
import { decodePng, expectMatchesBaseline, hexColor, pixelAt } from './__fixtures__/render-test.utils.js';

// These tests exercise the REAL rendering pipeline end to end - real
// @napi-rs/canvas compositing and a real (headless) Puppeteer browser for
// html layers, nothing mocked below RenderEngineService's three repository
// dependencies. They complement render-engine.service.spec.ts (which mocks
// the compositor/html-renderer to test orchestration cheaply) by actually
// verifying pixels, transforms, and paint order produce the expected image.
//
// Fixtures deliberately avoid text layers: glyph rendering depends on
// whatever fonts are installed on the host/CI runner, which this repo does
// not pin - making pixel-exact text baselines flaky across environments.
// Shapes, images, and solid-color (no border-radius, no text) html layers
// are fully deterministic regardless of installed fonts.

const FIXTURES_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '__fixtures__', 'baselines');

// A 4x4 solid red (#cc3333) PNG, generated once via @napi-rs/canvas and
// embedded here as a literal - see the "image-layer" scenario below.
const RED_SQUARE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABHNCSVQICAgIfAhkiAAAAAFzUkdCAK7OHOkAAAAVSURBVAiZYzxjbPyfAQkwMaABwgIAkJECOTlD9gkAAAAASUVORK5CYII=';

function identityMatrix(overrides: Partial<Record<'a' | 'b' | 'c' | 'd' | 'e' | 'f', number>> = {}) {
  const value = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, ...overrides };
  return {
    a: { type: 'constant', value: value.a },
    b: { type: 'constant', value: value.b },
    c: { type: 'constant', value: value.c },
    d: { type: 'constant', value: value.d },
    e: { type: 'constant', value: value.e },
    f: { type: 'constant', value: value.f },
  };
}

function constant<T>(value: T) {
  return { type: 'constant', value };
}

function variable(name: string) {
  return { type: 'variable', value: name };
}

function makeVersion(width: number, height: number): ProjectVersion {
  return {
    id: 'version-1',
    projectId: 'project-1',
    externalId: null,
    isActive: true,
    width,
    height,
    creationTime: new Date(),
    deletionTime: null,
  };
}

function makeParameter(name: string, type: ParameterType, required = true): Parameter {
  const parameter = new Parameter();
  parameter.id = crypto.randomUUID();
  parameter.projectVersionId = 'version-1';
  parameter.parentId = null;
  parameter.name = name;
  parameter.type = type;
  parameter.required = required;
  parameter.defaultValue = null;
  parameter.order = 0;
  return parameter;
}

function makeLayer(order: number, type: LayerType, transformationMatrix: unknown, options: unknown): Layer {
  const layer = new Layer();
  layer.id = crypto.randomUUID();
  layer.projectVersionId = 'version-1';
  layer.externalId = null;
  layer.name = `layer-${order}`;
  layer.order = order;
  layer.type = type;
  layer.transformationMatrix = transformationMatrix;
  layer.options = options;
  return layer;
}

function makeEngine(parameters: Parameter[], layers: Layer[], version: ProjectVersion) {
  return new RenderEngineService(
    { GetById: async () => version } as never,
    { ListByProjectVersion: async () => parameters } as never,
    { ListByProjectVersion: async () => layers } as never,
    new CanvasCompositorService(),
    new HtmlLayerRendererService(),
  );
}

describe('RenderEngineService (real rendering, baseline comparison)', () => {
  it('composites shapes with transforms and a parameter-bound fill color', async () => {
    const version = makeVersion(200, 100);
    const parameters = [makeParameter('bgColor', 'text')];
    const layers = [
      makeLayer(0, 'shape', identityMatrix(), {
        shape: constant('rectangle'),
        width: constant(200),
        height: constant(100),
        fillColor: variable('bgColor'),
      }),
      // 60x60 box placed at (70,20) -> its ellipse is centered at (100,50),
      // i.e. dead center of the 200x100 canvas.
      makeLayer(1, 'shape', identityMatrix({ e: 70, f: 20 }), {
        shape: constant('ellipse'),
        width: constant(60),
        height: constant(60),
        fillColor: constant('#ffcc00'),
      }),
    ];

    const engine = makeEngine(parameters, layers, version);
    const png = await engine.RenderProjectVersion('version-1', { bgColor: '#336699' });
    const image = await decodePng(png);

    expect(image.width).toBe(200);
    expect(image.height).toBe(100);
    expect(pixelAt(image, 5, 5)).toEqual(hexColor('#336699')); // background, parameter-bound
    expect(pixelAt(image, 100, 50)).toEqual(hexColor('#ffcc00')); // ellipse center

    await expectMatchesBaseline(png, join(FIXTURES_DIR, 'shapes-and-transform.png'), {
      channelTolerance: 8,
      maxDiffPixels: 40, // small allowance for anti-aliased ellipse edge pixels
    });
  });

  it('decodes and scales a base64 image layer onto the canvas', async () => {
    const version = makeVersion(100, 50);
    const layers = [
      makeLayer(0, 'shape', identityMatrix(), {
        shape: constant('rectangle'),
        width: constant(100),
        height: constant(50),
        fillColor: constant('#eeeeee'),
      }),
      makeLayer(1, 'image', identityMatrix({ e: 30, f: 10 }), {
        image: constant({ type: 'base64', value: RED_SQUARE_BASE64 }),
        width: constant(40),
        height: constant(30),
      }),
    ];

    const engine = makeEngine([], layers, version);
    const png = await engine.RenderProjectVersion('version-1', {});
    const image = await decodePng(png);

    expect(pixelAt(image, 5, 5)).toEqual(hexColor('#eeeeee')); // background, outside image
    expect(pixelAt(image, 50, 25)).toEqual(hexColor('#cc3333')); // inside the scaled image

    await expectMatchesBaseline(png, join(FIXTURES_DIR, 'image-layer.png'), {
      channelTolerance: 4,
      maxDiffPixels: 0, // a solid-color source scaled up has no anti-aliasing to tolerate
    });
  });

  it('renders an html layer via real Puppeteer and respects paint order on overlap', async () => {
    const version = makeVersion(100, 50);
    const layers = [
      // Background: solid blue across the whole canvas.
      makeLayer(0, 'shape', identityMatrix(), {
        shape: constant('rectangle'),
        width: constant(100),
        height: constant(50),
        fillColor: constant('#3333cc'),
      }),
      // Image: solid red, covers x:[0,60).
      makeLayer(1, 'image', identityMatrix(), {
        image: constant({ type: 'base64', value: RED_SQUARE_BASE64 }),
        width: constant(60),
        height: constant(50),
      }),
      // Html: solid green, covers x:[30,70) - overlaps the image in
      // [30,60) and should paint over it there (drawn last). No manual
      // margin reset needed here - HtmlLayerRendererService now neutralizes
      // Chromium's default body margin itself (see RESET_STYLE), so this
      // also exercises that the renderer's own reset is sufficient.
      makeLayer(2, 'html', identityMatrix({ e: 30 }), {
        html: constant('<div style="width:40px;height:50px;background:#33aa33;"></div>'),
        width: constant(40),
        height: constant(50),
      }),
    ];

    const engine = makeEngine([], layers, version);
    const png = await engine.RenderProjectVersion('version-1', {});
    const image = await decodePng(png);

    expect(pixelAt(image, 10, 25)).toEqual(hexColor('#cc3333')); // image only
    expect(pixelAt(image, 45, 25)).toEqual(hexColor('#33aa33')); // image + html overlap -> html wins (paint order)
    expect(pixelAt(image, 65, 25)).toEqual(hexColor('#33aa33')); // html only
    expect(pixelAt(image, 90, 25)).toEqual(hexColor('#3333cc')); // background only

    await expectMatchesBaseline(png, join(FIXTURES_DIR, 'html-and-zorder.png'), {
      channelTolerance: 4,
      maxDiffPixels: 0, // plain rectangular fills, pixel-aligned - no anti-aliasing expected
    });
  });
});
