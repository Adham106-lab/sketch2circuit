/**
 * @license Apache-2.0
 * @s2c/exporters — Universal Export Bridge Types.
 */

export interface WokwiPart {
  type: string;
  id: string;
  top: number;
  left: number;
  rotate?: number;
  attrs?: Record<string, string | number | boolean>;
}

export type WokwiConnection = [
  sourcePin: string,
  targetPin: string,
  wireColor: string,
  routingInstructions?: string[],
];

export interface WokwiDiagram {
  version: 1;
  author: string;
  editor: "wokwi";
  parts: WokwiPart[];
  connections: WokwiConnection[];
  dependencies?: Record<string, string>;
}

export interface WokwiExportOptions {
  author?: string;
  defaultWireColor?: string;
  spacing?: number;
}
