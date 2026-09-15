import { Module } from '@nestjs/common';
import { LayersController } from './layers.controller.js';
import { LayerModule } from '../../../../repositories/layer/layer.module.js';

@Module({
  controllers: [LayersController],
  imports: [LayerModule],
})
export class LayersModule {}
