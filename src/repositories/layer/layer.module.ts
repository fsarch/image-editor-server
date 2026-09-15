import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Layer } from '../../database/entities/layer.entity.js';
import { LayerService } from './layer.service.js';
import { ProjectVersionModule } from '../project-version/project-version.module.js';

@Module({
  providers: [LayerService],
  exports: [LayerService],
  imports: [TypeOrmModule.forFeature([Layer]), ProjectVersionModule],
})
export class LayerModule {}
