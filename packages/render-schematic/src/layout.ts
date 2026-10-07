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
    if (comp.kind === "mcu" || comp.kind === "ic") {
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

  // Helper to place a discrete component
  const placeDiscrete = (
    comp: Component,
    x: number,
    y: number,
    width = 80,
    height = 40,
  ): PlacedComponent => {
    const pins = new Map<string, PinPosition>();
    if (comp.ports.length >= 2) {
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
    } else if (comp.ports.length === 1) {
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
    }
    return { component: comp, x, y, width, height, pins };
  };

  // Helper to place a module/generic peripheral component
  const placeModule = (
    comp: Component,
    x: number,
    y: number,
    width = 120,
    height = Math.max(64, comp.ports.length * 20 + 24),
  ): PlacedComponent => {
    const pins = new Map<string, PinPosition>();
    comp.ports.forEach((p: Port, idx: number) => {
      const py = y + 26 + idx * 20;
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
    return { component: comp, x, y, width, height, pins };
  };

  let maxX = padding + 20;
  let maxY = padding + 40;

  // Case A: Circuit has an MCU and multiple peripherals
  if (mcus.length === 1 && (discretes.length > 0 || others.length > 0)) {
    const mcu = mcus[0];
    const isExplicit = mcu.position !== undefined;
    const pinCount = mcu.ports.length;
    const halfPins = Math.ceil(pinCount / 2);
    const pinSpacing = 24;
    const headerHeight = 36;
    const boxWidth = 200;
    const boxHeight = Math.max(160, headerHeight + halfPins * pinSpacing + 20);

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

    while (leftPorts.length > halfPins + 2 && rightPorts.length < halfPins) {
      const moved = leftPorts.pop();
      if (moved) rightPorts.unshift(moved);
    }
    while (rightPorts.length > halfPins + 2 && leftPorts.length < halfPins) {
      const moved = rightPorts.pop();
      if (moved) leftPorts.push(moved);
    }

    // Check if any peripherals connect to left ports (analog/sensor)
    const hasLeftSensors = circuit.nets.some((net) => {
      const hasLeftPort = net.portIds.some((pid) =>
        leftPorts.some((lp) => pid === `${mcu.id}.${lp.name}` || pid === lp.id),
      );
      const hasPeripheral = net.portIds.some((pid) => !pid.startsWith(`${mcu.id}.`));
      return hasLeftPort && hasPeripheral;
    });

    const mcuX = isExplicit
      ? (mcu.position?.x ?? padding + 20)
      : hasLeftSensors
        ? padding + 240
        : padding + 20;
    const mcuY = isExplicit ? (mcu.position?.y ?? padding + 40) : padding + 40;

    const mcuPins = new Map<string, PinPosition>();

    leftPorts.forEach((p, idx) => {
      const py = mcuY + headerHeight + 14 + idx * pinSpacing;
      const pinPos: PinPosition = {
        portId: p.id,
        name: p.name,
        worldPos: { x: mcuX, y: py },
        direction: "left",
        pinNumber: p.pinNumber,
      };
      mcuPins.set(p.id, pinPos);
      portPositions.set(p.id, pinPos);
    });

    rightPorts.forEach((p, idx) => {
      const py = mcuY + headerHeight + 14 + idx * pinSpacing;
      const pinPos: PinPosition = {
        portId: p.id,
        name: p.name,
        worldPos: { x: mcuX + boxWidth, y: py },
        direction: "right",
        pinNumber: p.pinNumber,
      };
      mcuPins.set(p.id, pinPos);
      portPositions.set(p.id, pinPos);
    });

    placedComponents.push({
      component: mcu,
      x: mcuX,
      y: mcuY,
      width: boxWidth,
      height: boxHeight,
      pins: mcuPins,
    });

    maxX = Math.max(maxX, mcuX + boxWidth);
    maxY = Math.max(maxY, mcuY + boxHeight);

    // Track placed components to avoid duplicate placement
    const placedIds = new Set<string>([mcu.id]);

    // Map each component to its closest MCU signal pin connection
    const compPinMap = new Map<string, PinPosition>();
    for (const net of circuit.nets) {
      const isPowerGround =
        net.kind === "ground" ||
        net.kind === "power" ||
        net.id.toUpperCase() === "GND" ||
        net.id.toUpperCase() === "5V" ||
        net.id.toUpperCase() === "3V3" ||
        net.id.toUpperCase() === "VIN";
      if (isPowerGround) continue; // Power/ground rails are common; find true signal pins

      const mcuPort = net.portIds.find((pid) => pid.startsWith(`${mcu.id}.`));
      if (!mcuPort) continue;
      const pinPos = portPositions.get(mcuPort);
      if (!pinPos) continue;

      for (const pid of net.portIds) {
        const compId = pid.split(".")[0];
        if (compId !== mcu.id && !compPinMap.has(compId)) {
          compPinMap.set(compId, pinPos);
        }
      }
    }

    // 2nd pass: 1-hop passives (e.g. D1 connected to R1.2, where R1 is mapped to D4)
    for (const net of circuit.nets) {
      const isPowerGround =
        net.kind === "ground" ||
        net.kind === "power" ||
        net.id.toUpperCase() === "GND" ||
        net.id.toUpperCase() === "5V";
      if (isPowerGround) continue;

      const mappedCompId = net.portIds
        .map((pid) => pid.split(".")[0])
        .find((cid) => compPinMap.has(cid));
      if (!mappedCompId) continue;
      const pinPos = compPinMap.get(mappedCompId);
      if (!pinPos) continue;

      for (const pid of net.portIds) {
        const compId = pid.split(".")[0];
        if (compId !== mcu.id && !compPinMap.has(compId)) {
          compPinMap.set(compId, pinPos);
        }
      }
    }

    // Default any remaining decoupling capacitors / power elements to the 5V/GND pin on left
    const pwrPin = leftPorts.find((p) => p.name.includes("5V") || p.name.includes("VCC"));
    const gndPin = leftPorts.find((p) => p.name.includes("GND"));
    const fallbackPinPos = pwrPin
      ? portPositions.get(`${mcu.id}.${pwrPin.name}`)
      : gndPin
        ? portPositions.get(`${mcu.id}.${gndPin.name}`)
        : undefined;
    for (const comp of [...discretes, ...others]) {
      if (!compPinMap.has(comp.id) && fallbackPinPos) {
        compPinMap.set(comp.id, fallbackPinPos);
      }
    }

    // 1. Place left-side components (Sensors / Analog inputs like Pot, LDR, bypass caps)
    let leftCursorY = padding + 40;
    const allLeftComps = [...discretes, ...others].filter((c) => {
      const pin = compPinMap.get(c.id);
      return pin && pin.direction === "left";
    });

    for (const comp of allLeftComps) {
      if (placedIds.has(comp.id)) continue;
      const pin = compPinMap.get(comp.id);
      const targetY = pin ? Math.max(padding + 40, pin.worldPos.y - 20) : leftCursorY;
      const y = Math.max(leftCursorY, targetY);
      const x = padding + 20;

      const placed =
        comp.kind === "resistor" || comp.kind === "capacitor" || comp.kind === "potentiometer"
          ? placeDiscrete(comp, x, y, 80, 40)
          : placeModule(comp, x, y, 110, 50);

      placedComponents.push(placed);
      placedIds.add(comp.id);
      leftCursorY = y + placed.height + 24;
      maxX = Math.max(maxX, x + placed.width);
      maxY = Math.max(maxY, y + placed.height);
    }

    // 2. Place right-side components (Actuators, LEDs, Buttons, Motors, Buzzers, Servos)
    const rightCol1X = mcuX + boxWidth + 100;
    const rightCol2X = rightCol1X + 110;
    let rightCursorY = padding + 40;

    // Group connected components (e.g. LED1 + R1, Buzzer + R3)
    const allRightComps = [...discretes, ...others].filter((c) => {
      const pin = compPinMap.get(c.id);
      return pin && pin.direction === "right";
    });

    // Sort right components by the Y coordinate of the connected MCU pin
    allRightComps.sort((a, b) => {
      const pinA = compPinMap.get(a.id)?.worldPos.y ?? 0;
      const pinB = compPinMap.get(b.id)?.worldPos.y ?? 0;
      return pinA - pinB;
    });

    for (const comp of allRightComps) {
      if (placedIds.has(comp.id)) continue;
      const pin = compPinMap.get(comp.id);
      const targetY = pin ? Math.max(padding + 40, pin.worldPos.y - 18) : rightCursorY;
      const y = Math.max(rightCursorY, targetY);

      // Check if this component connects in series to another component (e.g. Resistor R -> LED D)
      let partnerComp: Component | undefined;
      for (const net of circuit.nets) {
        if (!net.portIds.some((p) => p.startsWith(`${comp.id}.`))) continue;
        for (const pid of net.portIds) {
          const cid = pid.split(".")[0];
          if (cid !== comp.id && cid !== mcu.id && !placedIds.has(cid)) {
            partnerComp = circuit.components.find((c) => c.id === cid);
            break;
          }
        }
        if (partnerComp) break;
      }

      if (partnerComp && !placedIds.has(partnerComp.id)) {
        // Place comp at rightCol1X and partnerComp at rightCol2X on the same row!
        const placed1 =
          comp.kind === "resistor" ||
          comp.kind === "capacitor" ||
          comp.kind === "led" ||
          comp.kind === "button"
            ? placeDiscrete(comp, rightCol1X, y, 80, 40)
            : placeModule(comp, rightCol1X, y, 100, 50);

        const placed2 =
          partnerComp.kind === "resistor" ||
          partnerComp.kind === "capacitor" ||
          partnerComp.kind === "led" ||
          partnerComp.kind === "button"
            ? placeDiscrete(partnerComp, rightCol2X, y, 80, 40)
            : placeModule(partnerComp, rightCol2X, y, 100, 50);

        placedComponents.push(placed1);
        placedComponents.push(placed2);
        placedIds.add(comp.id);
        placedIds.add(partnerComp.id);

        const rowHeight = Math.max(placed1.height, placed2.height);
        rightCursorY = y + rowHeight + 20;
        maxX = Math.max(maxX, rightCol2X + placed2.width);
        maxY = Math.max(maxY, y + rowHeight);
      } else {
        // Single component placement
        const isModule =
          comp.kind === "module" ||
          comp.kind === "sensor" ||
          comp.kind === "connector" ||
          comp.kind === "relay" ||
          comp.ports.length > 2 ||
          others.includes(comp);
        const width = isModule ? 110 : 80;
        const height = isModule ? Math.max(50, comp.ports.length * 20 + 20) : 40;

        const placed = isModule
          ? placeModule(comp, rightCol1X, y, width, height)
          : placeDiscrete(comp, rightCol1X, y, width, height);

        placedComponents.push(placed);
        placedIds.add(comp.id);

        rightCursorY = y + placed.height + 20;
        maxX = Math.max(maxX, rightCol1X + placed.width);
        maxY = Math.max(maxY, y + placed.height);
      }
    }

    // 3. Place any remaining components (not directly mapped to an MCU pin)
    let remainingY = padding + 40;
    const remainingX = maxX + 40;
    for (const comp of [...discretes, ...others]) {
      if (placedIds.has(comp.id)) continue;
      const isModule =
        comp.kind === "module" ||
        comp.kind === "sensor" ||
        comp.kind === "connector" ||
        comp.kind === "relay" ||
        comp.ports.length > 2 ||
        others.includes(comp);
      const placed = isModule
        ? placeModule(comp, remainingX, remainingY, 110, 50)
        : placeDiscrete(comp, remainingX, remainingY, 80, 40);

      placedComponents.push(placed);
      placedIds.add(comp.id);
      remainingY += placed.height + 20;
      maxX = Math.max(maxX, remainingX + placed.width);
      maxY = Math.max(maxY, remainingY);
    }
  } else {
    // Case B: General circuit / fallback (Preserves exact coordinates for snapshot tests)
    let currentX = padding + 20;
    const currentY = padding + 40;

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

      while (leftPorts.length > halfPins + 2 && rightPorts.length < halfPins) {
        const moved = leftPorts.pop();
        if (moved) rightPorts.unshift(moved);
      }
      while (rightPorts.length > halfPins + 2 && leftPorts.length < halfPins) {
        const moved = rightPorts.pop();
        if (moved) leftPorts.push(moved);
      }

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

    const discreteColumnX = currentX;
    let discreteY = padding + 40;

    for (let i = 0; i < discretes.length; i++) {
      const comp = discretes[i];
      const isExplicit = comp.position !== undefined;
      const width = 80;
      const height = 40;
      const x = isExplicit ? (comp.position?.x ?? discreteColumnX) : discreteColumnX;
      const y = isExplicit ? (comp.position?.y ?? discreteY) : discreteY;

      placedComponents.push(placeDiscrete(comp, x, y, width, height));

      if (!isExplicit) {
        discreteY += 90;
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, discreteY);
      }
    }

    const otherX = discreteColumnX + 160;
    let otherY = padding + 40;

    for (const comp of others) {
      const isExplicit = comp.position !== undefined;
      const width = 140;
      const height = Math.max(80, comp.ports.length * 24 + 30);
      const x = isExplicit ? (comp.position?.x ?? otherX) : otherX;
      const y = isExplicit ? (comp.position?.y ?? otherY) : otherY;

      placedComponents.push(placeModule(comp, x, y, width, height));

      if (!isExplicit) {
        otherY += height + 40;
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, otherY);
      }
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

  // Ensure width accounts for net label flags protruding to the right of components
  // and bottom margins account for title block drawing frame
  const finalWidth = options.width ?? Math.max(900, maxX + padding + 160);
  const finalHeight = options.height ?? Math.max(540, maxY + padding + 80);

  return {
    components: placedComponents,
    nets: placedNets,
    width: finalWidth,
    height: finalHeight,
    portPositions,
  };
}
