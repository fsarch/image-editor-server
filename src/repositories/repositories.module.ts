import { Module } from '@nestjs/common';
import { ProjectModule } from './project/project.module.js';
import { ProjectVersionModule } from './project-version/project-version.module.js';
import { ParameterModule } from './parameter/parameter.module.js';
import { LayerModule } from './layer/layer.module.js';

@Module({
  imports: [ProjectModule, ProjectVersionModule, ParameterModule, LayerModule],
})
export class RepositoriesModule {}
