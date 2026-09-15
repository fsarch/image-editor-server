import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '@fsarch/server/uac';
import { ApiOkPaginatedResponse, PaginationResultDto } from '@fsarch/server/pagination';
import type { Response } from 'express';
import { ProjectService } from '../../repositories/project/project.service.js';
import { ProjectVersionService } from '../../repositories/project-version/project-version.service.js';
import { RenderEngineService } from '../../rendering/render-engine.service.js';
import { ProjectCreateDto, ProjectDto, ProjectUpdateDto } from '../../models/project.model.js';
import { RenderProjectVersionDto } from '../../models/project-version.model.js';
import { Role } from '../../constants/role.enum.js';

@ApiTags('projects')
@ApiBearerAuth()
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly projectVersionService: ProjectVersionService,
    private readonly renderEngineService: RenderEngineService,
  ) {}

  @Post()
  @Roles(Role.create_project)
  @HttpCode(HttpStatus.CREATED)
  public async Create(@Body() createDto: ProjectCreateDto): Promise<ProjectDto> {
    const project = await this.projectService.CreateProject(createDto);
    return ProjectDto.FromDbo(project);
  }

  @Get()
  @Roles(Role.read_project)
  @ApiOkPaginatedResponse(ProjectDto)
  public async List(
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 25,
  ): Promise<PaginationResultDto<ProjectDto>> {
    const [items, totalItems] = await this.projectService.ListProjects(skip, take);

    return {
      data: items.map(ProjectDto.FromDbo),
      metadata: {
        currentPage: Math.floor(skip / take) + 1,
        pageSize: take,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / take)),
      },
    };
  }

  @Get('/:projectId')
  @Roles(Role.read_project)
  public async Get(@Param('projectId') projectId: string): Promise<ProjectDto> {
    const project = await this.projectService.GetById(projectId);
    return ProjectDto.FromDbo(project);
  }

  @Patch('/:projectId')
  @Roles(Role.write_project)
  public async Update(
    @Param('projectId') projectId: string,
    @Body() updateDto: ProjectUpdateDto,
  ): Promise<ProjectDto> {
    const project = await this.projectService.UpdateProject(projectId, updateDto);
    return ProjectDto.FromDbo(project);
  }

  @Delete('/:projectId')
  @Roles(Role.delete_project)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async Delete(@Param('projectId') projectId: string): Promise<void> {
    await this.projectService.DeleteById(projectId);
  }

  @Post('/:projectId/_actions/render')
  @Roles(Role.render_project)
  public async RenderActiveVersion(
    @Param('projectId') projectId: string,
    @Body() body: RenderProjectVersionDto,
    @Res() res: Response,
  ): Promise<void> {
    const activeVersion = await this.projectVersionService.GetActiveForProject(projectId);

    if (!activeVersion) {
      throw new NotFoundException(`Project '${projectId}' has no active version`);
    }

    const pngBuffer = await this.renderEngineService.RenderProjectVersion(
      activeVersion.id,
      body.parameters,
    );

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pngBuffer.length,
    });
    res.send(pngBuffer);
  }
}
