import { Project } from './entities/project.entity.js';
import { ProjectVersion } from './entities/project-version.entity.js';
import { Parameter } from './entities/parameter.entity.js';
import { Layer } from './entities/layer.entity.js';
import { BaseTables1757756400000 } from './migrations/1757756400000-base-tables.js';

export const DATABASE_OPTIONS = {
  entities: [Project, ProjectVersion, Parameter, Layer],
  migrations: [BaseTables1757756400000],
};
