import { createServiceModule } from '@fsarch/server';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Project } from '../database/entities/project.entity.js';
import { ProjectVersion } from '../database/entities/project-version.entity.js';
import { Parameter } from '../database/entities/parameter.entity.js';
import { Layer } from '../database/entities/layer.entity.js';
import { HealthController } from '../controllers/health/health.controller.js';
import { ProjectsController } from '../controllers/projects/projects.controller.js';
import { VersionsController } from '../controllers/projects/versions/versions.controller.js';
import { ParametersController } from '../controllers/projects/versions/parameters/parameters.controller.js';
import { LayersController } from '../controllers/projects/versions/layers/layers.controller.js';
import { ProjectService } from '../repositories/project/project.service.js';
import { ProjectVersionService } from '../repositories/project-version/project-version.service.js';
import { ParameterService } from '../repositories/parameter/parameter.service.js';
import { LayerService } from '../repositories/layer/layer.service.js';
import { RenderEngineService } from '../rendering/render-engine.service.js';
import { CanvasCompositorService } from '../rendering/canvas-compositor.service.js';
import { HtmlLayerRendererService } from '../rendering/html-layer-renderer.service.js';

/**
 * The service's feature module, generated via `@fsarch/server`'s
 * `createServiceModule()` instead of hand-written as `app.module.ts` used
 * to be. Flattens what was previously an 8-module tree
 * (AppModule -> ControllersModule/RepositoriesModule/RenderingModule ->
 * HealthModule/ProjectsModule -> VersionsModule -> ParametersModule/
 * LayersModule, each repository module doing its own unscoped
 * `TypeOrmModule.forFeature(...)`) into one module, because
 * `createServiceModule()`'s single `TypeOrmModule.forFeature(entities,
 * connectionName)` call only covers providers/controllers declared
 * *directly* in the module it generates — a nested module doing its own
 * separate `forFeature()` would still bind to the *default* connection,
 * which doesn't exist in a mono-service mount (every mount gets a *named*
 * connection, see `FsArchAppBuilder.addService()`). Flattening avoids
 * threading `connectionName` through every nested module individually.
 */
export const ImageEditorServerModule = createServiceModule({
  entities: [Project, ProjectVersion, Parameter, Layer],
  controllers: [
    HealthController,
    ProjectsController,
    VersionsController,
    ParametersController,
    LayersController,
  ],
  providers: [
    ProjectService,
    ProjectVersionService,
    ParameterService,
    LayerService,
    RenderEngineService,
    CanvasCompositorService,
    HtmlLayerRendererService,
  ],
  imports: [EventEmitterModule.forRoot()],
  exports: [
    ProjectService,
    ProjectVersionService,
    ParameterService,
    LayerService,
    RenderEngineService,
  ],
});
