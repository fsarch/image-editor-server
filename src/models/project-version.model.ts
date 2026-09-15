import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { ProjectVersion } from '../database/entities/project-version.entity.js';

export class ProjectVersionCreateDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  externalId?: string;

  @ApiProperty({ description: 'Canvas/output image width in pixels' })
  @IsInt()
  @IsPositive()
  width: number;

  @ApiProperty({ description: 'Canvas/output image height in pixels' })
  @IsInt()
  @IsPositive()
  height: number;
}

export class ProjectVersionUpdateDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  externalId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @IsPositive()
  width?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @IsPositive()
  height?: number;
}

export class RenderProjectVersionDto {
  @ApiProperty({
    description:
      "Arbitrary JSON payload, validated against the ProjectVersion's Parameter schema before rendering",
    type: Object,
  })
  @IsObject()
  parameters: Record<string, unknown>;
}

export class ProjectVersionDto {
  public static FromDbo(projectVersion: ProjectVersion): ProjectVersionDto {
    const dto = new ProjectVersionDto();

    dto.id = projectVersion.id;
    dto.projectId = projectVersion.projectId;
    dto.externalId = projectVersion.externalId;
    dto.isActive = projectVersion.isActive;
    dto.width = projectVersion.width;
    dto.height = projectVersion.height;
    dto.creationTime = projectVersion.creationTime;
    dto.deletionTime = projectVersion.deletionTime;

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty({ nullable: true })
  externalId: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;

  @ApiProperty()
  creationTime: Date;

  @ApiProperty({ nullable: true })
  deletionTime: Date | null;
}
