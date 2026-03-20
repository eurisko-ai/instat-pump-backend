import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class InitialSchema1710950400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'token_metadata',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'name',
            type: 'text',
          },
          {
            name: 'symbol',
            type: 'text',
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'imageUrl',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'imageBase64',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'twitter',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'telegram',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'website',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadataUri',
            type: 'text',
          },
          {
            name: 'mintAddress',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'txSignature',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'buyAmount',
            type: 'float',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'text',
            default: "'pending'",
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'creatorAddress',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('token_metadata');
  }
}
