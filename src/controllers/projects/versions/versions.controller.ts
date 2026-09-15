import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { ProjectVersionService } from '../../../repositories/project-version/project-version.service.js';
import { RenderEngineService } from '../../../rendering/render-engine.service.js';
import {
  ProjectVersionCreateDto,
  ProjectVersionDto,
  ProjectVersionUpdateDto,
  RenderProjectVersionDto,
} from '../../../models/project-version.model.js';
import { Role } from '../../../constants/role.enum.js';

@ApiTags('project-versions')
@ApiBearerAuth()
@Controller({ path: 'projects/:projectId/versions', version: '1' })
export class VersionsController {
  constructor(
    private readonly projectVersionService: ProjectVersionService,
    private readonly renderEngineService: RenderEngineService,
  ) {}

  @Post()
  @Roles(Role.create_project_version)
  @HttpCode(HttpStatus.CREATED)
  public async Create(
    @Param('projectId') projectId: string,
    @Body() createDto: ProjectVersionCreateDto,
  ): Promise<ProjectVersionDto> {
    const version = await this.projectVersionService.CreateProjectVersion(projectId, createDto);
    return ProjectVersionDto.FromDbo(version);
  }

  @Get()
  @Roles(Role.read_project_version)
  @ApiOkPaginatedResponse(ProjectVersionDto)
  public async List(
    @Param('projectId') projectId: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 25,
  ): Promise<PaginationResultDto<ProjectVersionDto>> {
    const [items, totalItems] = await this.projectVersionService.ListForProject(
      projectId,
      skip,
      take,
    );

    return {
      data: items.map(ProjectVersionDto.FromDbo),
      metadata: {
        currentPage: Math.floor(skip / take) + 1,
        pageSize: take,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / take)),
      },
    };
  }

  @Get('/:versionId')
  @Roles(Role.read_project_version)
  public async Get(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
  ): Promise<ProjectVersionDto> {
    const version = await this.projectVersionService.GetByIdForProject(projectId, versionId);
    return ProjectVersionDto.FromDbo(version);
  }

  @Patch('/:versionId')
  @Roles(Role.write_project_version)
  public async Update(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Body() updateDto: ProjectVersionUpdateDto,
  ): Promise<ProjectVersionDto> {
    const version = await this.projectVersionService.UpdateProjectVersion(
      projectId,
      versionId,
      updateDto,
    );
    return ProjectVersionDto.FromDbo(version);
  }

  @Delete('/:versionId')
  @Roles(Role.delete_project_version)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async Delete(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
  ): Promise<void> {
    await this.projectVersionService.DeleteForProject(projectId, versionId);
  }

  @Post('/:versionId/_actions/activate')
  @Roles(Role.activate_project_version)
  public async Activate(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
  ): Promise<ProjectVersionDto> {
    const version = await this.projectVersionService.ActivateProjectVersion(projectId, versionId);
    return ProjectVersionDto.FromDbo(version);
  }

  @Post('/:versionId/_actions/render')
  @Roles(Role.render_project)
  public async Render(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Body() body: RenderProjectVersionDto,
    @Res() res: Response,
  ): Promise<void> {
    // Throws NotFoundException if projectId/versionId don't match, which is
    // exactly the guard needed before rendering.
    await this.projectVersionService.GetByIdForProject(projectId, versionId);

    const pngBuffer = await this.renderEngineService.RenderProjectVersion(
      versionId,
      body.parameters,
    );

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pngBuffer.length,
    });
    res.send(pngBuffer);
  }
}
