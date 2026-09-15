import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Layer, LayerType } from '../database/entities/layer.entity.js';

const LAYER_TYPES: LayerType[] = ['text', 'image', 'shape', 'html'];

// `transformationMatrix`/`options` are deliberately only shape-checked here
// (@IsObject) rather than deeply validated per layer type via
// class-validator: their actual structure is a tree of BindableValue<T>
// leaves whose valid shape depends on `type` (see
// rendering/layer-options.types.ts). Hand-writing four redundant nested
// class-validator schemas here would duplicate that logic; instead, the
// rendering pipeline validates/resolves them at render time and reports
// clear errors there.
export class LayerCreateDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  externalId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(512)
  name: string;

  @ApiProperty({ default: 0, description: 'Paint order, ascending' })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ enum: LAYER_TYPES })
  @IsIn(LAYER_TYPES)
  type: LayerType;

  @ApiProperty({
    type: Object,
    description: 'BindableAffineMatrix: { a, b, c, d, e, f } (see rendering/layer-options.types.ts)',
  })
  @IsObject()
  transformationMatrix: unknown;

  @ApiProperty({
    type: Object,
    description: 'Layer-type-specific options, each leaf a BindableValue<T>',
  })
  @IsObject()
  options: unknown;
}

export class LayerUpdateDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  externalId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ required: false, enum: LAYER_TYPES })
  @IsOptional()
  @IsIn(LAYER_TYPES)
  type?: LayerType;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  transformationMatrix?: unknown;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  options?: unknown;
}

export class LayerDto {
  public static FromDbo(layer: Layer): LayerDto {
    const dto = new LayerDto();

    dto.id = layer.id;
    dto.projectVersionId = layer.projectVersionId;
    dto.externalId = layer.externalId;
    dto.name = layer.name;
    dto.order = layer.order;
    dto.type = layer.type;
    dto.transformationMatrix = layer.transformationMatrix;
    dto.options = layer.options;
    dto.creationTime = layer.creationTime;
    dto.deletionTime = layer.deletionTime;

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  projectVersionId: string;

  @ApiProperty({ nullable: true })
  externalId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  order: number;

  @ApiProperty({ enum: LAYER_TYPES })
  type: LayerType;

  @ApiProperty({ type: Object })
  transformationMatrix: unknown;

  @ApiProperty({ type: Object })
  options: unknown;

  @ApiProperty()
  creationTime: Date;

  @ApiProperty({ nullable: true })
  deletionTime: Date | null;
}
