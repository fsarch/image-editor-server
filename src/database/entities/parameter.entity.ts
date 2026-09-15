import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Stored as a plain varchar (not a native SQL enum) for portability across
// postgres/cockroachdb/sqlite, mirroring how material-tracing-server avoids
// native enums for its own type discriminants. Enforced at the application
// layer (DTO @IsIn(...) + the rendering pipeline's schema builder).
export type ParameterType = 'text' | 'image' | 'number' | 'object';

// One node of a ProjectVersion's input-parameter schema. A flat table, with
// `parentId` used to nest children under an `object`-typed parameter,
// forming a tree (see rendering/parameter-schema-builder.ts).
@Entity({
  name: 'parameter',
})
export class Parameter {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk__parameter',
  })
  id: string;

  @Column({
    name: 'project_version_id',
    type: 'uuid',
    nullable: false,
  })
  projectVersionId: string;

  @Column({
    name: 'parent_id',
    type: 'uuid',
    nullable: true,
  })
  parentId: string | null = null;

  @Column({
    name: 'name',
    type: 'varchar',
    length: '256',
    nullable: false,
  })
  name: string;

  @Column({
    name: 'type',
    type: 'varchar',
    length: '32',
    nullable: false,
  })
  type: ParameterType;

  @Column({
    name: 'required',
    type: 'boolean',
    default: false,
    nullable: false,
  })
  required: boolean = false;

  @Column({
    name: 'default_value',
    type: 'simple-json',
    nullable: true,
  })
  defaultValue: unknown | null = null;

  @Column({
    name: 'order',
    type: 'integer',
    default: 0,
    nullable: false,
  })
  order: number = 0;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
  })
  deletionTime: Date | null = null;
}
