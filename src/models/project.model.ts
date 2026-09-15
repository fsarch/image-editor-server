import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Project } from '../database/entities/project.entity.js';

export class ProjectCreateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(512)
  name: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Arbitrary string an external system can set to tag this project with its own id',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  externalId?: string;
}

export class ProjectUpdateDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  name?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  externalId?: string;
}

export class ProjectDto {
  public static FromDbo(project: Project): ProjectDto {
    const dto = new ProjectDto();

    dto.id = project.id;
    dto.name = project.name;
    dto.description = project.description;
    dto.externalId = project.externalId;
    dto.creationTime = project.creationTime;
    dto.deletionTime = project.deletionTime;

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true })
  externalId: string | null;

  @ApiProperty()
  creationTime: Date;

  @ApiProperty({ nullable: true })
  deletionTime: Date | null;
}
