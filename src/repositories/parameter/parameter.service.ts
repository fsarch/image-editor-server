import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Parameter } from '../../database/entities/parameter.entity.js';
import { ParameterCreateDto, ParameterUpdateDto } from '../../models/parameter.model.js';
import { ProjectVersionService } from '../project-version/project-version.service.js';

@Injectable()
export class ParameterService {
  constructor(
    @InjectRepository(Parameter)
    private readonly parameterRepository: Repository<Parameter>,
    private readonly projectVersionService: ProjectVersionService,
  ) {}

  public async CreateParameter(
    projectId: string,
    projectVersionId: string,
    createDto: ParameterCreateDto,
  ): Promise<Parameter> {
    const version = await this.projectVersionService.GetByIdForProject(projectId, projectVersionId);
    await this.projectVersionService.AssertEditable(projectId, version);

    const parameter = this.parameterRepository.create({
      id: crypto.randomUUID(),
      projectVersionId,
      parentId: createDto.parentId ?? null,
      name: createDto.name,
      type: createDto.type,
      required: createDto.required ?? false,
      defaultValue: createDto.defaultValue ?? null,
      order: createDto.order ?? 0,
    });

    return this.parameterRepository.save(parameter);
  }

  public async ListForProjectVersion(
    projectId: string,
    projectVersionId: string,
    skip: number = 0,
    take: number = 25,
  ): Promise<[Parameter[], number]> {
    // Confirms projectVersionId actually belongs to projectId (404s otherwise) - read-only, no editability check needed.
    await this.projectVersionService.GetByIdForProject(projectId, projectVersionId);

    return this.parameterRepository.findAndCount({
      where: { projectVersionId },
      skip,
      take,
      order: { order: 'ASC' },
    });
  }

  /** All (non-paginated) parameters of a version, used by the render pipeline to build the schema. */
  public async ListByProjectVersion(projectVersionId: string): Promise<Parameter[]> {
    return this.parameterRepository.find({
      where: { projectVersionId },
      order: { order: 'ASC' },
    });
  }

  public async GetByIdForProjectVersion(
    projectId: string,
    projectVersionId: string,
    parameterId: string,
  ): Promise<Parameter> {
    await this.projectVersionService.GetByIdForProject(projectId, projectVersionId);

    const parameter = await this.parameterRepository.findOne({
      where: { id: parameterId, projectVersionId },
    });

    if (!parameter) {
      throw new NotFoundException(
        `Parameter '${parameterId}' not found for project version '${projectVersionId}'`,
      );
    }

    return parameter;
  }

  public async UpdateParameter(
    projectId: string,
    projectVersionId: string,
    parameterId: string,
    updateDto: ParameterUpdateDto,
  ): Promise<Parameter> {
    const version = await this.projectVersionService.GetByIdForProject(projectId, projectVersionId);
    await this.projectVersionService.AssertEditable(projectId, version);

    const parameter = await this.GetByIdForProjectVersion(projectId, projectVersionId, parameterId);

    if (updateDto.parentId !== undefined) parameter.parentId = updateDto.parentId;
    if (updateDto.name !== undefined) parameter.name = updateDto.name;
    if (updateDto.type !== undefined) parameter.type = updateDto.type;
    if (updateDto.required !== undefined) parameter.required = updateDto.required;
    if (updateDto.defaultValue !== undefined) parameter.defaultValue = updateDto.defaultValue;
    if (updateDto.order !== undefined) parameter.order = updateDto.order;

    return this.parameterRepository.save(parameter);
  }

  public async DeleteForProjectVersion(
    projectId: string,
    projectVersionId: string,
    parameterId: string,
  ): Promise<void> {
    const version = await this.projectVersionService.GetByIdForProject(projectId, projectVersionId);
    await this.projectVersionService.AssertEditable(projectId, version);

    const result = await this.parameterRepository.update(
      { id: parameterId, projectVersionId, deletionTime: IsNull() },
      { deletionTime: new Date() },
    );

    if (result.affected === 0) {
      throw new NotFoundException(
        `Parameter '${parameterId}' not found for project version '${projectVersionId}'`,
      );
    }
  }
}
