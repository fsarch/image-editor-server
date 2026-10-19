import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { FsArchAppBuilder } from '@fsarch/server';
import { descriptor } from './lib/index.js';

async function bootstrap() {
  // `descriptor.module.register()` with no arguments = default TypeORM
  // connection, no guards applied — identical to the plain `AppModule` this
  // used to pass. The builder calls below are unchanged from before; they
  // now just read their values from `descriptor` instead of duplicating
  // them, so this stays the single source of truth shared with a
  // mono-service harness's `.addService({ id, ...descriptor })`.
  const app = await new FsArchAppBuilder(descriptor.module.register(), {
    name: 'Image-Editor-Server',
    version: '1.0.0',
  })
    .addSwagger(descriptor.swagger)
    .enableAuth()
    // Deliberate deviation from material-tracing-server, which has
    // .enableAuth() but never calls .enableUac(...) at all. This service's
    // write/render endpoints benefit from role scoping from day one, and
    // there's precedent for it elsewhere in the org (e.g. dblight-server,
    // printer-server, metric-server all call enableUac(Object.values(Role))).
    .enableUac(descriptor.uac.roles)
    .setDatabase({ entities: descriptor.entities, migrations: descriptor.migrations })
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
