import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller.js';
import { ProjectService } from '../../repositories/project/project.service.js';
import { ProjectVersionService } from '../../repositories/project-version/project-version.service.js';
import { RenderEngineService } from '../../rendering/render-engine.service.js';

describe('ProjectsController', () => {
  let controller: ProjectsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectService, useValue: {} },
        { provide: ProjectVersionService, useValue: {} },
        { provide: RenderEngineService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
