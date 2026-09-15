import { Module } from '@nestjs/common';
import { ProjectVersionModule } from '../repositories/project-version/project-version.module.js';
import { ParameterModule } from '../repositories/parameter/parameter.module.js';
import { LayerModule } from '../repositories/layer/layer.module.js';
import { RenderEngineService } from './render-engine.service.js';
import { CanvasCompositorService } from './canvas-compositor.service.js';
import { HtmlLayerRendererService } from './html-layer-renderer.service.js';

@Module({
  imports: [ProjectVersionModule, ParameterModule, LayerModule],
  providers: [RenderEngineService, CanvasCompositorService, HtmlLayerRendererService],
  exports: [RenderEngineService],
})
export class RenderingModule {}
