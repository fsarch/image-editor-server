import { Module } from '@nestjs/common';
import { VersionsController } from './versions.controller.js';
import { ProjectVersionModule } from '../../../repositories/project-version/project-version.module.js';
import { RenderingModule } from '../../../rendering/rendering.module.js';
import { ParametersModule } from './parameters/parameters.module.js';
import { LayersModule } from './layers/layers.module.js';

@Module({
  controllers: [VersionsController],
  imports: [ProjectVersionModule, RenderingModule, ParametersModule, LayersModule],
})
export class VersionsModule {}
