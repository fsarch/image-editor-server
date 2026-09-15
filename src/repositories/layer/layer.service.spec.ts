import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { Layer } from '../../database/entities/layer.entity.js';
import { ProjectVersion } from '../../database/entities/project-version.entity.js';
import { LayerService } from './layer.service.js';
import { ProjectVersionService } from '../project-version/project-version.service.js';

function makeVersion(overrides: Partial<ProjectVersion> = {}): ProjectVersion {
  return {
    id: 'version-1',
    projectId: 'project-1',
    externalId: null,
    isActive: false,
    width: 100,
    height: 100,
    creationTime: new Date(),
    deletionTime: null,
    ...overrides,
  };
}

describe('LayerService', () => {
  let service: LayerService;
  let layerRepository: { create: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };
  let projectVersionService: { GetByIdForProject: ReturnType<typeof vi.fn>; AssertEditable: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    layerRepository = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
      update: vi.fn(async () => ({ affected: 1 })),
      findOne: vi.fn(async () => null),
    };
    projectVersionService = {
      GetByIdForProject: vi.fn(async () => makeVersion()),
      AssertEditable: vi.fn(async () => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LayerService,
        { provide: getRepositoryToken(Layer), useValue: layerRepository },
        { provide: ProjectVersionService, useValue: projectVersionService },
      ],
    }).compile();

    service = module.get<LayerService>(LayerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('CreateLayer', () => {
    it('checks ownership and editability before creating', async () => {
      await service.CreateLayer('project-1', 'version-1', {
        name: 'background',
        type: 'shape',
        transformationMatrix: {},
        options: {},
      } as never);

      expect(projectVersionService.GetByIdForProject).toHaveBeenCalledWith('project-1', 'version-1');
      expect(projectVersionService.AssertEditable).toHaveBeenCalledWith('project-1', expect.any(Object));
      expect(layerRepository.save).toHaveBeenCalled();
    });

    it('propagates the ConflictException when the version is not editable, without creating anything', async () => {
      projectVersionService.AssertEditable.mockRejectedValue(
        new ConflictException('not editable'),
      );

      await expect(
        service.CreateLayer('project-1', 'version-1', {
          name: 'background',
          type: 'shape',
          transformationMatrix: {},
          options: {},
        } as never),
      ).rejects.toThrow(ConflictException);

      expect(layerRepository.save).not.toHaveBeenCalled();
    });

    it('defaults hidden to false when not provided', async () => {
      const layer = await service.CreateLayer('project-1', 'version-1', {
        name: 'background',
        type: 'shape',
        transformationMatrix: {},
        options: {},
      } as never);

      expect(layer.hidden).toBe(false);
    });

    it('passes hidden: true through when provided', async () => {
      const layer = await service.CreateLayer('project-1', 'version-1', {
        name: 'background',
        type: 'shape',
        transformationMatrix: {},
        options: {},
        hidden: true,
      } as never);

      expect(layer.hidden).toBe(true);
    });
  });

  describe('UpdateLayer', () => {
    it('rejects when the version is not editable', async () => {
      projectVersionService.AssertEditable.mockRejectedValue(
        new ConflictException('not editable'),
      );

      await expect(
        service.UpdateLayer('project-1', 'version-1', 'layer-1', { name: 'renamed' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates hidden when provided', async () => {
      const existing = new Layer();
      existing.id = 'layer-1';
      existing.projectVersionId = 'version-1';
      existing.name = 'background';
      existing.type = 'shape';
      existing.hidden = false;
      layerRepository.findOne.mockResolvedValue(existing);

      const layer = await service.UpdateLayer('project-1', 'version-1', 'layer-1', { hidden: true });

      expect(layer.hidden).toBe(true);
    });
  });
});
