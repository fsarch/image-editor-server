# Image Editor Server

Renders images server-side from a reusable **Project** template (positioned layers) and runtime **input parameters** — e.g. a business-card layout where the name and photo differ per render call.

- **[requirements.md](./requirements.md)** — functional requirements and technical specification (data model, BindableValue pattern, rendering pipeline, business rules, API).
- **[AGENTS.md](./AGENTS.md)** — architectural conventions for anyone (human or AI) working on this codebase.

## Features

- **Projects & Versions**: a Project has multiple ProjectVersions; exactly one may be `active` at a time. Only the most recently created, non-active version is editable (see requirements.md's edit-lock rule) — activate a version to "publish" it, create a new draft to keep editing.
- **Parameters**: a per-version, typed input schema (`text` / `image` / `number` / `object`, recursively nestable) validated at render time.
- **Layers**: `text` / `image` / `shape` / `html`, each with a 2D affine transform and type-specific options. Every leaf value can be a hard-coded constant or bound to a render-time parameter (the `BindableValue` pattern).
- **Rendering**: `@napi-rs/canvas` compositing; `html` layers are pre-rendered via a shared headless Puppeteer browser and drawn onto the canvas like an image.

## Configuration

Create a `config/config.yml` file:

```yaml
database:
  type: sqlite   # or postgres / cockroachdb
  database: ./example-data/database.sqlite3

uac:
  type: 'static'
  users:
    - user_id: 'dev'
      permissions:
        # list every Role value the routes you'll use require - '*' is not a wildcard here, see requirements.md
        - 'read_project'
        - 'write_project'
        - 'create_project'
        - 'delete_project'
        - 'read_project_version'
        - 'write_project_version'
        - 'create_project_version'
        - 'delete_project_version'
        - 'activate_project_version'
        - 'render_project'
        - 'read_parameter'
        - 'write_parameter'
        - 'create_parameter'
        - 'delete_parameter'
        - 'read_layer'
        - 'write_layer'
        - 'create_layer'
        - 'delete_layer'

auth:
  type: 'static'
  secret: 'dev-secret-please-change'   # HS256 JWT secret, not a raw bearer token - see requirements.md
```

`CONFIG_FILE_PATH` overrides the default `config.yaml` lookup path (e.g. `CONFIG_FILE_PATH=./config/config.yml`).

## API Endpoints

Full table (including roles) in [requirements.md](./requirements.md#endpoints). Summary:

- `/v1/projects` — Project CRUD, `POST /:projectId/_actions/render`
- `/v1/projects/:projectId/versions` — ProjectVersion CRUD, `POST /:versionId/_actions/activate`, `POST /:versionId/_actions/render`
- `/v1/projects/:projectId/versions/:versionId/parameters` — Parameter CRUD
- `/v1/projects/:projectId/versions/:versionId/layers` — Layer CRUD

Swagger UI is served once the app is running (see `.addSwagger(...)` in `src/main.ts`).

## Database Schema

- `project`, `project_version`, `parameter`, `layer` — see [requirements.md](./requirements.md#database-model) for full column/constraint definitions.

## Running the Server

```bash
npm install
npm run build

# Development
CONFIG_FILE_PATH=./config/config.yml npm run start:dev

# Production
npm run build
CONFIG_FILE_PATH=./config/config.yml npm run start:prod

# With Docker
docker build -t image-editor-server .
docker run -p 3000:3000 -v $(pwd)/config:/usr/src/app/config image-editor-server
```

## Running Migrations

Migrations auto-run on startup. To run them manually:

```bash
npm run migration:run
```

## Testing

```bash
npm test              # unit + real-pipeline baseline-image rendering tests
npm run test:cov      # with coverage
npm run test:update-baselines   # regenerate rendering baseline fixtures after an intentional change
```

## Admin UI

An admin UI (`GeneratedForm`-based CRUD for Projects/Versions/Parameters, a bespoke WYSIWYG layer editor) lives in the `fsarch/dashboard` repository as the "Image Editor" app.
