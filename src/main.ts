import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { FsArchAppBuilder } from '@fsarch/server';
import { AppModule } from './app.module.js';
import { DATABASE_OPTIONS } from './database/index.js';
import { Role } from './constants/role.enum.js';

async function bootstrap() {
  const app = await new FsArchAppBuilder(AppModule, {
    name: 'Image-Editor-Server',
    version: '1.0.0',
  })
    .addSwagger({
      title: 'Image-Editor-Server',
      description: 'Server-side image rendering from Project/Layer definitions and input parameters',
      version: '1.0',
    })
    .enableAuth()
    // Deliberate deviation from material-tracing-server, which has
    // .enableAuth() but never calls .enableUac(...) at all. This service's
    // write/render endpoints benefit from role scoping from day one, and
    // there's precedent for it elsewhere in the org (e.g. dblight-server,
    // printer-server, metric-server all call enableUac(Object.values(Role))).
    .enableUac(Object.values(Role))
    .setDatabase(DATABASE_OPTIONS)
    .enableSoftDeletion()
    .build();

  // Deliberate deviation from material-tracing-server, which has no global
  // ValidationPipe despite class-validator decorators on its DTOs (so
  // they're effectively unenforced there). This service's Parameter/Layer
  // payloads are non-trivial nested trees that need real enforcement.
  // Mirrors dblight-server's exact wiring.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 8080);
}

bootstrap();
