import { Module } from '@nestjs/common';
import { ParametersController } from './parameters.controller.js';
import { ParameterModule } from '../../../../repositories/parameter/parameter.module.js';

@Module({
  controllers: [ParametersController],
  imports: [ParameterModule],
})
export class ParametersModule {}
