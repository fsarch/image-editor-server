import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// width/height are not part of the originally requested field list — they
// were added deliberately because the render pipeline cannot size an
// @napi-rs/canvas canvas without a fixed output size, and a ProjectVersion
// (one full layout/template definition) is the natural place to own it.
@Entity({
  name: 'project_version',
})
export class ProjectVersion {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk__project_version',
  })
  id: string;

  @Column({
    name: 'project_id',
    type: 'uuid',
    nullable: false,
  })
  projectId: string;

  @Column({
    name: 'external_id',
    type: 'varchar',
    length: '256',
    nullable: true,
  })
  externalId: string | null = null;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: false,
    nullable: false,
  })
  isActive: boolean = false;

  @Column({
    name: 'width',
    type: 'integer',
    nullable: false,
  })
  width: number;

  @Column({
    name: 'height',
    type: 'integer',
    nullable: false,
  })
  height: number;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
  })
  deletionTime: Date | null = null;
}
