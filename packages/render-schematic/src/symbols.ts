/**
 * @license Apache-2.0
 * @s2c/render-schematic — Schematic SVG symbol glyph generators.
 */

import type { Port } from "@s2c/circuit-json";
import type { PinPosition, PlacedComponent, SchematicTheme } from "./types.js";

export interface SymbolColors {
  stroke: string;
  fill: string;
  accent: string;
  text: string;
  subtext: string;
  wire: string;
  pin: string;
  ground: string;
  power: string;
}

export const THEME_COLORS: Record<SchematicTheme, SymbolColors> = {
  dark: {
    stroke: "#4ADE80",
    fill: "#0E1811",
    accent: "#4ADE80",
    text: "#4ADE80",
    subtext: "#3C6B4B",
    wire: "#4ADE80",
    pin: "#4ADE80",
    ground: "#4ADE80",
    power: "#B5432A",
  },
  light: {
    stroke: "#1A1A17",
    fill: "#FAF8F2",
    accent: "#1A1A17",
    text: "#1A1A17",
    subtext: "#5C584F",
    wire: "#1A1A17",
    pin: "#1A1A17",
    ground: "#3D6B4F",
    power: "#B5432A",
  },
};

/**
 * Escapes XML text entities.
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Renders an IEEE zigzag resistor symbol horizontally centered at (x, y).
 */
export function renderResistor(placed: PlacedComponent, colors: SymbolColors): string {
  const { x, y, width, height, component } = placed;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const _leadLength = 20;
  const bodyWidth = 40;
  const bodyHeight = 12;

  // Zigzag path: 6 peaks/valleys
  const x0 = cx - bodyWidth / 2;
  const x1 = cx + bodyWidth / 2;
  const step = bodyWidth / 6;

  const path = [
    `M ${cx - width / 2} ${cy}`,
    `L ${x0} ${cy}`,
    `L ${x0 + step * 0.5} ${cy - bodyHeight}`,
    `L ${x0 + step * 1.5} ${cy + bodyHeight}`,
    `L ${x0 + step * 2.5} ${cy - bodyHeight}`,
    `L ${x0 + step * 3.5} ${cy + bodyHeight}`,
    `L ${x0 + step * 4.5} ${cy - bodyHeight}`,
    `L ${x0 + step * 5.5} ${cy + bodyHeight}`,
    `L ${x1} ${cy}`,
    `L ${cx + width / 2} ${cy}`,
  ].join(" ");

  const refLabel = escapeXml(component.id);
  const valLabel = escapeXml(component.value ?? "");

  return `
    <g id="comp-${component.id}" class="component component-resistor" data-component-id="${component.id}">
      <path d="${path}" fill="none" stroke="${colors.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <text x="${cx}" y="${cy - 16}" fill="${colors.text}" font-size="12" font-family="monospace" font-weight="600" text-anchor="middle">${refLabel}</text>
      <text x="${cx}" y="${cy + 24}" fill="${colors.accent}" font-size="11" font-family="monospace" text-anchor="middle">${valLabel}</text>
    </g>
  `;
}

/**
 * Renders a capacitor symbol (parallel plates or polarized electrolytic).
 */
export function renderCapacitor(placed: PlacedComponent, colors: SymbolColors): string {
  const { x, y, width, height, component } = placed;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const isPolarized = component.ports.some((p: Port) => p.name === "+" || p.name === "-");
  const plateGap = 8;
  const plateHeight = 24;

  const leftX = cx - plateGap / 2;
  const rightX = cx + plateGap / 2;

  let platesPath = "";
  if (isPolarized) {
    // Left plate straight, right plate curved arc
    platesPath = `
      M ${cx - width / 2} ${cy} L ${leftX} ${cy}
      M ${leftX} ${cy - plateHeight / 2} L ${leftX} ${cy + plateHeight / 2}
      M ${rightX + 4} ${cy - plateHeight / 2} Q ${rightX} ${cy} ${rightX + 4} ${cy + plateHeight / 2}
      M ${rightX + 2} ${cy} L ${cx + width / 2} ${cy}
      M ${leftX - 8} ${cy - 8} L ${leftX - 4} ${cy - 8}
      M ${leftX - 6} ${cy - 10} L ${leftX - 6} ${cy - 6}
    `;
  } else {
    // Two parallel plates
    platesPath = `
      M ${cx - width / 2} ${cy} L ${leftX} ${cy}
      M ${leftX} ${cy - plateHeight / 2} L ${leftX} ${cy + plateHeight / 2}
      M ${rightX} ${cy - plateHeight / 2} L ${rightX} ${cy + plateHeight / 2}
      M ${rightX} ${cy} L ${cx + width / 2} ${cy}
    `;
  }

  const refLabel = escapeXml(component.id);
  const valLabel = escapeXml(component.value ?? "");

  return `
    <g id="comp-${component.id}" class="component component-capacitor" data-component-id="${component.id}">
      <path d="${platesPath}" fill="none" stroke="${colors.stroke}" stroke-width="2" stroke-linecap="round" />
      <text x="${cx}" y="${cy - 18}" fill="${colors.text}" font-size="12" font-family="monospace" font-weight="600" text-anchor="middle">${refLabel}</text>
      <text x="${cx}" y="${cy + 24}" fill="${colors.accent}" font-size="11" font-family="monospace" text-anchor="middle">${valLabel}</text>
    </g>
  `;
}

/**
 * Renders an LED symbol (diode + 2 light-emitting arrows).
 */
export function renderLed(placed: PlacedComponent, colors: SymbolColors): string {
  const { x, y, width, height, component } = placed;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const triSize = 14;

  const anodeX = cx - triSize;
  const cathodeX = cx + triSize;

  // Diode triangle and cathode bar
  const diodePath = [
    `M ${cx - width / 2} ${cy} L ${anodeX} ${cy}`,
    `M ${anodeX} ${cy - triSize} L ${cathodeX} ${cy} L ${anodeX} ${cy + triSize} Z`,
    `M ${cathodeX} ${cy - triSize} L ${cathodeX} ${cy + triSize}`,
    `M ${cathodeX} ${cy} L ${cx + width / 2} ${cy}`,
  ].join(" ");

  // Light emission arrows
  const arrow1 = `M ${cx - 2} ${cy - 12} L ${cx + 10} ${cy - 24} M ${cx + 5} ${cy - 24} L ${cx + 10} ${cy - 24} L ${cx + 10} ${cy - 19}`;
  const arrow2 = `M ${cx + 6} ${cy - 8} L ${cx + 18} ${cy - 20} M ${cx + 13} ${cy - 20} L ${cx + 18} ${cy - 20} L ${cx + 18} ${cy - 15}`;

  const refLabel = escapeXml(component.id);
  const colorLabel = escapeXml(component.value ?? "LED");

  return `
    <g id="comp-${component.id}" class="component component-led" data-component-id="${component.id}">
      <path d="${diodePath}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${arrow1} ${arrow2}" fill="none" stroke="${colors.accent}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      <text x="${cx}" y="${cy - 28}" fill="${colors.text}" font-size="12" font-family="monospace" font-weight="600" text-anchor="middle">${refLabel}</text>
      <text x="${cx}" y="${cy + 26}" fill="${colors.accent}" font-size="11" font-family="monospace" text-anchor="middle">${colorLabel}</text>
    </g>
  `;
}

/**
 * Renders a standard diode symbol.
 */
export function renderDiode(placed: PlacedComponent, colors: SymbolColors): string {
  const { x, y, width, height, component } = placed;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const triSize = 14;

  const anodeX = cx - triSize;
  const cathodeX = cx + triSize;

  const diodePath = [
    `M ${cx - width / 2} ${cy} L ${anodeX} ${cy}`,
    `M ${anodeX} ${cy - triSize} L ${cathodeX} ${cy} L ${anodeX} ${cy + triSize} Z`,
    `M ${cathodeX} ${cy - triSize} L ${cathodeX} ${cy + triSize}`,
    `M ${cathodeX} ${cy} L ${cx + width / 2} ${cy}`,
  ].join(" ");

  const refLabel = escapeXml(component.id);
  const partLabel = escapeXml(component.partNumber ?? "Diode");

  return `
    <g id="comp-${component.id}" class="component component-diode" data-component-id="${component.id}">
      <path d="${diodePath}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <text x="${cx}" y="${cy - 20}" fill="${colors.text}" font-size="12" font-family="monospace" font-weight="600" text-anchor="middle">${refLabel}</text>
      <text x="${cx}" y="${cy + 24}" fill="${colors.subtext}" font-size="11" font-family="monospace" text-anchor="middle">${partLabel}</text>
    </g>
  `;
}

/**
 * Renders an SPST tactile pushbutton switch symbol.
 */
export function renderButton(placed: PlacedComponent, colors: SymbolColors): string {
  const { x, y, width, height, component } = placed;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const termGap = 24;

  const leftTermX = cx - termGap / 2;
  const rightTermX = cx + termGap / 2;

  const leads = `M ${cx - width / 2} ${cy} L ${leftTermX} ${cy} M ${rightTermX} ${cy} L ${cx + width / 2} ${cy}`;
  // Angled contact bar
  const switchBar = `M ${leftTermX} ${cy - 4} L ${rightTermX - 4} ${cy - 14} M ${cx - 4} ${cy - 14} L ${cx + 4} ${cy - 14} M ${cx} ${cy - 14} L ${cx} ${cy - 20}`;

  const refLabel = escapeXml(component.id);

  return `
    <g id="comp-${component.id}" class="component component-button" data-component-id="${component.id}">
      <path d="${leads}" fill="none" stroke="${colors.stroke}" stroke-width="2" />
      <circle cx="${leftTermX}" cy="${cy}" r="3" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2" />
      <circle cx="${rightTermX}" cy="${cy}" r="3" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2" />
      <path d="${switchBar}" fill="none" stroke="${colors.stroke}" stroke-width="2" stroke-linecap="round" />
      <text x="${cx}" y="${cy - 26}" fill="${colors.text}" font-size="12" font-family="monospace" font-weight="600" text-anchor="middle">${refLabel}</text>
    </g>
  `;
}

/**
 * Renders a Transistor (NPN) symbol.
 */
export function renderTransistor(placed: PlacedComponent, colors: SymbolColors): string {
  const { x, y, width, height, component } = placed;
  const cx = x + width / 2;
  const cy = y + height / 2;

  const basePath = `M ${cx - 20} ${cy} L ${cx - 6} ${cy} M ${cx - 6} ${cy - 16} L ${cx - 6} ${cy + 16}`;
  const collector = `M ${cx - 6} ${cy - 8} L ${cx + 12} ${cy - 18} L ${cx + 12} ${y}`;
  const emitter = `M ${cx - 6} ${cy + 8} L ${cx + 12} ${cy + 18} L ${cx + 12} ${y + height}`;
  // Emitter arrow pointing outward
  const arrow = `M ${cx + 8} ${cy + 12} L ${cx + 12} ${cy + 18} L ${cx + 6} ${cy + 18}`;

  const refLabel = escapeXml(component.id);
  const partLabel = escapeXml(component.partNumber ?? "NPN");

  return `
    <g id="comp-${component.id}" class="component component-transistor" data-component-id="${component.id}">
      <circle cx="${cx}" cy="${cy}" r="22" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.5" stroke-dasharray="3 3" />
      <path d="${basePath}" fill="none" stroke="${colors.stroke}" stroke-width="2" />
      <path d="${collector}" fill="none" stroke="${colors.stroke}" stroke-width="2" />
      <path d="${emitter}" fill="none" stroke="${colors.stroke}" stroke-width="2" />
      <path d="${arrow}" fill="${colors.stroke}" stroke="${colors.stroke}" stroke-width="1.5" />
      <text x="${cx - 14}" y="${cy - 26}" fill="${colors.text}" font-size="12" font-family="monospace" font-weight="600">${refLabel}</text>
      <text x="${cx - 14}" y="${cy + 34}" fill="${colors.subtext}" font-size="11" font-family="monospace">${partLabel}</text>
    </g>
  `;
}

/**
 * Renders an IC, MCU, or Module box with side pin leads and pin numbers.
 */
export function renderMcuOrModule(
  placed: PlacedComponent,
  colors: SymbolColors,
  options: { showPinNumbers?: boolean },
): string {
  const { x, y, width, height, component, pins } = placed;
  const title = escapeXml(component.name ?? component.id);
  const partNum = escapeXml(component.partNumber ?? component.kind.toUpperCase());

  const pinElements: string[] = [];

  for (const pin of pins.values()) {
    const isLeft = pin.direction === "left";
    const stubLen = 16;
    const stubStartX = pin.worldPos.x;
    const stubEndX = isLeft ? pin.worldPos.x + stubLen : pin.worldPos.x - stubLen;
    const pinY = pin.worldPos.y;

    const stubPath = `M ${stubStartX} ${pinY} L ${stubEndX} ${pinY}`;
    const textAnchor = isLeft ? "start" : "end";
    const textX = isLeft ? stubEndX + 6 : stubEndX - 6;

    pinElements.push(`
      <g id="port-${pin.portId}" class="port" data-port-id="${pin.portId}">
        <path d="${stubPath}" stroke="${colors.pin}" stroke-width="1.5" />
        <circle cx="${stubStartX}" cy="${pinY}" r="2.5" fill="${colors.accent}" />
        <text x="${textX}" y="${pinY + 4}" fill="${colors.text}" font-size="11" font-family="monospace" text-anchor="${textAnchor}">${escapeXml(pin.name)}</text>
        ${
          options.showPinNumbers && pin.pinNumber !== undefined
            ? `<text x="${isLeft ? stubStartX + 4 : stubStartX - 4}" y="${pinY - 4}" fill="${colors.subtext}" font-size="9" font-family="monospace" text-anchor="${textAnchor}">${escapeXml(String(pin.pinNumber))}</text>`
            : ""
        }
      </g>
    `);
  }

  // Header band height
  const headerHeight = 32;

  return `
    <g id="comp-${component.id}" class="component component-mcu" data-component-id="${component.id}">
      <!-- Outer chip body -->
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" ry="6" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2" />
      
      <!-- Top header band -->
      <path d="M ${x} ${y + headerHeight} L ${x + width} ${y + headerHeight}" stroke="${colors.stroke}" stroke-width="1.5" />
      
      <!-- IC Title and Part Number -->
      <text x="${x + width / 2}" y="${y + 18}" fill="${colors.text}" font-size="12" font-family="sans-serif" font-weight="700" text-anchor="middle">${title}</text>
      <text x="${x + width / 2}" y="${y + 28}" fill="${colors.accent}" font-size="9" font-family="monospace" text-anchor="middle">${partNum}</text>
      
      <!-- Pin stubs and labels -->
      ${pinElements.join("\n")}
    </g>
  `;
}

/**
 * Renders Ground symbol (3 tapering horizontal lines) at world coordinates (x, y).
 */
export function renderGroundGlyph(pos: PinPosition, colors: SymbolColors): string {
  const { x, y } = pos.worldPos;
  // Stub downwards 14px then draw 3 horizontal lines
  const stubEndY = y + 14;
  const path = [
    `M ${x} ${y} L ${x} ${stubEndY}`,
    `M ${x - 12} ${stubEndY} L ${x + 12} ${stubEndY}`,
    `M ${x - 7} ${stubEndY + 4} L ${x + 7} ${stubEndY + 4}`,
    `M ${x - 2} ${stubEndY + 8} L ${x + 2} ${stubEndY + 8}`,
  ].join(" ");

  return `
    <g class="symbol-ground" data-port="${pos.portId}">
      <path d="${path}" fill="none" stroke="${colors.ground}" stroke-width="2" stroke-linecap="round" />
      <text x="${x}" y="${stubEndY + 20}" fill="${colors.ground}" font-size="10" font-family="monospace" font-weight="600" text-anchor="middle">GND</text>
    </g>
  `;
}

/**
 * Renders Power symbol (upward bar / arrow) with voltage label.
 */
export function renderPowerGlyph(pos: PinPosition, label: string, colors: SymbolColors): string {
  const { x, y } = pos.worldPos;
  const stubEndY = y - 14;
  const path = [
    `M ${x} ${y} L ${x} ${stubEndY}`,
    `M ${x - 10} ${stubEndY} L ${x + 10} ${stubEndY}`,
    `M ${x - 6} ${stubEndY} L ${x} ${stubEndY - 7} L ${x + 6} ${stubEndY}`,
  ].join(" ");

  return `
    <g class="symbol-power" data-port="${pos.portId}">
      <path d="${path}" fill="${colors.power}" stroke="${colors.power}" stroke-width="1.8" stroke-linejoin="round" />
      <text x="${x}" y="${stubEndY - 11}" fill="${colors.power}" font-size="10" font-family="monospace" font-weight="700" text-anchor="middle">${escapeXml(label)}</text>
    </g>
  `;
}

/**
 * Renders a Net Label chevron badge at a pin.
 */
export function renderNetLabelBadge(
  x: number,
  y: number,
  direction: "left" | "right",
  label: string,
  colors: SymbolColors,
): string {
  const badgeWidth = Math.max(45, label.length * 7 + 16);
  const badgeHeight = 18;
  const tipDepth = 6;

  let path = "";
  let textX = 0;

  if (direction === "right") {
    // Points to the right: <x, y> is pin contact on left
    path = [
      `M ${x} ${y}`,
      `L ${x + 8} ${y - badgeHeight / 2}`,
      `L ${x + badgeWidth - tipDepth} ${y - badgeHeight / 2}`,
      `L ${x + badgeWidth} ${y}`,
      `L ${x + badgeWidth - tipDepth} ${y + badgeHeight / 2}`,
      `L ${x + 8} ${y + badgeHeight / 2}`,
      "Z",
    ].join(" ");
    textX = x + badgeWidth / 2 + 2;
  } else {
    // Points to the left
    path = [
      `M ${x} ${y}`,
      `L ${x - 8} ${y - badgeHeight / 2}`,
      `L ${x - badgeWidth + tipDepth} ${y - badgeHeight / 2}`,
      `L ${x - badgeWidth} ${y}`,
      `L ${x - badgeWidth + tipDepth} ${y + badgeHeight / 2}`,
      `L ${x - 8} ${y + badgeHeight / 2}`,
      "Z",
    ].join(" ");
    textX = x - badgeWidth / 2 - 2;
  }

  return `
    <g class="net-label-badge">
      <path d="${path}" fill="${colors.fill}" stroke="${colors.wire}" stroke-width="1.5" stroke-linejoin="round" />
      <text x="${textX}" y="${y + 4}" fill="${colors.text}" font-size="10" font-family="monospace" font-weight="600" text-anchor="middle">${escapeXml(label)}</text>
    </g>
  `;
}
