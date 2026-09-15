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
import { ParameterService } from '../../../../repositories/parameter/parameter.service.js';
import {
  ParameterCreateDto,
  ParameterDto,
  ParameterUpdateDto,
} from '../../../../models/parameter.model.js';
import { Role } from '../../../../constants/role.enum.js';

// Write operations (Create/Update/Delete) are only permitted on the
// project's most recently created, non-active ProjectVersion - enforced by
// ParameterService via ProjectVersionService.AssertEditable, which throws a
// 409 Conflict otherwise. Read operations (List/Get) work on any version.
@ApiTags('parameters')
@ApiBearerAuth()
@Controller({ path: 'projects/:projectId/versions/:versionId/parameters', version: '1' })
export class ParametersController {
  constructor(private readonly parameterService: ParameterService) {}

  @Post()
  @Roles(Role.create_parameter)
  @HttpCode(HttpStatus.CREATED)
  public async Create(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Body() createDto: ParameterCreateDto,
  ): Promise<ParameterDto> {
    const parameter = await this.parameterService.CreateParameter(projectId, versionId, createDto);
    return ParameterDto.FromDbo(parameter);
  }

  @Get()
  @Roles(Role.read_parameter)
  @ApiOkPaginatedResponse(ParameterDto)
  public async List(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 25,
  ): Promise<PaginationResultDto<ParameterDto>> {
    const [items, totalItems] = await this.parameterService.ListForProjectVersion(
      projectId,
      versionId,
      skip,
      take,
    );

    return {
      data: items.map(ParameterDto.FromDbo),
      metadata: {
        currentPage: Math.floor(skip / take) + 1,
        pageSize: take,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / take)),
      },
    };
  }

  @Get('/:parameterId')
  @Roles(Role.read_parameter)
  public async Get(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('parameterId') parameterId: string,
  ): Promise<ParameterDto> {
    const parameter = await this.parameterService.GetByIdForProjectVersion(
      projectId,
      versionId,
      parameterId,
    );
    return ParameterDto.FromDbo(parameter);
  }

  @Patch('/:parameterId')
  @Roles(Role.write_parameter)
  public async Update(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('parameterId') parameterId: string,
    @Body() updateDto: ParameterUpdateDto,
  ): Promise<ParameterDto> {
    const parameter = await this.parameterService.UpdateParameter(
      projectId,
      versionId,
      parameterId,
      updateDto,
    );
    return ParameterDto.FromDbo(parameter);
  }

  @Delete('/:parameterId')
  @Roles(Role.delete_parameter)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async Delete(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Param('parameterId') parameterId: string,
  ): Promise<void> {
    await this.parameterService.DeleteForProjectVersion(projectId, versionId, parameterId);
  }
}
