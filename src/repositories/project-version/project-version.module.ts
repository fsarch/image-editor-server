import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectVersion } from '../../database/entities/project-version.entity.js';
import { ProjectVersionService } from './project-version.service.js';

@Module({
  providers: [ProjectVersionService],
  exports: [ProjectVersionService],
  imports: [TypeOrmModule.forFeature([ProjectVersion])],
})
export class ProjectVersionModule {}
