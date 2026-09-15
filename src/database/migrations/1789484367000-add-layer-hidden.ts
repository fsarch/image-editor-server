import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { getDataType } from './utils/data-type.mapper.js';

export class AddLayerHidden1789484367000 implements MigrationInterface {
  name = 'AddLayerHidden1789484367000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const databaseType = queryRunner.connection.driver.options.type;

    await queryRunner.addColumn(
      'layer',
      new TableColumn({
        name: 'hidden',
        type: getDataType(databaseType, 'boolean'),
        isNullable: false,
        default: 'false',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('layer', 'hidden');
  }
}
