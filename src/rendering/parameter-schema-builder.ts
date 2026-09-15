import { z, ZodTypeAny } from 'zod';
import { Parameter } from '../database/entities/parameter.entity.js';

function buildFieldSchema(
  parameter: Parameter,
  childrenByParentId: Map<string, Parameter[]>,
): ZodTypeAny {
  let schema: ZodTypeAny;

  switch (parameter.type) {
    case 'text':
      schema = z.string();
      break;
    case 'number':
      schema = z.number();
      break;
    case 'image':
      schema = z.object({
        type: z.literal('base64'),
        value: z.string(),
      });
      break;
    case 'object':
      schema = buildObjectSchema(parameter.id, childrenByParentId);
      break;
    default:
      throw new Error(`Unsupported parameter type "${parameter.type}"`);
  }

  return parameter.required ? schema : schema.optional();
}

function buildObjectSchema(
  parentId: string | null,
  childrenByParentId: Map<string, Parameter[]>,
): ZodTypeAny {
  const children = [...(childrenByParentId.get(parentId ?? 'root') ?? [])].sort(
    (a, b) => a.order - b.order,
  );

  const shape: Record<string, ZodTypeAny> = {};

  for (const child of children) {
    shape[child.name] = buildFieldSchema(child, childrenByParentId);
  }

  return z.object(shape);
}

/**
 * Builds a Zod schema from a ProjectVersion's flat Parameter list by
 * grouping children by `parentId` (root parameters use the key 'root' since
 * `parentId` is null for them) and recursing for `object`-typed parameters.
 */
export function buildParameterSchema(parameters: Parameter[]): ZodTypeAny {
  const childrenByParentId = new Map<string, Parameter[]>();

  for (const parameter of parameters) {
    const key = parameter.parentId ?? 'root';
    const bucket = childrenByParentId.get(key) ?? [];
    bucket.push(parameter);
    childrenByParentId.set(key, bucket);
  }

  return buildObjectSchema(null, childrenByParentId);
}
