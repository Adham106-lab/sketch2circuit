/**
 * @license Apache-2.0
 * @s2c/render-schematic — Core SVG Schematic Renderer.
 * Net-Label-Only architecture per Doc §10.
 */

import type { Circuit } from "@s2c/circuit-json";
import { computeSchematicLayout } from "./layout.js";
import {
  escapeXml,
  renderButton,
  renderCapacitor,
  renderDiode,
  renderGroundGlyph,
  renderLed,
  renderMcuOrModule,
  renderNetLabelBadge,
  renderPowerGlyph,
  renderResistor,
  renderTransistor,
  type SymbolColors,
  THEME_COLORS,
} from "./symbols.js";
import type { PlacedComponent, RenderResult, SchematicRenderOptions } from "./types.js";

/**
 * Renders a canonical Circuit IR into a production-grade SVG schematic.
 * Strictly adheres to Doc §10 (Net-label-only representation for v1).
 */
export function renderSchematicSvg(
  circuit: Circuit,
  options: SchematicRenderOptions = {},
): RenderResult {
  const theme = options.theme ?? "dark";
  const colors = THEME_COLORS[theme];
  const showGrid = options.showGrid ?? true;
  const showTitleBlock = options.showTitleBlock ?? true;
  const showNetLabels = options.showNetLabels ?? true;
  const showPinNumbers = options.showPinNumbers ?? true;
  const gridSize = options.gridSize ?? 20;

  const layout = computeSchematicLayout(circuit, options);
  const width = layout.width;
  const height = layout.height;
  const viewBox = `0 0 ${width} ${height}`;

  const svgSections: string[] = [];

  // SVG header and definitions
  if (showGrid) {
    const defs = `
    <defs>
      <!-- Grid Pattern -->
      <pattern id="grid-pattern" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
        <circle cx="${gridSize / 2}" cy="${gridSize / 2}" r="1" fill="${colors.subtext}" opacity="0.35" />
      </pattern>
    </defs>
    `;
    svgSections.push(defs);
  }

  // Background canvas
  const bgFill = theme === "dark" ? "#0b0f19" : "#ffffff";
  svgSections.push(`<rect width="${width}" height="${height}" fill="${bgFill}" />`);

  // Grid layer
  if (showGrid) {
    svgSections.push(
      `<rect width="${width}" height="${height}" fill="url(#grid-pattern)" opacity="0.8" />`,
    );
  }

  // Engineering Title Block / Outer Frame
  if (showTitleBlock) {
    const framePadding = 16;
    const titleBlockWidth = 260;
    const titleBlockHeight = 65;
    const tbX = width - framePadding - titleBlockWidth;
    const tbY = height - framePadding - titleBlockHeight;

    const circuitTitle = escapeXml(circuit.name || "Untitled Circuit");
    const circuitDesc = escapeXml(circuit.metadata?.description || "Schematic Diagram");
    // Deterministic date handling: stable fallback if metadata timestamp absent
    const dateStr = escapeXml(
      circuit.metadata?.generatedAt ? circuit.metadata.generatedAt.split("T")[0] : "2026-01-01",
    );

    svgSections.push(`
      <!-- Outer Engineering Border -->
      <rect x="${framePadding}" y="${framePadding}" width="${width - framePadding * 2}" height="${height - framePadding * 2}" fill="none" stroke="${colors.stroke}" stroke-width="1.5" opacity="0.6" />
      
      <!-- Title Block -->
      <g id="title-block" class="title-block">
        <rect x="${tbX}" y="${tbY}" width="${titleBlockWidth}" height="${titleBlockHeight}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.5" />
        <line x1="${tbX}" y1="${tbY + 28}" x2="${tbX + titleBlockWidth}" y2="${tbY + 28}" stroke="${colors.stroke}" stroke-width="1" />
        <line x1="${tbX + 160}" y1="${tbY + 28}" x2="${tbX + 160}" y2="${tbY + titleBlockHeight}" stroke="${colors.stroke}" stroke-width="1" />
        <text x="${tbX + 12}" y="${tbY + 18}" fill="${colors.text}" font-size="13" font-family="sans-serif" font-weight="700">${circuitTitle}</text>
        <text x="${tbX + 12}" y="${tbY + 44}" fill="${colors.subtext}" font-size="10" font-family="sans-serif">${circuitDesc}</text>
        <text x="${tbX + 12}" y="${tbY + 56}" fill="${colors.subtext}" font-size="9" font-family="monospace">REV: 0.1 | DATE: ${dateStr}</text>
        <text x="${tbX + 172}" y="${tbY + 48}" fill="${colors.accent}" font-size="10" font-family="monospace" font-weight="600">@s2c/cad</text>
      </g>
    `);
  }

  // Net Labels & Power/Ground Glyphs layer (Doc §10: net labels instead of routed wires)
  const glyphsSvg: string[] = [];

  for (const comp of layout.components) {
    for (const pin of comp.pins.values()) {
      const portDef = comp.component.ports.find((p) => p.id === pin.portId);
      const netId = portDef?.netId;

      if (!netId) {
        continue;
      }

      const netUpper = netId.toUpperCase();
      if (netUpper === "GND" || portDef?.kind === "ground") {
        glyphsSvg.push(renderGroundGlyph(pin, colors));
      } else if (
        netUpper === "5V" ||
        netUpper === "3V3" ||
        netUpper === "VCC" ||
        portDef?.kind === "power"
      ) {
        glyphsSvg.push(renderPowerGlyph(pin, netId || "VCC", colors));
      } else if (showNetLabels) {
        // Render net label chevron badge attached to port terminal
        glyphsSvg.push(
          renderNetLabelBadge(
            pin.worldPos.x,
            pin.worldPos.y,
            pin.direction === "left" ? "left" : "right",
            netId,
            colors,
          ),
        );
      }
    }
  }

  svgSections.push(`<g id="layer-net-labels">${glyphsSvg.join("\n")}</g>`);

  // Components layer
  const componentsSvg: string[] = [];

  for (const placed of layout.components) {
    componentsSvg.push(renderPlacedComponent(placed, colors, { showPinNumbers }));
  }

  svgSections.push(`<g id="layer-components">${componentsSvg.join("\n")}</g>`);

  const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">
  ${svgSections.join("\n")}
</svg>
  `.trim();

  return {
    svg: svgContent,
    width,
    height,
    viewBox,
  };
}

/**
 * Dispatches component rendering to specific glyph renderers based on kind.
 */
function renderPlacedComponent(
  placed: PlacedComponent,
  colors: SymbolColors,
  options: { showPinNumbers?: boolean },
): string {
  switch (placed.component.kind) {
    case "resistor":
      return renderResistor(placed, colors);
    case "capacitor":
      return renderCapacitor(placed, colors);
    case "led":
      return renderLed(placed, colors);
    case "diode":
      return renderDiode(placed, colors);
    case "button":
      return renderButton(placed, colors);
    case "transistor":
      return renderTransistor(placed, colors);
    default:
      return renderMcuOrModule(placed, colors, options);
  }
}
