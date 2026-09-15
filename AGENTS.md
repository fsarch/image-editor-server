# image-editor-server Project Conventions

This document outlines the architectural conventions and structure for the image-editor-server project, built on `@fsarch/server`. Follow these guidelines to ensure consistency across the codebase.

---

## Module & Controller Structure

### Directory Naming Rules

- **Controller directories**: plural (e.g. `projects/`, `projects/versions/parameters/`, `projects/versions/layers/`)
- **Repository service files**: singular (e.g. `project.service.ts`, `project-version.service.ts`, `parameter.service.ts`, `layer.service.ts`)
- **Controller classes**: plural, matching the resource collection (e.g. `ProjectsController`, `VersionsController`, `ParametersController`, `LayersController`)
- **Controller methods**: PascalCase verbs (`Create`, `List`, `Get`, `Update`, `Delete`, plus resource-specific actions like `Activate`, `RenderActiveVersion`, `Render`)

### Standard Structure

```
src/
├── main.ts, app.module.ts
├── constants/role.enum.ts
├── database/
│   ├── index.ts                          # DATABASE_OPTIONS { entities, migrations }
│   ├── entities/{project,project-version,parameter,layer}.entity.ts
│   └── migrations/
│       ├── utils/data-type.mapper.ts
│       └── <timestamp>-base-tables.ts
├── models/{project,project-version,parameter,layer}.model.ts   # Create/Update-Dto + Dto.FromDbo()
├── repositories/
│   ├── repositories.module.ts
│   └── {project,project-version,parameter,layer}/*.service.ts (+module, +spec)
├── rendering/                              # third layer, see below
│   ├── rendering.module.ts
│   ├── bindable-value.ts, bindable-value-resolver.ts
│   ├── parameter-schema-builder.ts
│   ├── layer-options.types.ts
│   ├── canvas-compositor.service.ts
│   ├── html-layer-renderer.service.ts
│   ├── render-engine.service.ts
│   └── __fixtures__/                       # baseline-image test fixtures, excluded from the build (see tsconfig.build.json)
└── controllers/
    ├── controllers.module.ts
    ├── health/health.controller.ts (+module)
    └── projects/
        ├── projects.controller.ts (+module, +spec)   # inkl. POST /:projectId/_actions/render
        └── versions/
            ├── versions.controller.ts (+module, +spec)  # inkl. _actions/activate, _actions/render
            ├── parameters/parameters.controller.ts (+module, +spec)
            └── layers/layers.controller.ts (+module, +spec)
```

### The `rendering/` Layer

A deliberate **third layer** alongside `controllers/` and `repositories/`: the render pipeline (Zod schema building, BindableValue resolution, `@napi-rs/canvas` compositing, Puppeteer for HTML layers) is cross-cutting logic, not owned by a single entity's CRUD service. `RenderEngineService` is consumed by both `ProjectsController` and `VersionsController` via direct cross-module injection — the same pattern `MaterialsController` uses to inject `MaterialTypeService` in the sibling reference project.

### Module Dependencies

- `ParameterModule`/`LayerModule` import `ProjectVersionModule` (for `ProjectVersionService.GetByIdForProject`/`AssertEditable`, used to enforce cross-resource ownership and the edit-lock rule — see requirements.md).
- `RenderingModule` imports `ProjectVersionModule`, `ParameterModule`, `LayerModule`.
- `ProjectsModule`/`VersionsModule` import `RenderingModule` to get `RenderEngineService`.

---

## Entity Conventions

Mirrors `material-tracing-server`'s `material.entity.ts` exactly:
- `@PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk__<table>' })`
- snake_case DB columns via `@Column({ name: '...' })` mapped to camelCase TS fields
- `@CreateDateColumn({ name: 'creation_time' })`, `@DeleteDateColumn({ name: 'deletion_time' })` for soft delete
- **No TypeORM relation decorators** (`@ManyToOne` etc.) anywhere — foreign keys are plain `uuid` columns, joined manually in service code
- `type` discriminator columns (`Parameter.type`, `Layer.type`) are plain `varchar`, not native SQL enums, for cross-DB portability — validated at the application layer instead

---

## Database & Migrations

- Migrations use **only** `queryRunner.createTable(new Table({...}))` / `dropTable(...)` — never raw SQL strings (`queryRunner.query('CREATE TABLE ...')`). The sole necessary exception is a partial unique index's `where:` clause, which TypeORM's `TableIndex` API itself requires as a raw SQL fragment (see the "one active version per project" index).
- Cross-DB column types resolved via `getDataType(databaseType, 'timestamp' | 'boolean' | 'json')` (`src/database/migrations/utils/data-type.mapper.ts`) — supports postgres/cockroachdb/sqlite.
- Every new migration and every new entity must be registered in `src/database/index.ts`'s `DATABASE_OPTIONS`.
- Migrations auto-run on startup (`migrationsRun: true`, wired by `@fsarch/server`'s database module) — never run manual/ad-hoc SQL against a deployed database instead of a migration.

---

## Endpoint Structure

### RESTful Routes

See requirements.md's Endpoints section for the full table.

### Actions Sub-routes

Use the `_actions/<verb>` prefix for non-CRUD operations (mirrors `material-tracing-server`'s `_actions/checkout` pattern):
- `POST /v1/projects/:projectId/_actions/render`
- `POST /v1/projects/:projectId/versions/:versionId/_actions/activate`
- `POST /v1/projects/:projectId/versions/:versionId/_actions/render`

---

## Auth / UAC

- `AuthGuard` and `RolesGuard` are registered **globally** by `@fsarch/server` once `.enableAuth()`/`.enableUac(...)` are called in `main.ts` — controllers only need `@ApiBearerAuth()` (for Swagger) and `@Roles(Role.xxx)` per route; do **not** add a redundant `@UseGuards(AuthGuard)`.
- `uac.type: static`'s permission check is `grantedRoles.includes(role)` — **exact string match only**. A `'*'` permission entry does **not** grant every role. When writing a local dev `config/config.yml`, list every `Role` value a route needs explicitly.

---

## The BindableValue Pattern

See requirements.md for the full specification. Implementation-level rules:
- `isBindableValue()` (`src/rendering/bindable-value.ts`) checks **exactly** two keys (`type`, `value`) with `type ∈ {'constant','variable'}` — strict enough that a resolved image literal (`{type:'base64', value:'...'}`) is never mistaken for a BindableValue on a second resolve pass.
- `resolveBindableTree()` walks the tree recursively; only replaces nodes matching that exact shape, leaves everything else (including nested plain objects/arrays) structurally intact.
- Never hand-write per-layer-type `class-validator` nested schemas for `options` — DTOs only `@IsObject()` check it; the rendering pipeline is the single source of truth for BindableValue-aware validation, at render time.

---

## Edit-Lock Rule (business logic, not just an API concern)

Only a project's most recently created, non-active ProjectVersion is mutable. Enforce this via `ProjectVersionService.AssertEditable(projectId, version)` — call it from **every** mutating method on `ProjectVersionService`/`ParameterService`/`LayerService` (Create/Update/Delete), never only at the controller layer, so the invariant holds regardless of caller. See requirements.md for the exact rule and its rationale.

---

## OpenAPI/Swagger

- All DTOs: `@ApiProperty()` (with `required: false`/`nullable: true` where relevant).
- Response DTOs: static `FromDbo(entity)` mapper, entities are never returned directly.
- Paginated list endpoints: `@ApiOkPaginatedResponse(Dto)` (from `@fsarch/server/pagination`).
- Render endpoints: `res.set({'Content-Type': 'image/png', 'Content-Length': ...})` + `res.send(buffer)` (not a streamed `Readable`, unlike `pdf-render-backend`'s convention — a plain Buffer response is simpler and sufficient here).

---

## Testing

- Vitest, co-located `*.spec.ts`.
- Repository services: mock `getRepositoryToken(Entity)` with `useValue: {}` / `vi.fn()` per field actually exercised.
- Controllers: fully-mocked service dependencies, `should be defined` smoke test is sufficient (matches `material-tracing-server`'s convention).
- **Rendering logic gets real tests, not just mocked orchestration tests**: `render-engine.baseline.spec.ts` runs the actual `@napi-rs/canvas` + Puppeteer pipeline against checked-in baseline PNGs. When intentionally changing rendering behavior, regenerate baselines via `npm run test:update-baselines` — never hand-edit a baseline PNG, and never bump `maxDiffPixels`/`channelTolerance` just to make a failing baseline test pass without understanding why the output changed.
- Keep baseline test fixtures free of text layers (font rendering isn't pinned across hosts/CI) — shapes/images/solid-color html layers are deterministic and safe to pixel-diff.

---

## Naming Summary

| Type | Convention | Example |
|------|------------|---------|
| Controller directory | Plural | `projects/`, `projects/versions/layers/` |
| Controller class | Plural (collection) | `ProjectsController`, `LayersController` |
| Service file | Singular | `project.service.ts`, `layer.service.ts` |
| Entity | Singular | `Project`, `Layer` |
| Route (CRUD) | Plural | `/v1/projects`, `.../layers` |
| Route (nested) | Plural | `/v1/projects/:id/versions` |
| Action route | `_actions/` prefix | `_actions/render`, `_actions/activate` |

---

## Documentation

- Use `AGENTS.md` (this file) for **architectural conventions** and **implementation guidelines**.
- Use `requirements.md` for **functional requirements** and **technical specifications**.
- Both documents are in **English**. Update `requirements.md`'s Version History table whenever requirements change.
