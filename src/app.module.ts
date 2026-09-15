import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ControllersModule } from './controllers/controllers.module.js';
import { RepositoriesModule } from './repositories/repositories.module.js';
import { RenderingModule } from './rendering/rendering.module.js';

@Module({
  imports: [EventEmitterModule.forRoot(), RepositoriesModule, RenderingModule, ControllersModule],
})
export class AppModule {}
