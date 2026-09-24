/**
 * @license Apache-2.0
 * @s2c/render-schematic — Schematic layout engine per Doc §10 (Net-Label-Only).
 * Component positioning and pin coordinate resolution without wire routing.
 */

import type { Circuit, Component, Port } from "@s2c/circuit-json";
import type {
  PinPosition,
  PlacedComponent,
  PlacedNet,
  Point,
  SchematicRenderOptions,
} from "./types.js";

/**
 * Calculates layout positions for all components and pin coordinates.
 * Implements clean net-label architecture per Doc §10.
 */
export function computeSchematicLayout(
  circuit: Circuit,
  options: SchematicRenderOptions = {},
): {
  components: PlacedComponent[];
  nets: PlacedNet[];
  width: number;
  height: number;
  portPositions: Map<string, PinPosition>;
} {
  const padding = options.padding ?? 40;

  const placedComponents: PlacedComponent[] = [];
  const portPositions = new Map<string, PinPosition>();

  // Segregate MCUs/Modules vs discrete components
  const mcus: Component[] = [];
  const discretes: Component[] = [];
  const others: Component[] = [];

  for (const comp of circuit.components) {
    if (comp.kind === "mcu" || comp.kind === "ic" || comp.kind === "module") {
      mcus.push(comp);
    } else if (
      comp.kind === "resistor" ||
      comp.kind === "capacitor" ||
      comp.kind === "led" ||
      comp.kind === "diode" ||
      comp.kind === "button" ||
      comp.kind === "transistor" ||
      comp.kind === "potentiometer"
    ) {
      discretes.push(comp);
    } else {
      others.push(comp);
    }
  }

  // Placement cursor
  let currentX = padding + 20;
  const currentY = padding + 40;
  let maxX = currentX;
  let maxY = currentY;

  // 1. Place MCUs and ICs
  for (const mcu of mcus) {
    const isExplicit = mcu.position !== undefined;
    const pinCount = mcu.ports.length;
    const halfPins = Math.ceil(pinCount / 2);
    const pinSpacing = 24;
    const headerHeight = 36;
    const boxWidth = 200;
    const boxHeight = Math.max(160, headerHeight + halfPins * pinSpacing + 20);

    const x = isExplicit ? (mcu.position?.x ?? currentX) : currentX;
    const y = isExplicit ? (mcu.position?.y ?? currentY) : currentY;

    const pins = new Map<string, PinPosition>();

    // Separate ports: inputs/analog/power on left, digital/outputs on right
    const leftPorts: Port[] = [];
    const rightPorts: Port[] = [];

    for (const port of mcu.ports) {
      const name = port.name.toUpperCase();
      if (
        name.startsWith("A") ||
        name.includes("VCC") ||
        name.includes("5V") ||
        name.includes("3V3") ||
        name.includes("GND") ||
        name.includes("VIN") ||
        name.includes("RESET")
      ) {
        leftPorts.push(port);
      } else {
        rightPorts.push(port);
      }
    }

    // Balance if lopsided
    while (leftPorts.length > halfPins + 2 && rightPorts.length < halfPins) {
      const moved = leftPorts.pop();
      if (moved) rightPorts.unshift(moved);
    }
    while (rightPorts.length > halfPins + 2 && leftPorts.length < halfPins) {
      const moved = rightPorts.pop();
      if (moved) leftPorts.push(moved);
    }

    // Place left pins
    leftPorts.forEach((p, idx) => {
      const py = y + headerHeight + 14 + idx * pinSpacing;
      const pinPos: PinPosition = {
        portId: p.id,
        name: p.name,
        worldPos: { x, y: py },
        direction: "left",
        pinNumber: p.pinNumber,
      };
      pins.set(p.id, pinPos);
      portPositions.set(p.id, pinPos);
    });

    // Place right pins
    rightPorts.forEach((p, idx) => {
      const py = y + headerHeight + 14 + idx * pinSpacing;
      const pinPos: PinPosition = {
        portId: p.id,
        name: p.name,
        worldPos: { x: x + boxWidth, y: py },
        direction: "right",
        pinNumber: p.pinNumber,
      };
      pins.set(p.id, pinPos);
      portPositions.set(p.id, pinPos);
    });

    placedComponents.push({
      component: mcu,
      x,
      y,
      width: boxWidth,
      height: boxHeight,
      pins,
    });

    if (!isExplicit) {
      currentX += boxWidth + 140;
      maxX = Math.max(maxX, x + boxWidth);
      maxY = Math.max(maxY, y + boxHeight);
    }
  }

  // 2. Place Discretes (Passives, LEDs, etc.)
  const discreteColumnX = currentX;
  let discreteY = padding + 40;

  for (let i = 0; i < discretes.length; i++) {
    const comp = discretes[i];
    const isExplicit = comp.position !== undefined;
    const width = 80;
    const height = 40;

    const x = isExplicit ? (comp.position?.x ?? discreteColumnX) : discreteColumnX;
    const y = isExplicit ? (comp.position?.y ?? discreteY) : discreteY;

    const pins = new Map<string, PinPosition>();

    if (comp.ports.length >= 2) {
      // Left terminal
      const p1 = comp.ports[0];
      const pin1: PinPosition = {
        portId: p1.id,
        name: p1.name,
        worldPos: { x, y: y + height / 2 },
        direction: "left",
        pinNumber: p1.pinNumber,
      };
      pins.set(p1.id, pin1);
      portPositions.set(p1.id, pin1);

      // Right terminal
      const p2 = comp.ports[1];
      const pin2: PinPosition = {
        portId: p2.id,
        name: p2.name,
        worldPos: { x: x + width, y: y + height / 2 },
        direction: "right",
        pinNumber: p2.pinNumber,
      };
      pins.set(p2.id, pin2);
      portPositions.set(p2.id, pin2);

      // Extra 3rd pin if potentiometer / transistor
      if (comp.ports.length > 2) {
        const p3 = comp.ports[2];
        const pin3: PinPosition = {
          portId: p3.id,
          name: p3.name,
          worldPos: { x: x + width / 2, y: y + height },
          direction: "bottom",
          pinNumber: p3.pinNumber,
        };
        pins.set(p3.id, pin3);
        portPositions.set(p3.id, pin3);
      }
    }

    placedComponents.push({
      component: comp,
      x,
      y,
      width,
      height,
      pins,
    });

    if (!isExplicit) {
      discreteY += 90;
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, discreteY);
    }
  }

  // 3. Place remaining peripheral sensors/modules
  const otherX = discreteColumnX + 160;
  let otherY = padding + 40;

  for (const comp of others) {
    const isExplicit = comp.position !== undefined;
    const width = 140;
    const height = Math.max(80, comp.ports.length * 24 + 30);

    const x = isExplicit ? (comp.position?.x ?? otherX) : otherX;
    const y = isExplicit ? (comp.position?.y ?? otherY) : otherY;

    const pins = new Map<string, PinPosition>();
    comp.ports.forEach((p, idx) => {
      const py = y + 30 + idx * 24;
      const pinPos: PinPosition = {
        portId: p.id,
        name: p.name,
        worldPos: { x, y: py },
        direction: "left",
        pinNumber: p.pinNumber,
      };
      pins.set(p.id, pinPos);
      portPositions.set(p.id, pinPos);
    });

    placedComponents.push({
      component: comp,
      x,
      y,
      width,
      height,
      pins,
    });

    if (!isExplicit) {
      otherY += height + 40;
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, otherY);
    }
  }

  // 4. Resolve Nets metadata (Net-Label representation per Doc §10)
  const placedNets: PlacedNet[] = [];

  for (const net of circuit.nets) {
    const isGround = net.kind === "ground" || net.id.toUpperCase() === "GND";
    const isPower =
      net.kind === "power" ||
      net.id.toUpperCase() === "5V" ||
      net.id.toUpperCase() === "3V3" ||
      net.id.toUpperCase() === "VCC";

    const points: Point[] = [];
    for (const portId of net.portIds) {
      const pin = portPositions.get(portId);
      if (pin) {
        points.push(pin.worldPos);
      }
    }

    placedNets.push({
      net,
      points,
      pathData: "",
      isGround,
      isPower,
      label: net.id,
    });
  }

  // Ensure width accounts for net label badges protruding to the right of components
  const finalWidth = options.width ?? Math.max(800, maxX + padding + 120);
  const finalHeight = options.height ?? Math.max(500, maxY + padding + 60);

  return {
    components: placedComponents,
    nets: placedNets,
    width: finalWidth,
    height: finalHeight,
    portPositions,
  };
}
