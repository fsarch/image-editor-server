import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { getDataType } from './utils/data-type.mapper.js';

export class BaseTables1757756400000 implements MigrationInterface {
  name = 'BaseTables1757756400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const databaseType = queryRunner.connection.driver.options.type;

    // region Project
    await queryRunner.createTable(
      new Table({
        name: 'project',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk__project',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '512',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'external_id',
            type: 'varchar',
            length: '256',
            isNullable: true,
          },
          {
            name: 'creation_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'deletion_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'IDX__project__external_id',
            columnNames: ['external_id'],
          },
        ],
      }),
    );
    // endregion

    // region ProjectVersion
    await queryRunner.createTable(
      new Table({
        name: 'project_version',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk__project_version',
          },
          {
            name: 'project_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'external_id',
            type: 'varchar',
            length: '256',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: getDataType(databaseType, 'boolean'),
            isNullable: false,
            default: 'false',
          },
          {
            name: 'width',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'height',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'creation_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'deletion_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'IDX__project_version__project_id',
            columnNames: ['project_id'],
          },
          {
            name: 'IDX__project_version__external_id',
            columnNames: ['external_id'],
          },
          // Enforces "at most one active, non-deleted ProjectVersion per
          // Project" at the database level - mirrors material-tracing-server's
          // pattern of partial unique indexes scoped to non-deleted rows
          // (e.g. UQ__short_code__code).
          {
            name: 'UQ__project_version__project_id__active',
            columnNames: ['project_id'],
            isUnique: true,
            where: 'is_active = true AND deletion_time IS NULL',
          },
        ],
        foreignKeys: [
          {
            name: 'FK__project_version__project_id',
            columnNames: ['project_id'],
            referencedTableName: 'project',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );
    // endregion

    // region Parameter
    await queryRunner.createTable(
      new Table({
        name: 'parameter',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk__parameter',
          },
          {
            name: 'project_version_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'parent_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '256',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'required',
            type: getDataType(databaseType, 'boolean'),
            isNullable: false,
            default: 'false',
          },
          {
            name: 'default_value',
            type: getDataType(databaseType, 'json'),
            isNullable: true,
          },
          {
            name: 'order',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'creation_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'deletion_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'IDX__parameter__project_version_id',
            columnNames: ['project_version_id'],
          },
          {
            name: 'IDX__parameter__parent_id',
            columnNames: ['parent_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK__parameter__project_version_id',
            columnNames: ['project_version_id'],
            referencedTableName: 'project_version',
            referencedColumnNames: ['id'],
          },
          {
            name: 'FK__parameter__parent_id',
            columnNames: ['parent_id'],
            referencedTableName: 'parameter',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );
    // endregion

    // region Layer
    await queryRunner.createTable(
      new Table({
        name: 'layer',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk__layer',
          },
          {
            name: 'project_version_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'external_id',
            type: 'varchar',
            length: '256',
            isNullable: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '512',
            isNullable: false,
          },
          {
            name: 'order',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'transformation_matrix',
            type: getDataType(databaseType, 'json'),
            isNullable: false,
          },
          {
            name: 'options',
            type: getDataType(databaseType, 'json'),
            isNullable: false,
          },
          {
            name: 'creation_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'deletion_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'IDX__layer__project_version_id',
            columnNames: ['project_version_id'],
          },
          {
            name: 'IDX__layer__external_id',
            columnNames: ['external_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK__layer__project_version_id',
            columnNames: ['project_version_id'],
            referencedTableName: 'project_version',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );
    // endregion
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('layer');
    await queryRunner.dropTable('parameter');
    await queryRunner.dropTable('project_version');
    await queryRunner.dropTable('project');
  }
}
