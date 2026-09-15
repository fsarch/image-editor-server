import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller.js';
import { ProjectModule } from '../../repositories/project/project.module.js';
import { ProjectVersionModule } from '../../repositories/project-version/project-version.module.js';
import { RenderingModule } from '../../rendering/rendering.module.js';
import { VersionsModule } from './versions/versions.module.js';

@Module({
  controllers: [ProjectsController],
  imports: [ProjectModule, ProjectVersionModule, RenderingModule, VersionsModule],
})
export class ProjectsModule {}
