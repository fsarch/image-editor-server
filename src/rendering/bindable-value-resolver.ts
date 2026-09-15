import { BindableValueResolutionError, isBindableValue } from './bindable-value.js';

function resolveDotPath(parameters: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = parameters;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      throw new BindableValueResolutionError(
        `Cannot resolve variable "${path}": segment "${segment}" has no parent object`,
      );
    }

    const record = current as Record<string, unknown>;

    if (!(segment in record)) {
      throw new BindableValueResolutionError(
        `Cannot resolve variable "${path}": property "${segment}" does not exist`,
      );
    }

    current = record[segment];
  }

  return current;
}

/**
 * Recursively walks a Layer's `transformationMatrix`/`options` JSON tree.
 * Every node matching the BindableValue shape is replaced by its resolved
 * literal (constant -> used as-is, variable -> looked up by dot-path in
 * `parameters`). All other object/array nodes are walked structurally so
 * BindableValues can appear at any depth.
 */
export function resolveBindableTree(node: unknown, parameters: Record<string, unknown>): unknown {
  if (isBindableValue(node)) {
    return node.type === 'constant' ? node.value : resolveDotPath(parameters, node.value);
  }

  if (Array.isArray(node)) {
    return node.map((child) => resolveBindableTree(child, parameters));
  }

  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([key, value]) => [
        key,
        resolveBindableTree(value, parameters),
      ]),
    );
  }

  return node;
}
