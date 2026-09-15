import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ProjectVersion } from '../../database/entities/project-version.entity.js';
import { ProjectVersionService } from './project-version.service.js';

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

describe('ProjectVersionService', () => {
  let service: ProjectVersionService;
  let projectVersionRepository: { findOne: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let transactionManager: { findOne: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    projectVersionRepository = {
      findOne: vi.fn(),
      save: vi.fn(async (value) => value),
    };

    transactionManager = {
      findOne: vi.fn(),
      update: vi.fn(),
      save: vi.fn(),
    };

    dataSource = {
      transaction: vi.fn((cb: (manager: unknown) => unknown) => cb(transactionManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectVersionService,
        {
          provide: getRepositoryToken(ProjectVersion),
          useValue: projectVersionRepository,
        },
        {
          provide: getDataSourceToken(),
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<ProjectVersionService>(ProjectVersionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ActivateProjectVersion', () => {
    it('deactivates other active versions and activates the target inside one transaction', async () => {
      const target: ProjectVersion = {
        id: 'version-2',
        projectId: 'project-1',
        externalId: null,
        isActive: false,
        width: 100,
        height: 100,
        creationTime: new Date(),
        deletionTime: null,
      };

      transactionManager.findOne.mockResolvedValue(target);
      transactionManager.save.mockImplementation((_entity, value) => Promise.resolve(value));

      const result = await service.ActivateProjectVersion('project-1', 'version-2');

      expect(dataSource.transaction).toHaveBeenCalledOnce();
      // deactivate step must run before the target is saved as active
      expect(transactionManager.update).toHaveBeenCalledWith(
        ProjectVersion,
        { projectId: 'project-1', isActive: true, deletionTime: IsNull() },
        { isActive: false },
      );
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException when the version does not belong to the project', async () => {
      transactionManager.findOne.mockResolvedValue(null);

      await expect(service.ActivateProjectVersion('project-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('AssertEditable', () => {
    it('passes for the latest, non-active version', async () => {
      const latest = makeVersion({ id: 'version-2', isActive: false });
      projectVersionRepository.findOne.mockResolvedValue(latest);

      await expect(service.AssertEditable('project-1', latest)).resolves.toBeUndefined();
    });

    it('rejects a version that is not the latest one (read-only history)', async () => {
      const latest = makeVersion({ id: 'version-2' });
      const older = makeVersion({ id: 'version-1' });
      projectVersionRepository.findOne.mockResolvedValue(latest);

      await expect(service.AssertEditable('project-1', older)).rejects.toThrow(ConflictException);
    });

    it('rejects the latest version while it is active', async () => {
      const activeLatest = makeVersion({ id: 'version-2', isActive: true });
      projectVersionRepository.findOne.mockResolvedValue(activeLatest);

      await expect(service.AssertEditable('project-1', activeLatest)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('UpdateProjectVersion', () => {
    it('rejects updates to a version that is not editable', async () => {
      const active = makeVersion({ isActive: true });
      // GetByIdForProject and AssertEditable's GetLatestForProject both hit
      // the same mocked findOne - returning the (active) version for both
      // is enough to exercise the "active version is not editable" path.
      projectVersionRepository.findOne.mockResolvedValue(active);

      await expect(
        service.UpdateProjectVersion('project-1', 'version-1', { width: 500 }),
      ).rejects.toThrow(ConflictException);
      expect(projectVersionRepository.save).not.toHaveBeenCalled();
    });
  });
});
