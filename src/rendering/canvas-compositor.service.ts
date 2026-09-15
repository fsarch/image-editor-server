import { Injectable } from '@nestjs/common';
import { loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import {
  ResolvedImageLayerOptions,
  ResolvedShapeLayerOptions,
  ResolvedTextLayerOptions,
} from './layer-options.types.js';

function decodeBase64Image(value: string): Buffer {
  // Tolerate both a raw base64 string and a data: URL.
  const base64 = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
  return Buffer.from(base64, 'base64');
}

@Injectable()
export class CanvasCompositorService {
  public drawText(ctx: SKRSContext2D, options: ResolvedTextLayerOptions): void {
    ctx.font = `${options.fontSize}px ${options.fontFamily}`;
    ctx.fillStyle = options.color;
    ctx.textAlign = options.textAlign ?? 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(options.content, 0, 0);
  }

  public async drawImage(ctx: SKRSContext2D, options: ResolvedImageLayerOptions): Promise<void> {
    const buffer = decodeBase64Image(options.image.value);
    await this.drawImageBuffer(ctx, buffer, options.width, options.height);
  }

  public async drawImageBuffer(
    ctx: SKRSContext2D,
    buffer: Buffer,
    width: number,
    height: number,
  ): Promise<void> {
    const image = await loadImage(buffer);
    ctx.drawImage(image, 0, 0, width, height);
  }

  public drawShape(ctx: SKRSContext2D, options: ResolvedShapeLayerOptions): void {
    ctx.beginPath();

    if (options.shape === 'rectangle') {
      ctx.rect(0, 0, options.width, options.height);
    } else {
      ctx.ellipse(
        options.width / 2,
        options.height / 2,
        options.width / 2,
        options.height / 2,
        0,
        0,
        2 * Math.PI,
      );
    }

    if (options.fillColor) {
      ctx.fillStyle = options.fillColor;
      ctx.fill();
    }

    if (options.strokeColor) {
      ctx.strokeStyle = options.strokeColor;
      ctx.lineWidth = options.strokeWidth ?? 1;
      ctx.stroke();
    }
  }
}
