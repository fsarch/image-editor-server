import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Layer } from '../../database/entities/layer.entity.js';
import { LayerCreateDto, LayerUpdateDto } from '../../models/layer.model.js';
import { ProjectVersionService } from '../project-version/project-version.service.js';

@Injectable()
export class LayerService {
  constructor(
    @InjectRepository(Layer)
    private readonly layerRepository: Repository<Layer>,
    private readonly projectVersionService: ProjectVersionService,
  ) {}

  public async CreateLayer(
    projectId: string,
    projectVersionId: string,
    createDto: LayerCreateDto,
  ): Promise<Layer> {
    const version = await this.projectVersionService.GetByIdForProject(projectId, projectVersionId);
    await this.projectVersionService.AssertEditable(projectId, version);

    const layer = this.layerRepository.create({
      id: crypto.randomUUID(),
      projectVersionId,
      externalId: createDto.externalId ?? null,
      name: createDto.name,
      order: createDto.order ?? 0,
      type: createDto.type,
      transformationMatrix: createDto.transformationMatrix,
      options: createDto.options,
    });

    return this.layerRepository.save(layer);
  }

  public async ListForProjectVersion(
    projectId: string,
    projectVersionId: string,
    skip: number = 0,
    take: number = 25,
  ): Promise<[Layer[], number]> {
    // Confirms projectVersionId actually belongs to projectId (404s otherwise) - read-only, no editability check needed.
    await this.projectVersionService.GetByIdForProject(projectId, projectVersionId);

    return this.layerRepository.findAndCount({
      where: { projectVersionId },
      skip,
      take,
      order: { order: 'ASC' },
    });
  }

  /** All (non-paginated) layers of a version, in paint order, used by the render pipeline. */
  public async ListByProjectVersion(projectVersionId: string): Promise<Layer[]> {
    return this.layerRepository.find({
      where: { projectVersionId },
      order: { order: 'ASC' },
    });
  }

  public async GetByIdForProjectVersion(
    projectId: string,
    projectVersionId: string,
    layerId: string,
  ): Promise<Layer> {
    await this.projectVersionService.GetByIdForProject(projectId, projectVersionId);

    const layer = await this.layerRepository.findOne({
      where: { id: layerId, projectVersionId },
    });

    if (!layer) {
      throw new NotFoundException(
        `Layer '${layerId}' not found for project version '${projectVersionId}'`,
      );
    }

    return layer;
  }

  public async UpdateLayer(
    projectId: string,
    projectVersionId: string,
    layerId: string,
    updateDto: LayerUpdateDto,
  ): Promise<Layer> {
    const version = await this.projectVersionService.GetByIdForProject(projectId, projectVersionId);
    await this.projectVersionService.AssertEditable(projectId, version);

    const layer = await this.GetByIdForProjectVersion(projectId, projectVersionId, layerId);

    if (updateDto.externalId !== undefined) layer.externalId = updateDto.externalId;
    if (updateDto.name !== undefined) layer.name = updateDto.name;
    if (updateDto.order !== undefined) layer.order = updateDto.order;
    if (updateDto.type !== undefined) layer.type = updateDto.type;
    if (updateDto.transformationMatrix !== undefined)
      layer.transformationMatrix = updateDto.transformationMatrix;
    if (updateDto.options !== undefined) layer.options = updateDto.options;

    return this.layerRepository.save(layer);
  }

  public async DeleteForProjectVersion(
    projectId: string,
    projectVersionId: string,
    layerId: string,
  ): Promise<void> {
    const version = await this.projectVersionService.GetByIdForProject(projectId, projectVersionId);
    await this.projectVersionService.AssertEditable(projectId, version);

    const result = await this.layerRepository.update(
      { id: layerId, projectVersionId, deletionTime: IsNull() },
      { deletionTime: new Date() },
    );

    if (result.affected === 0) {
      throw new NotFoundException(
        `Layer '${layerId}' not found for project version '${projectVersionId}'`,
      );
    }
  }
}
