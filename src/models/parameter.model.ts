import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Parameter, ParameterType } from '../database/entities/parameter.entity.js';

const PARAMETER_TYPES: ParameterType[] = ['text', 'image', 'number', 'object'];

export class ParameterCreateDto {
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Parent Parameter id, only meaningful when the parent has type "object"',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ description: 'The parameter key, as it appears in the render request payload' })
  @IsString()
  @MaxLength(256)
  name: string;

  @ApiProperty({ enum: PARAMETER_TYPES })
  @IsIn(PARAMETER_TYPES)
  type: ParameterType;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ required: false, nullable: true, type: Object })
  @IsOptional()
  defaultValue?: unknown;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class ParameterUpdateDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  name?: string;

  @ApiProperty({ required: false, enum: PARAMETER_TYPES })
  @IsOptional()
  @IsIn(PARAMETER_TYPES)
  type?: ParameterType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ required: false, nullable: true, type: Object })
  @IsOptional()
  defaultValue?: unknown;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class ParameterDto {
  public static FromDbo(parameter: Parameter): ParameterDto {
    const dto = new ParameterDto();

    dto.id = parameter.id;
    dto.projectVersionId = parameter.projectVersionId;
    dto.parentId = parameter.parentId;
    dto.name = parameter.name;
    dto.type = parameter.type;
    dto.required = parameter.required;
    dto.defaultValue = parameter.defaultValue;
    dto.order = parameter.order;
    dto.creationTime = parameter.creationTime;
    dto.deletionTime = parameter.deletionTime;

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  projectVersionId: string;

  @ApiProperty({ nullable: true })
  parentId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: PARAMETER_TYPES })
  type: ParameterType;

  @ApiProperty()
  required: boolean;

  @ApiProperty({ nullable: true, type: Object })
  defaultValue: unknown | null;

  @ApiProperty()
  order: number;

  @ApiProperty()
  creationTime: Date;

  @ApiProperty({ nullable: true })
  deletionTime: Date | null;
}
