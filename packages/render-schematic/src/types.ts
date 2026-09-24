/**
 * @license Apache-2.0
 * @s2c/render-schematic — Schematic SVG rendering types.
 */

import type { Component, Net } from "@s2c/circuit-json";

export type SchematicTheme = "dark" | "light";

export interface SchematicRenderOptions {
  /** Theme palette: "dark" (blueprint/slate) or "light" (clean paper) */
  theme?: SchematicTheme;
  /** Explicit output width in pixels (calculated from layout if omitted) */
  width?: number;
  /** Explicit output height in pixels (calculated from layout if omitted) */
  height?: number;
  /** Canvas margin padding in pixels (default: 40) */
  padding?: number;
  /** Whether to render background grid pattern (default: true) */
  showGrid?: boolean;
  /** Whether to show net label badges on unconnected or power nets (default: true) */
  showNetLabels?: boolean;
  /** Whether to render physical pin numbers on IC pins (default: true) */
  showPinNumbers?: boolean;
  /** Whether to draw a professional engineering title block (default: true) */
  showTitleBlock?: boolean;
  /** Grid spacing size in pixels (default: 20) */
  gridSize?: number;
}

export interface RenderResult {
  /** Full SVG XML document string */
  svg: string;
  /** Rendered width in pixels */
  width: number;
  /** Rendered height in pixels */
  height: number;
  /** SVG viewBox string e.g. "0 0 1000 800" */
  viewBox: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface PinPosition {
  portId: string;
  name: string;
  worldPos: Point;
  direction: "left" | "right" | "top" | "bottom";
  pinNumber?: string | number;
}

export interface PlacedComponent {
  component: Component;
  x: number;
  y: number;
  width: number;
  height: number;
  pins: Map<string, PinPosition>;
}

export interface PlacedNet {
  net: Net;
  points: Point[];
  pathData: string;
  isGround: boolean;
  isPower: boolean;
  label?: string;
}
