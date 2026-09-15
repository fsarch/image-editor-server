import { describe, expect, it } from 'vitest';
import { isBindableValue } from './bindable-value.js';

describe('isBindableValue', () => {
  it('accepts a constant BindableValue', () => {
    expect(isBindableValue({ type: 'constant', value: 42 })).toBe(true);
  });

  it('accepts a variable BindableValue', () => {
    expect(isBindableValue({ type: 'variable', value: 'name' })).toBe(true);
  });

  it('rejects a resolved base64 image literal (structurally similar, different discriminant)', () => {
    expect(isBindableValue({ type: 'base64', value: 'aGVsbG8=' })).toBe(false);
  });

  it('rejects an object with extra keys', () => {
    expect(isBindableValue({ type: 'constant', value: 1, extra: true })).toBe(false);
  });

  it('rejects plain objects, arrays, null and primitives', () => {
    expect(isBindableValue({ a: 1 })).toBe(false);
    expect(isBindableValue([1, 2])).toBe(false);
    expect(isBindableValue(null)).toBe(false);
    expect(isBindableValue('constant')).toBe(false);
    expect(isBindableValue(5)).toBe(false);
  });
});
