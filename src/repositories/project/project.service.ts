import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Project } from '../../database/entities/project.entity.js';
import { ProjectCreateDto, ProjectUpdateDto } from '../../models/project.model.js';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  public async CreateProject(createDto: ProjectCreateDto): Promise<Project> {
    const project = this.projectRepository.create({
      id: crypto.randomUUID(),
      name: createDto.name,
      description: createDto.description ?? null,
      externalId: createDto.externalId ?? null,
    });

    return this.projectRepository.save(project);
  }

  public async ListProjects(skip: number = 0, take: number = 25): Promise<[Project[], number]> {
    return this.projectRepository.findAndCount({
      skip,
      take,
      order: { creationTime: 'DESC' },
    });
  }

  public async GetById(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id } });

    if (!project) {
      throw new NotFoundException(`Project '${id}' not found`);
    }

    return project;
  }

  public async UpdateProject(id: string, updateDto: ProjectUpdateDto): Promise<Project> {
    const project = await this.GetById(id);

    if (updateDto.name !== undefined) project.name = updateDto.name;
    if (updateDto.description !== undefined) project.description = updateDto.description;
    if (updateDto.externalId !== undefined) project.externalId = updateDto.externalId;

    return this.projectRepository.save(project);
  }

  public async DeleteById(id: string): Promise<void> {
    const result = await this.projectRepository.update(
      { id, deletionTime: IsNull() },
      { deletionTime: new Date() },
    );

    if (result.affected === 0) {
      throw new NotFoundException(`Project '${id}' not found`);
    }
  }
}
