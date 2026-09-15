# image-editor-server Requirements

This document captures all functional and technical requirements for the image-editor-server project. Update this file whenever new requirements are identified or existing ones are modified.

---

## Purpose

Render an image server-side from a reusable **Project** definition (layers with positions/content) and runtime **input parameters** — e.g. a business-card template where the name/photo differ per render call.

---

## Database Model

### Tables

#### project
- `id` UUID [pk]
- `name` varchar(512)
- `description` text [nullable]
- `external_id` varchar(256) [nullable, indexed] — arbitrary string an external system can set to tag the project with its own id
- `creation_time` timestamptz
- `deletion_time` timestamptz [nullable, soft delete]

#### project_version
- `id` UUID [pk]
- `project_id` UUID [fk -> project.id]
- `external_id` varchar(256) [nullable, indexed]
- `is_active` boolean [default: false]
- `width` integer — canvas/output image width in pixels
- `height` integer — canvas/output image height in pixels
- `creation_time` timestamptz
- `deletion_time` timestamptz [nullable, soft delete]

`width`/`height` are not part of the originally requested field list — they were added because the render pipeline cannot size a canvas without them; a ProjectVersion (one full layout/template definition) is the natural owner.

#### parameter
One node of a ProjectVersion's input-parameter schema. A flat table; `parent_id` nests children under an `object`-typed parameter, forming a tree.
- `id` UUID [pk]
- `project_version_id` UUID [fk -> project_version.id]
- `parent_id` UUID [fk -> parameter.id, nullable, self-referencing]
- `name` varchar(256) — the parameter's key, as it appears in the render request payload
- `type` varchar(32) — one of `text` | `image` | `number` | `object` (plain varchar, not a native SQL enum, for portability across postgres/cockroachdb/sqlite)
- `required` boolean [default: false]
- `default_value` json [nullable] (TypeORM `simple-json`)
- `order` integer [default: 0]
- `creation_time` timestamptz
- `deletion_time` timestamptz [nullable, soft delete]

#### layer
- `id` UUID [pk]
- `project_version_id` UUID [fk -> project_version.id]
- `external_id` varchar(256) [nullable, indexed]
- `name` varchar(512)
- `order` integer [default: 0] — paint order, ascending
- `type` varchar(32) — one of `text` | `image` | `shape` | `html` (plain varchar, same portability reasoning as `parameter.type`)
- `transformation_matrix` json — a `BindableAffineMatrix` (see below)
- `options` json — layer-type-specific, shape depends on `type` (see below)
- `creation_time` timestamptz
- `deletion_time` timestamptz [nullable, soft delete]

### Database Constraints

- **Partial unique index** on `project_version(project_id)` `WHERE is_active = true AND deletion_time IS NULL` — enforces "at most one active, non-deleted ProjectVersion per Project" at the database level.
- All migrations use `queryRunner.createTable(new Table({...}))`/`Table`-API constructs — **never raw SQL strings** (`queryRunner.query(...)`) — to stay portable across postgres/cockroachdb/sqlite. The one exception, by necessity, is the partial unique index's `where:` fragment, which TypeORM's `Table`/`TableIndex` API itself requires as a raw SQL condition string.
- Foreign keys: `project_version.project_id -> project.id`, `parameter.project_version_id -> project_version.id`, `parameter.parent_id -> parameter.id`, `layer.project_version_id -> project_version.id`.
- Cross-DB column types resolved via `src/database/migrations/utils/data-type.mapper.ts`'s `getDataType(driver, 'timestamp' | 'boolean' | 'json')`.

---

## The BindableValue Pattern (core cross-cutting concept)

Every leaf value inside a Layer's `transformationMatrix` and `options` JSON is **not** a plain literal — it is a discriminated union:

```ts
type BindableValue<T> =
  | { type: 'constant'; value: T }
  | { type: 'variable'; value: string };   // dot-path into the render request's `parameters`, e.g. "address.city"
```

- `transformationMatrix`: `{ a, b, c, d, e, f }`, each a `BindableValue<number>`. Identity = `a:1, b:0, c:0, d:1, e:0, f:0`. Maps directly onto `@napi-rs/canvas`'s `ctx.setTransform(a,b,c,d,e,f)` — an **absolute** matrix per layer, not composed with a previous layer's transform. Each layer therefore draws in its own coordinate space anchored at local `(0,0)` (top-left for image/shape/html, text baseline origin for text) — rotation/scale in the matrix pivot around that same local origin, not the layer's visual center.
- `options`, shape by `type`:
  - **text**: `content, fontFamily, fontSize, color` (all `BindableValue`), optional `textAlign: 'left'|'center'|'right'`
  - **image**: `image: BindableValue<{type:'base64', value:string}>`, `width`, `height` — extensible later to other image source types (e.g. `url`)
  - **shape**: `shape: BindableValue<'rectangle'|'ellipse'>`, `width`, `height`, optional `fillColor`, `strokeColor`, `strokeWidth`
  - **html**: `html: BindableValue<string>`, `width`, `height`

**Resolver** (`src/rendering/bindable-value-resolver.ts`): recursively walks a Layer's `transformationMatrix`/`options`, replacing every node structurally matching `{type:'constant'|'variable', value}` (exactly those two keys) with its resolved literal. Must not mistake a resolved image literal (`{type:'base64', value:'...'}`) for a BindableValue on a second pass — the strict two-key check guards this.

**Parameter → Zod schema** (`src/rendering/parameter-schema-builder.ts`): builds a validation schema from a ProjectVersion's flat Parameter list by grouping children by `parentId` (root = `null`) and recursing for `object`-typed parameters. `text→z.string()`, `number→z.number()`, `image→z.object({type:z.literal('base64'), value:z.string()})`, `object→` recursive `z.object({...})`. `required:false` → `.optional()`.

---

## Business Rules

### One active ProjectVersion per Project
- Enforced by the DB partial unique index above.
- `POST .../versions/:versionId/_actions/activate` deactivates any other active version of the same project and activates the target **inside a single DB transaction** (`ProjectVersionService.ActivateProjectVersion`) — required because the partial unique index rejects two simultaneously-active rows.
- Activating a historical (non-latest) version is allowed (rollback scenario) — `Activate` is deliberately **not** gated by the edit-lock rule below.

### Edit-lock: only the latest, non-active version is editable
- Only a project's **most recently created** (`creation_time` DESC), **non-active** ProjectVersion may be mutated — its own fields, or its Parameters/Layers.
- Enforced by `ProjectVersionService.AssertEditable(projectId, version)`, called from:
  - `ProjectVersionService.UpdateProjectVersion`
  - `ParameterService.CreateParameter` / `UpdateParameter` / `DeleteForProjectVersion`
  - `LayerService.CreateLayer` / `UpdateLayer` / `DeleteForProjectVersion`
- Violation → `409 Conflict` with a message identifying which rule failed ("not the latest version" vs. "is the active version").
- Read operations (`GET`/List) are **unrestricted** on any version, including historical ones.
- To keep editing after activating, create a new draft ProjectVersion (`POST .../versions`) — it becomes the new latest, non-active version and is editable immediately.
- `ParameterService`/`LayerService` also verify (via `ProjectVersionService.GetByIdForProject`) that the given `:versionId` actually belongs to the given `:projectId` before any operation — closing a scoping gap where a mismatched `:projectId` in the URL would otherwise be silently ignored.

---

## Rendering Pipeline

`RenderEngineService.RenderProjectVersion(versionId, parameters)`:
1. Load the ProjectVersion (404 if missing), its Parameters, and its Layers (sorted by `order`).
2. Build a Zod schema from the Parameters and validate the request's `parameters` (`400 BadRequestException` with Zod issues on failure).
3. Create an `@napi-rs/canvas` canvas sized `width`×`height`.
4. For each Layer, in order: skip it entirely if `hidden` is true (see below); otherwise resolve `transformationMatrix`/`options` via the BindableValue resolver against the validated parameters; `ctx.save()`; `ctx.setTransform(a,b,c,d,e,f)`; draw per `type` (`text→fillText`, `image→`decode base64 + `drawImage`, `shape→`path fill/stroke, `html→` see below); `ctx.restore()`.
5. Encode the canvas to PNG and return the buffer.

**Layer visibility (`hidden`)**: a boolean column on Layer (default `false`), settable via the Create/Update DTOs. A hidden layer is skipped entirely by the render pipeline — same as if it didn't exist — not merely hidden with reduced opacity. Lets an admin temporarily disable a layer (e.g. to compare variants) without deleting it; the dashboard's WYSIWYG editor mirrors this in its own live preview.

**HTML layers**: pre-rendered via a lazily-created, module-wide **shared Puppeteer browser** (`HtmlLayerRendererService`, mirrors `pdf-render-backend`'s pattern) — set viewport to the resolved width/height, transparent background, `page.setContent(html)`, screenshot to PNG (`omitBackground:true`), then drawn onto the main canvas exactly like an image layer. Puppeteer is launched with `--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage`; JavaScript execution and all network requests are disabled on the page; one retry with a fresh browser on a "target/session closed" crash.

Rendering tests (`src/rendering/render-engine.baseline.spec.ts`) exercise the **real** pipeline (real canvas, real Puppeteer) against checked-in baseline PNGs (`src/rendering/__fixtures__/baselines/`), comparing pixel-for-pixel via a hand-rolled diff (`__fixtures__/render-test.utils.ts`, decodes via `@napi-rs/canvas` itself — no extra image-diffing dependency). Baselines deliberately avoid text layers (font rendering isn't pinned across hosts/CI); shapes/images/solid-color html layers are fully deterministic. Regenerate intentionally-changed baselines via `npm run test:update-baselines`.

---

## API Requirements

### Authentication & Authorization
- `@fsarch/server`'s `.enableAuth()` (global `AuthGuard`, config-driven: `static` | `jwt-jwk` | `oidc`).
- `.enableUac(Object.values(Role))` (global `RolesGuard`) — a **deliberate deviation** from the reference project (`material-tracing-server`), which never calls `enableUac()` at all.
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — another deliberate deviation (the reference project registers no global pipe, so its `class-validator` decorators are effectively unenforced); justified here by the non-trivial nested Parameter/Layer payloads.
- `uac.type: static`'s permission matching is **exact string equality** (`grantedRoles.includes(role)`) — a `'*'` permission entry does **not** act as a wildcard, despite that being a common convention in `Role` enums across the org. List every required role explicitly in a static dev config.

### Roles (`src/constants/role.enum.ts`)
`read_project`, `write_project`, `create_project`, `delete_project`, `manage_project`, `read_project_version`, `write_project_version`, `create_project_version`, `delete_project_version`, `manage_project_version`, `activate_project_version`, `render_project`, `read_parameter`, `write_parameter`, `create_parameter`, `delete_parameter`, `read_layer`, `write_layer`, `create_layer`, `delete_layer`, `all` (`'*'`, not a real wildcard — see above).

---

## Endpoints

### Projects (`/v1/projects`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/v1/projects` | Create project | create_project |
| GET | `/v1/projects` | List projects (paginated) | read_project |
| GET | `/v1/projects/:projectId` | Get project | read_project |
| PATCH | `/v1/projects/:projectId` | Update project | write_project |
| DELETE | `/v1/projects/:projectId` | Soft-delete project | delete_project |
| POST | `/v1/projects/:projectId/_actions/render` | Render the project's **active** version | render_project |

### Project Versions (`/v1/projects/:projectId/versions`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `.../versions` | Create a new draft version | create_project_version |
| GET | `.../versions` | List versions (paginated) | read_project_version |
| GET | `.../versions/:versionId` | Get version | read_project_version |
| PATCH | `.../versions/:versionId` | Update version (edit-lock applies) | write_project_version |
| DELETE | `.../versions/:versionId` | Soft-delete version (not edit-lock gated) | delete_project_version |
| POST | `.../versions/:versionId/_actions/activate` | Activate (transactional, not edit-lock gated) | activate_project_version |
| POST | `.../versions/:versionId/_actions/render` | Render this specific version (preview) | render_project |

### Parameters (`/v1/projects/:projectId/versions/:versionId/parameters`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `.../parameters` | Create (edit-lock applies) | create_parameter |
| GET | `.../parameters` | List (paginated, unrestricted) | read_parameter |
| GET | `.../parameters/:parameterId` | Get (unrestricted) | read_parameter |
| PATCH | `.../parameters/:parameterId` | Update (edit-lock applies) | write_parameter |
| DELETE | `.../parameters/:parameterId` | Soft-delete (edit-lock applies) | delete_parameter |

### Layers (`/v1/projects/:projectId/versions/:versionId/layers`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `.../layers` | Create (edit-lock applies) | create_layer |
| GET | `.../layers` | List (paginated, unrestricted) | read_layer |
| GET | `.../layers/:layerId` | Get (unrestricted) | read_layer |
| PATCH | `.../layers/:layerId` | Update (edit-lock applies) | write_layer |
| DELETE | `.../layers/:layerId` | Soft-delete (edit-lock applies) | delete_layer |

Both render endpoints take `{ parameters: {...} }` in the body and return the rendered image as binary `image/png`.

---

## Query Behavior

- Pagination: `skip`/`take` query params, response shaped `{ data: T[], metadata: { currentPage, pageSize, totalItems, totalPages } }` (`@fsarch/server/pagination`'s `PaginationResultDto`).
- Parameters/Layers are always returned ordered by their `order` column ascending.

---

## Project Structure

- **`src/controllers/`** (plural directories, e.g. `projects/`, `projects/versions/parameters/`) — thin HTTP layer, `@ApiBearerAuth()` + `@Roles(...)` per route, PascalCase controller method names (`Create`, `List`, `Get`, `Update`, `Delete`, `Activate`, `Render`), never touch the DB directly.
- **`src/repositories/`** (singular directories/files, e.g. `project/project.service.ts`) — own the TypeORM repositories, business logic, throw `NotFoundException`/`ConflictException`.
- **`src/database/entities/`** — TypeORM entities, never returned to clients directly.
- **`src/database/migrations/`** — see Database Model above; registered in `src/database/index.ts`'s `DATABASE_OPTIONS`.
- **`src/models/`** — DTOs (`XCreateDto`/`XUpdateDto` with `class-validator` + `@ApiProperty()`, `XDto` with a static `FromDbo(entity)` mapper).
- **`src/rendering/`** — a **third layer**, deliberately separate from `controllers/`/`repositories/`: the render pipeline is DB-fremde cross-cutting logic (Zod schema building, BindableValue resolution, canvas compositing, Puppeteer) consumed by both `ProjectsController` and `VersionsController` via direct cross-module injection of `RenderEngineService`.

---

## Configuration

```yaml
database:
  type: sqlite   # or postgres / cockroachdb
  database: ./example-data/database.sqlite3

uac:
  type: 'static'
  users:
    - user_id: 'dev'
      permissions:
        - 'read_project'
        # ... list every Role value explicitly, '*' is not a wildcard (see above)

auth:
  type: 'static'
  secret: 'dev-secret-please-change'   # static auth signs/verifies HS256 JWTs with this secret, it is not a raw bearer token
```

---

## Validation

- DTOs: `class-validator` decorators (`@IsString`, `@IsIn`, `@IsInt`, `@IsPositive`, `@IsBoolean`, `@IsObject`, `@MaxLength`, `@IsOptional`), enforced by the global `ValidationPipe`.
- `Layer.transformationMatrix`/`options` are deliberately only shape-checked (`@IsObject()`) at the DTO layer, not deeply validated per layer type via `class-validator` — the actual typed, BindableValue-aware validation happens in the rendering pipeline at render time (see BindableValue Pattern above), avoiding four redundant hand-written nested schemas.
- Render-time parameter validation: dynamic Zod schema built from the ProjectVersion's Parameter tree (see above).

---

## Testing

- Vitest, co-located `*.spec.ts` next to source.
- Repository services: `getRepositoryToken(Entity)` mocked via `useValue: {}`/`vi.fn()` (mirrors `material-tracing-server`'s convention).
- Controllers: `should be defined` smoke tests with fully-mocked service dependencies.
- Rendering: both mocked-orchestration tests (`render-engine.service.spec.ts`) and real-pipeline baseline-image tests (`render-engine.baseline.spec.ts`, see Rendering Pipeline above).

---

## Docker / Deployment

- Multi-stage `node:24-bullseye-slim` build (glibc, not Alpine — required for Chromium's `apt` package; `@napi-rs/canvas` itself needs no system packages, ships prebuilt Skia binaries).
- `apt-get install chromium fonts-recommended`, `ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`.
- `ENV NODE_OPTIONS="--import @fsarch/server/register"` for OpenTelemetry auto-instrumentation.
- Non-root `USER node`; `HEALTHCHECK` against `GET /health` (`@Public()`, bypasses auth).

---

## Related: Dashboard Admin UI

An admin UI for this service exists in `fsarch/dashboard` as the **"Image Editor"** app (`/image-editor-server`). Project/ProjectVersion/Parameter use the dashboard's `GeneratedForm` convention; **Layer management is a bespoke WYSIWYG canvas editor** (`react-moveable`-based drag/resize/rotate, mirroring this service's transformation-matrix/BindableValue model directly in its UI) rather than a generated form. See that repo's own `requirements.md`/`AGENTS.md` for its requirements — not duplicated here.

---

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-14 | Initial requirements documentation, covering the full v1 build (domain model, BindableValue pattern, rendering pipeline, edit-lock rule, API surface) | Claude |
