import { BindableValue } from './bindable-value.js';

export interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

// Identity: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } - maps directly onto
// @napi-rs/canvas's ctx.setTransform(a,b,c,d,e,f).
export interface BindableAffineMatrix {
  a: BindableValue<number>;
  b: BindableValue<number>;
  c: BindableValue<number>;
  d: BindableValue<number>;
  e: BindableValue<number>;
  f: BindableValue<number>;
}

export interface Base64Image {
  type: 'base64';
  value: string;
}

export interface TextLayerOptions {
  content: BindableValue<string>;
  fontFamily: BindableValue<string>;
  fontSize: BindableValue<number>;
  color: BindableValue<string>;
  textAlign?: BindableValue<'left' | 'center' | 'right'>;
}

export interface ImageLayerOptions {
  image: BindableValue<Base64Image>;
  width: BindableValue<number>;
  height: BindableValue<number>;
}

export interface ShapeLayerOptions {
  shape: BindableValue<'rectangle' | 'ellipse'>;
  width: BindableValue<number>;
  height: BindableValue<number>;
  fillColor?: BindableValue<string>;
  strokeColor?: BindableValue<string>;
  strokeWidth?: BindableValue<number>;
}

export interface HtmlLayerOptions {
  html: BindableValue<string>;
  width: BindableValue<number>;
  height: BindableValue<number>;
}

export interface ResolvedTextLayerOptions {
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface ResolvedImageLayerOptions {
  image: Base64Image;
  width: number;
  height: number;
}

export interface ResolvedShapeLayerOptions {
  shape: 'rectangle' | 'ellipse';
  width: number;
  height: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface ResolvedHtmlLayerOptions {
  html: string;
  width: number;
  height: number;
}
