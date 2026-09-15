import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({
  name: 'project',
})
export class Project {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk__project',
  })
  id: string;

  @Column({
    name: 'name',
    type: 'varchar',
    length: '512',
    nullable: false,
  })
  name: string;

  @Column({
    name: 'description',
    type: 'text',
    nullable: true,
  })
  description: string | null = null;

  @Column({
    name: 'external_id',
    type: 'varchar',
    length: '256',
    nullable: true,
  })
  externalId: string | null = null;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
  })
  deletionTime: Date | null = null;
}
