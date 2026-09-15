import { Test, TestingModule } from '@nestjs/testing';
import { VersionsController } from './versions.controller.js';
import { ProjectVersionService } from '../../../repositories/project-version/project-version.service.js';
import { RenderEngineService } from '../../../rendering/render-engine.service.js';

describe('VersionsController', () => {
  let controller: VersionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VersionsController],
      providers: [
        { provide: ProjectVersionService, useValue: {} },
        { provide: RenderEngineService, useValue: {} },
      ],
    }).compile();

    controller = module.get<VersionsController>(VersionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
