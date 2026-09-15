import { DatabaseType } from 'typeorm';

const DATA_TYPES: Record<
  'timestamp' | 'boolean' | 'json',
  Record<'cockroachdb' | 'sqlite' | 'postgres', string>
> = {
  timestamp: {
    cockroachdb: 'TIMESTAMPTZ',
    postgres: 'TIMESTAMPTZ',
    sqlite: 'datetime',
  },
  boolean: {
    cockroachdb: 'BOOL',
    postgres: 'BOOL',
    sqlite: 'boolean',
  },
  // TypeORM's 'simple-json' entity column type transparently
  // JSON.stringify()/JSON.parse()s regardless of driver, so the physical
  // column only needs to hold text; postgres/cockroachdb get the native
  // JSONB type for indexing/querying, sqlite just gets TEXT.
  json: {
    cockroachdb: 'JSONB',
    postgres: 'JSONB',
    sqlite: 'text',
  },
};

export const getDataType = (
  driver: DatabaseType,
  dataType: keyof typeof DATA_TYPES,
) => {
  if (
    driver !== 'cockroachdb' &&
    driver !== 'postgres' &&
    driver !== 'better-sqlite3'
  ) {
    throw new Error('unsupported database type');
  }

  // material-tracing-server's copy of this mapper indexes
  // DATA_TYPES[dataType][driver] directly, which is a latent bug: 'driver'
  // can be 'better-sqlite3', a key that doesn't exist in the inner record
  // (only 'sqlite' does). Normalize here instead.
  const key = driver === 'better-sqlite3' ? 'sqlite' : driver;

  return DATA_TYPES[dataType][key];
};
