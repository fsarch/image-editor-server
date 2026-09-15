import { Test, TestingModule } from '@nestjs/testing';
import { ParametersController } from './parameters.controller.js';
import { ParameterService } from '../../../../repositories/parameter/parameter.service.js';

describe('ParametersController', () => {
  let controller: ParametersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParametersController],
      providers: [{ provide: ParameterService, useValue: {} }],
    }).compile();

    controller = module.get<ParametersController>(ParametersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
