import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { Parameter } from '../../database/entities/parameter.entity.js';
import { ProjectVersion } from '../../database/entities/project-version.entity.js';
import { ParameterService } from './parameter.service.js';
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

describe('ParameterService', () => {
  let service: ParameterService;
  let parameterRepository: { create: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let projectVersionService: { GetByIdForProject: ReturnType<typeof vi.fn>; AssertEditable: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    parameterRepository = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
      update: vi.fn(async () => ({ affected: 1 })),
    };
    projectVersionService = {
      GetByIdForProject: vi.fn(async () => makeVersion()),
      AssertEditable: vi.fn(async () => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParameterService,
        { provide: getRepositoryToken(Parameter), useValue: parameterRepository },
        { provide: ProjectVersionService, useValue: projectVersionService },
      ],
    }).compile();

    service = module.get<ParameterService>(ParameterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('CreateParameter', () => {
    it('checks ownership and editability before creating', async () => {
      await service.CreateParameter('project-1', 'version-1', {
        name: 'title',
        type: 'text',
      } as never);

      expect(projectVersionService.GetByIdForProject).toHaveBeenCalledWith('project-1', 'version-1');
      expect(projectVersionService.AssertEditable).toHaveBeenCalledWith('project-1', expect.any(Object));
      expect(parameterRepository.save).toHaveBeenCalled();
    });

    it('propagates the ConflictException when the version is not editable, without creating anything', async () => {
      projectVersionService.AssertEditable.mockRejectedValue(
        new ConflictException('not editable'),
      );

      await expect(
        service.CreateParameter('project-1', 'version-1', { name: 'title', type: 'text' } as never),
      ).rejects.toThrow(ConflictException);

      expect(parameterRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('DeleteForProjectVersion', () => {
    it('rejects when the version is not editable', async () => {
      projectVersionService.AssertEditable.mockRejectedValue(
        new ConflictException('not editable'),
      );

      await expect(
        service.DeleteForProjectVersion('project-1', 'version-1', 'param-1'),
      ).rejects.toThrow(ConflictException);

      expect(parameterRepository.update).not.toHaveBeenCalled();
    });
  });
});
