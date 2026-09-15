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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '@fsarch/server/uac';
import { ApiOkPaginatedResponse, PaginationResultDto } from '@fsarch/server/pagination';
import { LayerService } from '../../../../repositories/layer/layer.service.js';
import { LayerCreateDto, LayerDto, LayerUpdateDto } from '../../../../models/layer.model.js';
import { Role } from '../../../../constants/role.enum.js';

// Write operations (Create/Update/Delete) are only permitted on the
// project's most recently created, non-active ProjectVersion - enforced by
// LayerService via ProjectVersionService.AssertEditable, which throws a 409
// Conflict otherwise. Read operations (List/Get) work on any version.
@ApiTags('layers')
@ApiBearerAuth()
@Controller({ path: 'projects/:projectId/versions/:versionId/layers', version: '1' })
export class LayersController {
  constructor(private readonly layerService: LayerService) {}

  @Post()
  @Roles(Role.create_layer)
  @HttpCode(HttpStatus.CREATED)
  public async Create(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Body() createDto: LayerCreateDto,
  ): Promise<LayerDto> {
    const layer = await this.layerService.CreateLayer(projectId, versionId, createDto);
    return LayerDto.FromDbo(layer);
  }

  @Get()
  @Roles(Role.read_layer)
  @ApiOkPaginatedResponse(LayerDto)
  public async List(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 25,
  ): Promise<PaginationResultDto<LayerDto>> {
    const [items, totalItems] = await this.layerService.ListForProjectVersion(
      projectId,
      versionId,
      skip,
      take,
    );

    return {
      data: items.map(LayerDto.FromDbo),
      metadata: {
        currentPage: Math.floor(skip / take) + 1,
        pageSize: take,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / take)),
      },
    };
  }

  @Get('/:layerId')
  @Roles(Role.read_layer)
  public async Get(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('layerId') layerId: string,
  ): Promise<LayerDto> {
    const layer = await this.layerService.GetByIdForProjectVersion(projectId, versionId, layerId);
    return LayerDto.FromDbo(layer);
  }

  @Patch('/:layerId')
  @Roles(Role.write_layer)
  public async Update(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('layerId') layerId: string,
    @Body() updateDto: LayerUpdateDto,
  ): Promise<LayerDto> {
    const layer = await this.layerService.UpdateLayer(projectId, versionId, layerId, updateDto);
    return LayerDto.FromDbo(layer);
  }

  @Delete('/:layerId')
  @Roles(Role.delete_layer)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async Delete(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('layerId') layerId: string,
  ): Promise<void> {
    await this.layerService.DeleteForProjectVersion(projectId, versionId, layerId);
  }
}
