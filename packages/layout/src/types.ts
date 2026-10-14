/**
 * @license Apache-2.0
 * @s2c/layout — ELK Schema and Port-Aware Layout Engine Types.
 */

export type ElkPortSide = "NORTH" | "SOUTH" | "EAST" | "WEST";

export interface ElkPort {
  id: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  layoutOptions?: Record<string, string>;
  labels?: Array<{ text: string }>;
  properties?: {
    side: ElkPortSide;
    originalName: string;
    kind: string;
  };
}

export interface ElkNode {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  layoutOptions?: Record<string, string>;
  ports?: ElkPort[];
  children?: ElkNode[];
  labels?: Array<{ text: string }>;
  properties?: {
    kind: string;
    value?: string;
  };
}

export interface ElkEdgeSection {
  id?: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  bendPoints?: Array<{ x: number; y: number }>;
}

export interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
  sections?: ElkEdgeSection[];
  layoutOptions?: Record<string, string>;
  labels?: Array<{ text: string }>;
  properties?: {
    netId: string;
    netKind: string;
  };
}

export interface PowerRailStub {
  componentId: string;
  portId: string;
  railName: string;
  side: "NORTH" | "SOUTH";
  symbol: "VCC_FLAG" | "GND_ARROW";
}

export interface ElkGraph {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkNode[];
  edges: ElkEdge[];
  powerStubs?: PowerRailStub[];
}

export interface LayoutOptions {
  algorithm?: "layered" | "stress" | "mrtree" | string;
  direction?: "RIGHT" | "DOWN" | "LEFT" | "UP";
  compressPowerRails?: boolean;
  powerRailNames?: string[];
  nodeSpacing?: number;
  layerSpacing?: number;
  edgeNodeSpacing?: number;
  fixedPortSides?: boolean;
}
