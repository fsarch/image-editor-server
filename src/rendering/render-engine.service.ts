import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import { ProjectVersionService } from '../repositories/project-version/project-version.service.js';
import { ParameterService } from '../repositories/parameter/parameter.service.js';
import { LayerService } from '../repositories/layer/layer.service.js';
import { buildParameterSchema } from './parameter-schema-builder.js';
import { resolveBindableTree } from './bindable-value-resolver.js';
import { CanvasCompositorService } from './canvas-compositor.service.js';
import { HtmlLayerRendererService } from './html-layer-renderer.service.js';
import {
  AffineMatrix,
  ResolvedHtmlLayerOptions,
  ResolvedImageLayerOptions,
  ResolvedShapeLayerOptions,
  ResolvedTextLayerOptions,
} from './layer-options.types.js';

@Injectable()
export class RenderEngineService {
  constructor(
    private readonly projectVersionService: ProjectVersionService,
    private readonly parameterService: ParameterService,
    private readonly layerService: LayerService,
    private readonly compositor: CanvasCompositorService,
    private readonly htmlRenderer: HtmlLayerRendererService,
  ) {}

  public async RenderProjectVersion(
    projectVersionId: string,
    rawParameters: Record<string, unknown> | undefined,
  ): Promise<Buffer> {
    const projectVersion = await this.projectVersionService.GetById(projectVersionId);
    if (!projectVersion) {
      throw new NotFoundException(`ProjectVersion '${projectVersionId}' not found`);
    }

    const parameters = await this.parameterService.ListByProjectVersion(projectVersionId);
    const layers = await this.layerService.ListByProjectVersion(projectVersionId);

    const schema = buildParameterSchema(parameters);
    const parseResult = schema.safeParse(rawParameters ?? {});

    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid render parameters',
        issues: parseResult.error.issues,
      });
    }

    const validatedParameters = parseResult.data as Record<string, unknown>;

    const canvas = createCanvas(projectVersion.width, projectVersion.height);
    const ctx = canvas.getContext('2d');

    // Layers already come back ordered by `order` from LayerService, but
    // sort defensively here since paint order is load-bearing correctness,
    // not just a display nicety.
    const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

    for (const layer of sortedLayers) {
      // A hidden layer is skipped entirely, same as if it didn't exist -
      // lets an admin temporarily disable it (e.g. to compare variants)
      // without deleting it. Not just a dashboard-preview affordance: the
      // actual rendered PNG omits it too.
      if (layer.hidden) continue;

      const transform = resolveBindableTree(
        layer.transformationMatrix,
        validatedParameters,
      ) as AffineMatrix;

      const options = resolveBindableTree(layer.options, validatedParameters);

      ctx.save();
      // `setTransform` replaces rather than composes the CTM, so each layer
      // draws in its own coordinate space anchored at (0,0), independent of
      // any previous layer's transform. save()/restore() here only guards
      // against style-property leakage (fillStyle, font, textAlign) between
      // layers.
      ctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);

      switch (layer.type) {
        case 'text':
          this.compositor.drawText(ctx, options as ResolvedTextLayerOptions);
          break;
        case 'image':
          await this.compositor.drawImage(ctx, options as ResolvedImageLayerOptions);
          break;
        case 'shape':
          this.compositor.drawShape(ctx, options as ResolvedShapeLayerOptions);
          break;
        case 'html': {
          const htmlOptions = options as ResolvedHtmlLayerOptions;
          const pngBuffer = await this.htmlRenderer.RenderToPng(
            htmlOptions.html,
            htmlOptions.width,
            htmlOptions.height,
          );
          await this.compositor.drawImageBuffer(
            ctx,
            pngBuffer,
            htmlOptions.width,
            htmlOptions.height,
          );
          break;
        }
        default:
          throw new Error(`Unsupported layer type "${layer.type}"`);
      }

      ctx.restore();
    }

    return canvas.encode('png');
  }
}
