import { vi } from 'vitest';
import { CanvasCompositorService } from './canvas-compositor.service.js';

const fakeImage = { width: 10, height: 10 };

vi.mock('@napi-rs/canvas', () => ({
  loadImage: vi.fn(async () => fakeImage),
}));

function makeContext() {
  return {
    fillText: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    textAlign: 'left',
    textBaseline: 'alphabetic',
  } as any;
}

describe('CanvasCompositorService', () => {
  const service = new CanvasCompositorService();

  it('drawText sets font/fillStyle/alignment and calls fillText at the origin', () => {
    const ctx = makeContext();
    service.drawText(ctx, {
      content: 'Hello',
      fontFamily: 'sans-serif',
      fontSize: 24,
      color: '#111',
    });

    expect(ctx.font).toBe('24px sans-serif');
    expect(ctx.fillStyle).toBe('#111');
    expect(ctx.fillText).toHaveBeenCalledWith('Hello', 0, 0);
  });

  it('drawImage decodes base64 and draws at the given size', async () => {
    const ctx = makeContext();
    await service.drawImage(ctx, {
      image: { type: 'base64', value: Buffer.from('pixels').toString('base64') },
      width: 50,
      height: 60,
    });

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeImage, 0, 0, 50, 60);
  });

  it('drawShape fills and strokes a rectangle', () => {
    const ctx = makeContext();
    service.drawShape(ctx, {
      shape: 'rectangle',
      width: 100,
      height: 50,
      fillColor: '#fff',
      strokeColor: '#000',
      strokeWidth: 2,
    });

    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 100, 50);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.lineWidth).toBe(2);
  });

  it('drawShape draws an ellipse centered in its bounding box', () => {
    const ctx = makeContext();
    service.drawShape(ctx, { shape: 'ellipse', width: 100, height: 50 });

    expect(ctx.ellipse).toHaveBeenCalledWith(50, 25, 50, 25, 0, 0, 2 * Math.PI);
  });
});
