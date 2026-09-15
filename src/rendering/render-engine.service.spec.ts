import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RenderEngineService } from './render-engine.service.js';
import { ProjectVersionService } from '../repositories/project-version/project-version.service.js';
import { ParameterService } from '../repositories/parameter/parameter.service.js';
import { LayerService } from '../repositories/layer/layer.service.js';
import { CanvasCompositorService } from './canvas-compositor.service.js';
import { HtmlLayerRendererService } from './html-layer-renderer.service.js';
import { ProjectVersion } from '../database/entities/project-version.entity.js';
import { Parameter } from '../database/entities/parameter.entity.js';
import { Layer } from '../database/entities/layer.entity.js';

const fakeContext = {
  save: vi.fn(),
  restore: vi.fn(),
  setTransform: vi.fn(),
};

const fakeCanvas = {
  getContext: vi.fn(() => fakeContext),
  encode: vi.fn(async () => Buffer.from('fake-png')),
};

vi.mock('@napi-rs/canvas', () => ({
  createCanvas: vi.fn(() => fakeCanvas),
  loadImage: vi.fn(),
}));

function makeVersion(overrides: Partial<ProjectVersion> = {}): ProjectVersion {
  return {
    id: 'version-1',
    projectId: 'project-1',
    externalId: null,
    isActive: true,
    width: 400,
    height: 200,
    creationTime: new Date(),
    deletionTime: null,
    ...overrides,
  };
}

function makeParameter(overrides: Partial<Parameter>): Parameter {
  const parameter = new Parameter();
  parameter.id = overrides.id ?? crypto.randomUUID();
  parameter.projectVersionId = 'version-1';
  parameter.parentId = overrides.parentId ?? null;
  parameter.name = overrides.name ?? 'field';
  parameter.type = overrides.type ?? 'text';
  parameter.required = overrides.required ?? false;
  parameter.defaultValue = null;
  parameter.order = overrides.order ?? 0;
  return parameter;
}

function makeLayer(overrides: Partial<Layer>): Layer {
  const layer = new Layer();
  layer.id = overrides.id ?? crypto.randomUUID();
  layer.projectVersionId = 'version-1';
  layer.externalId = null;
  layer.name = overrides.name ?? 'layer';
  layer.order = overrides.order ?? 0;
  layer.type = overrides.type ?? 'text';
  layer.transformationMatrix = overrides.transformationMatrix ?? {
    a: { type: 'constant', value: 1 },
    b: { type: 'constant', value: 0 },
    c: { type: 'constant', value: 0 },
    d: { type: 'constant', value: 1 },
    e: { type: 'constant', value: 0 },
    f: { type: 'constant', value: 0 },
  };
  layer.options = overrides.options ?? {};
  return layer;
}

describe('RenderEngineService', () => {
  let service: RenderEngineService;
  let projectVersionService: { GetById: ReturnType<typeof vi.fn> };
  let parameterService: { ListByProjectVersion: ReturnType<typeof vi.fn> };
  let layerService: { ListByProjectVersion: ReturnType<typeof vi.fn> };
  let compositor: { drawText: ReturnType<typeof vi.fn>; drawImage: ReturnType<typeof vi.fn>; drawShape: ReturnType<typeof vi.fn>; drawImageBuffer: ReturnType<typeof vi.fn> };
  let htmlRenderer: { RenderToPng: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    projectVersionService = { GetById: vi.fn() };
    parameterService = { ListByProjectVersion: vi.fn() };
    layerService = { ListByProjectVersion: vi.fn() };
    compositor = {
      drawText: vi.fn(),
      drawImage: vi.fn(),
      drawShape: vi.fn(),
      drawImageBuffer: vi.fn(),
    };
    htmlRenderer = { RenderToPng: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RenderEngineService,
        { provide: ProjectVersionService, useValue: projectVersionService },
        { provide: ParameterService, useValue: parameterService },
        { provide: LayerService, useValue: layerService },
        { provide: CanvasCompositorService, useValue: compositor },
        { provide: HtmlLayerRendererService, useValue: htmlRenderer },
      ],
    }).compile();

    service = module.get<RenderEngineService>(RenderEngineService);
  });

  it('throws NotFoundException when the project version does not exist', async () => {
    projectVersionService.GetById.mockResolvedValue(null);

    await expect(service.RenderProjectVersion('missing', {})).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when required parameters are missing', async () => {
    projectVersionService.GetById.mockResolvedValue(makeVersion());
    parameterService.ListByProjectVersion.mockResolvedValue([
      makeParameter({ name: 'name', type: 'text', required: true }),
    ]);
    layerService.ListByProjectVersion.mockResolvedValue([]);

    await expect(service.RenderProjectVersion('version-1', {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('draws layers in order and returns a PNG buffer', async () => {
    projectVersionService.GetById.mockResolvedValue(makeVersion());
    parameterService.ListByProjectVersion.mockResolvedValue([
      makeParameter({ name: 'name', type: 'text', required: true }),
    ]);
    layerService.ListByProjectVersion.mockResolvedValue([
      makeLayer({ order: 1, type: 'text', options: { content: { type: 'variable', value: 'name' } } }),
      makeLayer({ order: 0, type: 'shape', options: { shape: { type: 'constant', value: 'rectangle' } } }),
    ]);

    const result = await service.RenderProjectVersion('version-1', { name: 'Jane' });

    expect(result).toEqual(Buffer.from('fake-png'));
    // Shape (order 0) must be drawn before text (order 1) regardless of
    // the order layers were returned from the DB in this test.
    expect(compositor.drawShape).toHaveBeenCalledBefore(compositor.drawText as never);
    expect(compositor.drawText).toHaveBeenCalledWith(
      fakeContext,
      expect.objectContaining({ content: 'Jane' }),
    );
  });

  it('renders html layers via the HtmlLayerRendererService and composites the result', async () => {
    projectVersionService.GetById.mockResolvedValue(makeVersion());
    parameterService.ListByProjectVersion.mockResolvedValue([]);
    layerService.ListByProjectVersion.mockResolvedValue([
      makeLayer({
        type: 'html',
        options: {
          html: { type: 'constant', value: '<div>hi</div>' },
          width: { type: 'constant', value: 100 },
          height: { type: 'constant', value: 50 },
        },
      }),
    ]);

    const htmlPng = Buffer.from('html-png');
    htmlRenderer.RenderToPng.mockResolvedValue(htmlPng);

    await service.RenderProjectVersion('version-1', {});

    expect(htmlRenderer.RenderToPng).toHaveBeenCalledWith('<div>hi</div>', 100, 50);
    expect(compositor.drawImageBuffer).toHaveBeenCalledWith(fakeContext, htmlPng, 100, 50);
  });
});
