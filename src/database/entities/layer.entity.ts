import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type LayerType = 'text' | 'image' | 'shape' | 'html';

// `transformationMatrix`/`options` hold BindableValue<T> leaves (see
// rendering/bindable-value.ts) - i.e. every leaf is either a constant or a
// reference into the render request's `parameters`. Their exact shape
// depends on `type` (see rendering/layer-options.types.ts) and is therefore
// intentionally not modeled as separate typed columns.
@Entity({
  name: 'layer',
})
export class Layer {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk__layer',
  })
  id: string;

  @Column({
    name: 'project_version_id',
    type: 'uuid',
    nullable: false,
  })
  projectVersionId: string;

  @Column({
    name: 'external_id',
    type: 'varchar',
    length: '256',
    nullable: true,
  })
  externalId: string | null = null;

  @Column({
    name: 'name',
    type: 'varchar',
    length: '512',
    nullable: false,
  })
  name: string;

  @Column({
    name: 'order',
    type: 'integer',
    default: 0,
    nullable: false,
  })
  order: number = 0;

  @Column({
    name: 'type',
    type: 'varchar',
    length: '32',
    nullable: false,
  })
  type: LayerType;

  @Column({
    name: 'transformation_matrix',
    type: 'simple-json',
    nullable: false,
  })
  transformationMatrix: unknown;

  @Column({
    name: 'options',
    type: 'simple-json',
    nullable: false,
  })
  options: unknown;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
  })
  deletionTime: Date | null = null;
}
