import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ProjectVersion } from '../../database/entities/project-version.entity.js';
import {
  ProjectVersionCreateDto,
  ProjectVersionUpdateDto,
} from '../../models/project-version.model.js';

@Injectable()
export class ProjectVersionService {
  constructor(
    @InjectRepository(ProjectVersion)
    private readonly projectVersionRepository: Repository<ProjectVersion>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  public async CreateProjectVersion(
    projectId: string,
    createDto: ProjectVersionCreateDto,
  ): Promise<ProjectVersion> {
    const projectVersion = this.projectVersionRepository.create({
      id: crypto.randomUUID(),
      projectId,
      externalId: createDto.externalId ?? null,
      width: createDto.width,
      height: createDto.height,
      isActive: false,
    });

    return this.projectVersionRepository.save(projectVersion);
  }

  public async ListForProject(
    projectId: string,
    skip: number = 0,
    take: number = 25,
  ): Promise<[ProjectVersion[], number]> {
    return this.projectVersionRepository.findAndCount({
      where: { projectId },
      skip,
      take,
      order: { creationTime: 'DESC' },
    });
  }

  public async GetByIdForProject(projectId: string, versionId: string): Promise<ProjectVersion> {
    const projectVersion = await this.projectVersionRepository.findOne({
      where: { id: versionId, projectId },
    });

    if (!projectVersion) {
      throw new NotFoundException(
        `ProjectVersion '${versionId}' not found for project '${projectId}'`,
      );
    }

    return projectVersion;
  }

  public async GetById(id: string): Promise<ProjectVersion | null> {
    return this.projectVersionRepository.findOne({ where: { id } });
  }

  public async GetActiveForProject(projectId: string): Promise<ProjectVersion | null> {
    return this.projectVersionRepository.findOne({
      where: { projectId, isActive: true },
    });
  }

  /** The most recently created, non-deleted ProjectVersion of a project - the only one that can ever be editable. */
  public async GetLatestForProject(projectId: string): Promise<ProjectVersion | null> {
    return this.projectVersionRepository.findOne({
      where: { projectId },
      order: { creationTime: 'DESC' },
    });
  }

  /**
   * Enforces the project's edit-lock: only the most recently created
   * ProjectVersion of a project may ever be mutated (its own fields, or its
   * Parameters/Layers), and only while it is not the active version -
   * editing what's currently live would silently change what's being
   * rendered right now. Older versions are permanent history; the active
   * version is a published snapshot. To keep editing, create a new draft
   * ProjectVersion first (POST .../versions) - it becomes the new latest,
   * non-active version and is editable immediately.
   */
  public async AssertEditable(projectId: string, version: ProjectVersion): Promise<void> {
    const latest = await this.GetLatestForProject(projectId);

    if (!latest || latest.id !== version.id) {
      throw new ConflictException(
        `ProjectVersion '${version.id}' is not editable: only the most recently created ` +
          `ProjectVersion of a project may be edited, older versions are read-only history`,
      );
    }

    if (version.isActive) {
      throw new ConflictException(
        `ProjectVersion '${version.id}' is not editable: it is the active version. ` +
          `Create a new draft ProjectVersion first (POST .../versions) to keep editing`,
      );
    }
  }

  public async UpdateProjectVersion(
    projectId: string,
    versionId: string,
    updateDto: ProjectVersionUpdateDto,
  ): Promise<ProjectVersion> {
    const projectVersion = await this.GetByIdForProject(projectId, versionId);
    await this.AssertEditable(projectId, projectVersion);

    if (updateDto.externalId !== undefined) projectVersion.externalId = updateDto.externalId;
    if (updateDto.width !== undefined) projectVersion.width = updateDto.width;
    if (updateDto.height !== undefined) projectVersion.height = updateDto.height;

    return this.projectVersionRepository.save(projectVersion);
  }

  public async DeleteForProject(projectId: string, versionId: string): Promise<void> {
    const result = await this.projectVersionRepository.update(
      { id: versionId, projectId, deletionTime: IsNull() },
      { deletionTime: new Date() },
    );

    if (result.affected === 0) {
      throw new NotFoundException(
        `ProjectVersion '${versionId}' not found for project '${projectId}'`,
      );
    }
  }

  /**
   * Activates `versionId` and deactivates any other currently-active,
   * non-deleted ProjectVersion of the same project, inside a single DB
   * transaction. This must be atomic: the partial unique index on
   * (project_id) WHERE is_active = true AND deletion_time IS NULL rejects
   * two simultaneously-active rows, so deactivating the old version and
   * activating the new one has to happen as one unit - otherwise a crash
   * between the two steps could leave the project with no active version,
   * and concurrent activate calls could otherwise both partially succeed.
   */
  public async ActivateProjectVersion(
    projectId: string,
    versionId: string,
  ): Promise<ProjectVersion> {
    return this.dataSource.transaction(async (manager) => {
      const target = await manager.findOne(ProjectVersion, {
        where: { id: versionId, projectId },
      });

      if (!target) {
        throw new NotFoundException(
          `ProjectVersion '${versionId}' not found for project '${projectId}'`,
        );
      }

      await manager.update(
        ProjectVersion,
        { projectId, isActive: true, deletionTime: IsNull() },
        { isActive: false },
      );

      target.isActive = true;
      return manager.save(ProjectVersion, target);
    });
  }
}
