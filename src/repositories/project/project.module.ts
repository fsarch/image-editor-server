import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../database/entities/project.entity.js';
import { ProjectService } from './project.service.js';

@Module({
  providers: [ProjectService],
  exports: [ProjectService],
  imports: [TypeOrmModule.forFeature([Project])],
})
export class ProjectModule {}
