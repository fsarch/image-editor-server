import { describe, expect, it } from 'vitest';
import { buildParameterSchema } from './parameter-schema-builder.js';
import { Parameter } from '../database/entities/parameter.entity.js';

function makeParameter(overrides: Partial<Parameter>): Parameter {
  const parameter = new Parameter();
  parameter.id = overrides.id ?? crypto.randomUUID();
  parameter.projectVersionId = overrides.projectVersionId ?? 'version-1';
  parameter.parentId = overrides.parentId ?? null;
  parameter.name = overrides.name ?? 'field';
  parameter.type = overrides.type ?? 'text';
  parameter.required = overrides.required ?? false;
  parameter.defaultValue = overrides.defaultValue ?? null;
  parameter.order = overrides.order ?? 0;
  return parameter;
}

describe('buildParameterSchema', () => {
  it('builds a flat schema with a required text field', () => {
    const schema = buildParameterSchema([
      makeParameter({ name: 'name', type: 'text', required: true }),
    ]);

    expect(schema.safeParse({ name: 'Jane' }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it('marks non-required fields as optional', () => {
    const schema = buildParameterSchema([
      makeParameter({ name: 'logo', type: 'image', required: false }),
    ]);

    expect(schema.safeParse({}).success).toBe(true);
  });

  it('validates the image parameter shape', () => {
    const schema = buildParameterSchema([
      makeParameter({ name: 'logo', type: 'image', required: true }),
    ]);

    expect(schema.safeParse({ logo: { type: 'base64', value: 'aGVsbG8=' } }).success).toBe(true);
    expect(schema.safeParse({ logo: 'not-an-image-object' }).success).toBe(false);
  });

  it('validates the number parameter type', () => {
    const schema = buildParameterSchema([
      makeParameter({ name: 'age', type: 'number', required: true }),
    ]);

    expect(schema.safeParse({ age: 42 }).success).toBe(true);
    expect(schema.safeParse({ age: '42' }).success).toBe(false);
  });

  it('builds a nested object schema from parentId-linked children', () => {
    const parent = makeParameter({ id: 'address', name: 'address', type: 'object', required: true });
    const city = makeParameter({
      parentId: 'address',
      name: 'city',
      type: 'text',
      required: true,
      order: 0,
    });
    const zip = makeParameter({
      parentId: 'address',
      name: 'zip',
      type: 'text',
      required: false,
      order: 1,
    });

    const schema = buildParameterSchema([parent, city, zip]);

    expect(schema.safeParse({ address: { city: 'Berlin' } }).success).toBe(true);
    expect(schema.safeParse({ address: { zip: '10115' } }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });
});
