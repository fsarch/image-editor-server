import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { ProjectsModule } from './projects/projects.module.js';

@Module({
  imports: [HealthModule, ProjectsModule],
})
export class ControllersModule {}
