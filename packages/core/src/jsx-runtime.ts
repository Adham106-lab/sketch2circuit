/**
 * @license Apache-2.0
 * @s2c/core/jsx-runtime — Declarative JSX Element descriptors and renderer into Circuit IR.
 */

import type { Circuit, ComponentKind, NetKind } from "@s2c/circuit-json";
import { PARTS_CATALOG, getPartDefinition } from "@s2c/parts";
import { CircuitBuilder } from "./builder.js";

export type JSXComponentType =
  | string
  | ((props: Record<string, unknown>) => S2CElement | S2CElement[] | null);

export interface S2CElement {
  $$typeof: symbol;
  type: JSXComponentType;
  props: Record<string, unknown>;
  key?: string | number | undefined;
}

const S2C_ELEMENT_SYMBOL = Symbol.for("s2c.element");

export function isS2CElement(val: unknown): val is S2CElement {
  return (
    typeof val === "object" && val !== null && (val as S2CElement).$$typeof === S2C_ELEMENT_SYMBOL
  );
}

export function jsx(
  type: JSXComponentType,
  props: Record<string, unknown>,
  key?: string | number,
): S2CElement {
  return {
    $$typeof: S2C_ELEMENT_SYMBOL,
    type,
    props: { ...props },
    key,
  };
}

export const jsxs = jsx;
export const Fragment = Symbol.for("s2c.fragment");

export namespace JSX {
  export interface Element extends S2CElement {}
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicElements {
    circuit: {
      title?: string;
      description?: string;
      children?: unknown;
    };
    resistor: {
      id?: string;
      name?: string;
      value?: string;
      resistance?: string | number;
      footprint?: string;
      children?: unknown;
    };
    capacitor: {
      id?: string;
      name?: string;
      value?: string;
      capacitance?: string | number;
      footprint?: string;
      children?: unknown;
    };
    led: {
      id?: string;
      name?: string;
      color?: string;
      forwardVoltage?: number;
      maxCurrent?: number;
      children?: unknown;
    };
    part: {
      part: string;
      id?: string;
      name?: string;
      value?: string;
      children?: unknown;
    };
    net: {
      name?: string;
      id?: string;
      kind?: NetKind;
      voltage?: number;
      connect?: string[];
      children?: unknown;
    };
    connect: {
      from: string;
      to: string;
      through?: string[];
    };
    [elemName: string]: unknown;
  }
}

/**
 * Evaluates a tree of S2CElements and renders them into canonical Circuit IR.
 */
export function renderCircuit(root: S2CElement): Circuit {
  const builder = new CircuitBuilder();

  function walk(node: unknown) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (!isS2CElement(node)) {
      return;
    }

    const { type, props } = node;

    if (typeof type === "function") {
      const result = type(props);
      walk(result);
      return;
    }

    if (type === Fragment) {
      if (props.children) {
        walk(props.children);
      }
      return;
    }

    const tag = typeof type === "string" ? type.toLowerCase() : "";

    switch (tag) {
      case "circuit": {
        // Circuit container
        if (props.children) walk(props.children);
        break;
      }

      case "resistor": {
        const id = (props.id as string) || (props.name as string) || "R1";
        const val =
          (props.value as string) ||
          (props.resistance !== undefined ? String(props.resistance) : "1kΩ");
        builder.addResistor(id, val, {
          name: props.name as string | undefined,
          footprint: props.footprint as string | undefined,
        });
        if (props.children) walk(props.children);
        break;
      }

      case "led": {
        const id = (props.id as string) || (props.name as string) || "LED1";
        const color = (props.color as string) || (props.value as string) || "Red";
        builder.addLed(id, color, {
          name: props.name as string | undefined,
        });
        if (props.children) walk(props.children);
        break;
      }

      case "capacitor": {
        const id = (props.id as string) || (props.name as string) || "C1";
        const val =
          (props.value as string) ||
          (props.capacitance !== undefined ? String(props.capacitance) : "100nF");
        builder.addCapacitor(id, val, {
          name: props.name as string | undefined,
          footprint: props.footprint as string | undefined,
        });
        if (props.children) walk(props.children);
        break;
      }

      case "part": {
        const partQuery =
          (props.part as string) || (props.partNumber as string) || (props.id as string);
        const id = (props.id as string) || (props.name as string) || partQuery;
        const partDef = getPartDefinition(partQuery) || PARTS_CATALOG[partQuery];
        if (partDef) {
          builder.addPart(partDef, id, {
            name: props.name as string | undefined,
            value: props.value as string | undefined,
          });
        } else {
          // Fallback to custom component
          builder.addComponent(id, (props.kind as ComponentKind) || "generic", {
            name: props.name as string | undefined,
            partNumber: partQuery,
            value: props.value as string | undefined,
          });
        }
        if (props.children) walk(props.children);
        break;
      }

      case "connect": {
        const from = props.from as string;
        const to = props.to as string;
        if (from && to) {
          builder.connect(from, to);
        }
        break;
      }

      case "net": {
        const netId = (props.id as string) || (props.name as string);
        const ports = Array.isArray(props.connect) ? (props.connect as string[]) : [];
        if (netId && ports.length > 0) {
          builder.connectNet(netId, ports, {
            kind: props.kind as NetKind | undefined,
            voltage: typeof props.voltage === "number" ? props.voltage : undefined,
          });
        }
        if (props.children) walk(props.children);
        break;
      }

      default: {
        // If tag matches a catalog part name (e.g. <ArduinoUno /> or <hc-sr04 />)
        const partDef = getPartDefinition(tag) || PARTS_CATALOG[tag.toUpperCase()];
        if (partDef) {
          const id =
            (props.id as string) || (props.name as string) || `${partDef.kind.toUpperCase()}1`;
          builder.addPart(partDef, id, {
            name: props.name as string | undefined,
            value: props.value as string | undefined,
          });
        }
        if (props.children) walk(props.children);
        break;
      }
    }
  }

  walk(root);
  return builder.build();
}
