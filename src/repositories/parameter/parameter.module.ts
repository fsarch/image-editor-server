import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parameter } from '../../database/entities/parameter.entity.js';
import { ParameterService } from './parameter.service.js';
import { ProjectVersionModule } from '../project-version/project-version.module.js';

@Module({
  providers: [ParameterService],
  exports: [ParameterService],
  imports: [TypeOrmModule.forFeature([Parameter]), ProjectVersionModule],
})
export class ParameterModule {}
