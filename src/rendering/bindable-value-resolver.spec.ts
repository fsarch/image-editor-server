import { describe, expect, it } from 'vitest';
import { resolveBindableTree } from './bindable-value-resolver.js';
import { BindableValueResolutionError } from './bindable-value.js';

describe('resolveBindableTree', () => {
  it('resolves a constant value as-is', () => {
    const result = resolveBindableTree({ type: 'constant', value: 42 }, {});
    expect(result).toBe(42);
  });

  it('resolves a top-level variable from parameters', () => {
    const result = resolveBindableTree(
      { type: 'variable', value: 'title' },
      { title: 'Hello World' },
    );
    expect(result).toBe('Hello World');
  });

  it('resolves a nested dot-path variable', () => {
    const result = resolveBindableTree(
      { type: 'variable', value: 'address.city' },
      { address: { city: 'Berlin', zip: '10115' } },
    );
    expect(result).toBe('Berlin');
  });

  it('throws BindableValueResolutionError when a path segment is missing', () => {
    expect(() =>
      resolveBindableTree({ type: 'variable', value: 'address.city' }, { address: {} }),
    ).toThrow(BindableValueResolutionError);
  });

  it('throws BindableValueResolutionError when traversing through a non-object', () => {
    expect(() =>
      resolveBindableTree(
        { type: 'variable', value: 'address.city' },
        { address: 'not an object' },
      ),
    ).toThrow(BindableValueResolutionError);
  });

  it('recursively resolves an object tree (e.g. a transformation matrix)', () => {
    const result = resolveBindableTree(
      {
        a: { type: 'constant', value: 1 },
        b: { type: 'constant', value: 0 },
        c: { type: 'constant', value: 0 },
        d: { type: 'constant', value: 1 },
        e: { type: 'variable', value: 'offsetX' },
        f: { type: 'constant', value: 0 },
      },
      { offsetX: 120 },
    );

    expect(result).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 120, f: 0 });
  });

  it('recursively resolves an array of bindable values', () => {
    const result = resolveBindableTree(
      [
        { type: 'constant', value: 1 },
        { type: 'variable', value: 'x' },
      ],
      { x: 99 },
    );
    expect(result).toEqual([1, 99]);
  });

  it('does not mistake a resolved base64 image literal for a BindableValue', () => {
    // The *resolved* runtime shape of an image BindableValue's inner literal
    // is { type: 'base64', value: '...' } - isBindableValue must not match
    // this structurally-similar-but-different-discriminant shape, or a
    // second resolution pass would break it.
    const literal = { type: 'base64', value: 'aGVsbG8=' };
    const result = resolveBindableTree(literal, {});
    expect(result).toEqual(literal);
  });

  it('leaves plain primitives untouched', () => {
    expect(resolveBindableTree('plain string', {})).toBe('plain string');
    expect(resolveBindableTree(5, {})).toBe(5);
    expect(resolveBindableTree(null, {})).toBe(null);
  });
});
