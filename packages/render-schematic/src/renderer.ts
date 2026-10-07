/**
 * @license Apache-2.0
 * @s2c/render-schematic — Core SVG Schematic Renderer.
 * Net-Label-Only architecture per Doc §10.
 */

import type { Circuit, Component, Net, Port } from "@s2c/circuit-json";
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
 * Resolves a human-readable engineering net name for display.
 * Avoids dominating the schematic with anonymous N$1 / N$2 identifiers while
 * preserving internal net IDs under the hood.
 */
function resolveDisplayNetName(netId: string, circuit: Circuit): string {
  const netUpper = netId.toUpperCase();
  if (
    netUpper === "GND" ||
    netUpper === "5V" ||
    netUpper === "3V3" ||
    netUpper === "VCC" ||
    netUpper === "VIN" ||
    netUpper === "RESET" ||
    netUpper === "SDA" ||
    netUpper === "SCL"
  ) {
    return netId;
  }

  // If already an explicitly assigned named net, preserve it
  if (!netId.startsWith("N$") && !netId.startsWith("N_")) {
    return netId;
  }

  const netObj = circuit.nets.find((n: Net) => n.id === netId);
  if (!netObj?.portIds || netObj.portIds.length === 0) {
    return netId;
  }

  // Find MCU port in this net if any
  const mcuPortId = netObj.portIds.find((pid: string) => {
    const compId = pid.split(".")[0];
    const comp = circuit.components.find((c: Component) => c.id === compId);
    return comp && (comp.kind === "mcu" || comp.kind === "ic");
  });

  // Also check if any component in this net connects via a resistor/passive to an MCU net
  let relatedMcuPinName = "";
  if (mcuPortId) {
    relatedMcuPinName = mcuPortId.split(".")[1] ?? "";
  } else {
    for (const pid of netObj.portIds) {
      const compId = pid.split(".")[0];
      const otherNetsOfComp = circuit.nets.filter(
        (n: Net) => n.id !== netId && n.portIds.some((p: string) => p.startsWith(`${compId}.`)),
      );
      for (const on of otherNetsOfComp) {
        const onUpper = on.id.toUpperCase();
        if (
          on.kind === "ground" ||
          on.kind === "power" ||
          onUpper === "GND" ||
          onUpper === "5V" ||
          onUpper === "3V3" ||
          onUpper === "VCC" ||
          onUpper === "VIN"
        ) {
          continue;
        }

        const mcuPort = on.portIds.find((p: string) => {
          const cid = p.split(".")[0];
          const c = circuit.components.find((comp: Component) => comp.id === cid);
          return c && (c.kind === "mcu" || c.kind === "ic");
        });
        if (mcuPort) {
          const pName = mcuPort.split(".")[1] ?? "";
          const pUpper = pName.toUpperCase();
          if (pUpper !== "GND" && pUpper !== "5V" && pUpper !== "3V3" && pUpper !== "VIN") {
            relatedMcuPinName = pName;
            break;
          }
        }
      }
      if (relatedMcuPinName) break;
    }
  }

  const otherPortIds = netObj.portIds.filter((pid: string) => pid !== mcuPortId);
  const otherComps = otherPortIds
    .map((pid: string) => {
      const compId = pid.split(".")[0];
      return circuit.components.find((c: Component) => c.id === compId);
    })
    .filter((c): c is Component => c !== undefined);

  const pinUpper = relatedMcuPinName.toUpperCase();

  // Pin-based direct mappings
  if (pinUpper === "D2") return "BUTTON_1";
  if (pinUpper === "D3") return "BUTTON_2";
  if (pinUpper === "D4") return mcuPortId ? "LED_1" : "LED1_ANODE";
  if (pinUpper === "D5") return mcuPortId ? "LED_2" : "LED2_ANODE";
  if (pinUpper === "D6") return "MOTOR_CTRL";
  if (pinUpper === "D7") return mcuPortId ? "BUZZER" : "BUZZER_SIG";
  if (pinUpper === "D9") return "SERVO_PWM";
  if (pinUpper === "A0") return "POT_A0";
  if (pinUpper === "A1") return "LDR_A1";

  // Check peripheral components connected to this net
  const hasServo = otherComps.some(
    (c: Component) =>
      c.id.toUpperCase().startsWith("SERVO") ||
      c.name?.toLowerCase().includes("servo") ||
      c.partNumber?.toUpperCase().includes("SERVO"),
  );
  if (hasServo) return "SERVO_PWM";

  const hasMotor = otherComps.some(
    (c: Component) =>
      c.id.toUpperCase().startsWith("MOTOR") ||
      c.id.toUpperCase().startsWith("M") ||
      c.name?.toLowerCase().includes("motor") ||
      c.partNumber?.toUpperCase().includes("MOTOR"),
  );
  if (hasMotor) return "MOTOR_CTRL";

  const hasBuzzer = otherComps.some(
    (c: Component) =>
      c.id.toUpperCase().startsWith("PIEZO") ||
      c.id.toUpperCase().startsWith("BUZZER") ||
      c.id.toUpperCase().startsWith("SPK") ||
      c.name?.toLowerCase().includes("buzzer") ||
      c.name?.toLowerCase().includes("piezo"),
  );
  if (hasBuzzer) return "BUZZER";

  const hasPot = otherComps.some(
    (c: Component) => c.kind === "potentiometer" || c.id.toUpperCase().startsWith("POT"),
  );
  if (hasPot) return pinUpper.startsWith("A") ? `POT_${pinUpper}` : "POT_A0";

  const hasLdr = otherComps.some(
    (c: Component) =>
      c.id.toUpperCase().startsWith("LDR") ||
      c.name?.toLowerCase().includes("light") ||
      c.partNumber?.toUpperCase().includes("LDR"),
  );
  if (hasLdr) return pinUpper.startsWith("A") ? `LDR_${pinUpper}` : "LDR_A1";

  const hasButton = otherComps.some(
    (c: Component) =>
      c.kind === "button" ||
      c.id.toUpperCase().startsWith("SW") ||
      c.id.toUpperCase().startsWith("BTN"),
  );
  if (hasButton) {
    if (pinUpper && pinUpper !== "GND" && pinUpper !== "5V") return `BUTTON_${pinUpper}`;
    return "BUTTON_1";
  }

  const hasLed = otherComps.some(
    (c: Component) =>
      c.kind === "led" ||
      c.id.toUpperCase().startsWith("LED") ||
      c.id.toUpperCase().startsWith("D"),
  );
  if (hasLed) {
    if (pinUpper && pinUpper !== "GND" && pinUpper !== "5V") return `LED_${pinUpper}`;
    const led = otherComps.find((c) => c.kind === "led");
    return led ? `${led.id}_ANODE` : "LED_1";
  }

  if (pinUpper.startsWith("D") || pinUpper.startsWith("A")) {
    return pinUpper;
  }

  return netId.replace("$", "_");
}

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
  const bgFill = theme === "dark" ? "#0A0A0A" : "#F7F4EC";
  svgSections.push(`<rect width="${width}" height="${height}" fill="${bgFill}" />`);

  // Grid layer
  if (showGrid) {
    svgSections.push(
      `<rect width="${width}" height="${height}" fill="url(#grid-pattern)" opacity="0.8" />`,
    );
  }

  // Engineering Title Block / Outer Frame per ISO 7200 & ANSI Y14.1 standards
  if (showTitleBlock) {
    const framePadding = 16;
    const titleBlockWidth = 280;
    const titleBlockHeight = 72;
    const tbX = width - framePadding - titleBlockWidth;
    const tbY = height - framePadding - titleBlockHeight;

    const circuitTitle = escapeXml(
      circuit.name && circuit.name !== "SynthesizedCircuit"
        ? circuit.name
        : "Arduino Uno Hardware Test",
    );
    const dateStr = escapeXml(
      circuit.metadata?.generatedAt
        ? circuit.metadata.generatedAt.split("T")[0]
        : new Date().toISOString().split("T")[0],
    );

    svgSections.push(`
      <!-- Outer Engineering Border -->
      <rect x="${framePadding}" y="${framePadding}" width="${width - framePadding * 2}" height="${height - framePadding * 2}" fill="none" stroke="${colors.stroke}" stroke-width="1.2" opacity="0.65" />
      
      <!-- Authentic CAD Drawing Title Block (Bottom-Right Corner) -->
      <g id="title-block" class="title-block">
        <rect x="${tbX}" y="${tbY}" width="${titleBlockWidth}" height="${titleBlockHeight}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.2" />
        
        <!-- Partition Lines -->
        <line x1="${tbX}" y1="${tbY + 24}" x2="${tbX + titleBlockWidth}" y2="${tbY + 24}" stroke="${colors.stroke}" stroke-width="0.8" />
        <line x1="${tbX}" y1="${tbY + 48}" x2="${tbX + titleBlockWidth}" y2="${tbY + 48}" stroke="${colors.stroke}" stroke-width="0.8" />
        <line x1="${tbX + 175}" y1="${tbY}" x2="${tbX + 175}" y2="${tbY + 48}" stroke="${colors.stroke}" stroke-width="0.8" />
        <line x1="${tbX + 55}" y1="${tbY + 48}" x2="${tbX + 55}" y2="${tbY + titleBlockHeight}" stroke="${colors.stroke}" stroke-width="0.8" />
        <line x1="${tbX + 130}" y1="${tbY + 48}" x2="${tbX + 130}" y2="${tbY + titleBlockHeight}" stroke="${colors.stroke}" stroke-width="0.8" />
        <line x1="${tbX + 205}" y1="${tbY + 48}" x2="${tbX + 205}" y2="${tbY + titleBlockHeight}" stroke="${colors.stroke}" stroke-width="0.8" />

        <!-- Row 1: Project & Target -->
        <text x="${tbX + 6}" y="${tbY + 9}" fill="${colors.subtext}" font-size="7" font-family="monospace">PROJECT</text>
        <text x="${tbX + 6}" y="${tbY + 20}" fill="${colors.text}" font-size="9" font-family="monospace" font-weight="700">Sketch2Circuit Arduino Test</text>

        <text x="${tbX + 181}" y="${tbY + 9}" fill="${colors.subtext}" font-size="7" font-family="monospace">TARGET</text>
        <text x="${tbX + 181}" y="${tbY + 20}" fill="${colors.text}" font-size="9" font-family="monospace" font-weight="600">Arduino Uno R3</text>

        <!-- Row 2: Drawing & Designer -->
        <text x="${tbX + 6}" y="${tbY + 33}" fill="${colors.subtext}" font-size="7" font-family="monospace">DRAWING</text>
        <text x="${tbX + 6}" y="${tbY + 44}" fill="${colors.text}" font-size="9" font-family="monospace" font-weight="600">${circuitTitle}</text>

        <text x="${tbX + 181}" y="${tbY + 33}" fill="${colors.subtext}" font-size="7" font-family="monospace">DESIGNER</text>
        <text x="${tbX + 181}" y="${tbY + 44}" fill="${colors.subtext}" font-size="9" font-family="monospace">Sketch2Circuit</text>

        <!-- Row 3: Rev, Sheet, Parts, Date -->
        <text x="${tbX + 6}" y="${tbY + 56}" fill="${colors.subtext}" font-size="6.5" font-family="monospace">REV</text>
        <text x="${tbX + 6}" y="${tbY + 67}" fill="${colors.text}" font-size="9" font-family="monospace" font-weight="700">A</text>

        <text x="${tbX + 61}" y="${tbY + 56}" fill="${colors.subtext}" font-size="6.5" font-family="monospace">SHEET</text>
        <text x="${tbX + 61}" y="${tbY + 67}" fill="${colors.text}" font-size="9" font-family="monospace">1 / 1</text>

        <text x="${tbX + 136}" y="${tbY + 56}" fill="${colors.subtext}" font-size="6.5" font-family="monospace">PARTS</text>
        <text x="${tbX + 136}" y="${tbY + 67}" fill="${colors.text}" font-size="9" font-family="monospace">${circuit.components.length}</text>

        <text x="${tbX + 211}" y="${tbY + 56}" fill="${colors.subtext}" font-size="6.5" font-family="monospace">DATE</text>
        <text x="${tbX + 211}" y="${tbY + 67}" fill="${colors.subtext}" font-size="8.5" font-family="monospace">${dateStr}</text>
      </g>
    `);
  }

  // Net Labels & Power/Ground Glyphs layer (Doc §10: net labels instead of routed wires)
  const glyphsSvg: string[] = [];

  for (const comp of layout.components) {
    for (const pin of comp.pins.values()) {
      const portDef = comp.component.ports.find((p: Port) => p.id === pin.portId);
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
        // Resolve meaningful engineering net name for display
        const displayLabel = resolveDisplayNetName(netId, circuit);

        // Render net label flag attached to port terminal
        glyphsSvg.push(
          renderNetLabelBadge(
            pin.worldPos.x,
            pin.worldPos.y,
            pin.direction === "left" ? "left" : "right",
            displayLabel,
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
