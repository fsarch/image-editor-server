// Every leaf value inside a Layer's `transformationMatrix`/`options` JSON is
// not a plain literal - it's one of these two shapes, resolved at render
// time against the (validated) render request's `parameters` payload. This
// lets a project author either hard-code a value or bind it to caller
// input, per individual field.
export interface ConstantBindableValue<T> {
  type: 'constant';
  value: T;
}

export interface VariableBindableValue {
  type: 'variable';
  // Dot-path into the validated `parameters` payload, e.g. "address.city".
  value: string;
}

export type BindableValue<T> = ConstantBindableValue<T> | VariableBindableValue;

export class BindableValueResolutionError extends Error {}

/**
 * Structural check for the BindableValue shape. Deliberately strict (exactly
 * the two keys `type`/`value`, `type` one of the two known discriminants) so
 * that resolved literals which happen to also be `{type, value}` objects -
 * e.g. an image value `{type:'base64', value:'...'}` - are never mistaken
 * for a BindableValue and "resolved" a second time.
 */
export function isBindableValue(node: unknown): node is BindableValue<unknown> {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return false;
  }

  const record = node as Record<string, unknown>;
  const keys = Object.keys(record);

  return (
    keys.length === 2 &&
    (record.type === 'constant' || record.type === 'variable') &&
    'value' in record
  );
}
