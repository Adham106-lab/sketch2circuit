/**
 * @license Apache-2.0
 * @s2c/circuit2d — Pure Vector SVG Schematic Symbols & Exact Pin Anchor Geometry.
 * Zero external image assets; supports rotation (0, 90, 180, 270) and active net glow.
 */

import type React from "react";
import {
  type NormalizedPin,
  resistorBands,
  type SymbolKind,
} from "./circuitModel.js";

// ============================================================================
// SYMBOL PROPS & PIN ANCHOR GEOMETRY
// ============================================================================

export interface SymbolProps {
  x: number;
  y: number;
  rotation?: 0 | 90 | 180 | 270;
  active?: boolean;
  dimmed?: boolean;
  color: string;
  label: string;
  value: string;
  partId?: string;
  theme?: "light" | "dark";
  inputPullup?: boolean;
  ledColorHex?: string;
  pins?: ReadonlyArray<NormalizedPin>;
  onSelect?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

export interface PinAnchor {
  pinId: string;
  pinName: string;
  x: number;
  y: number;
  side: "left" | "right" | "top" | "bottom";
  netId: string | null;
}

interface LocalPinDef {
  name: string;
  dx: number;
  dy: number;
  side: "left" | "right" | "top" | "bottom";
}

function rotatePoint(
  dx: number,
  dy: number,
  rotation: 0 | 90 | 180 | 270 = 0,
): { rx: number; ry: number } {
  switch (rotation) {
    case 90:
      return { rx: -dy, ry: dx };
    case 180:
      return { rx: -dx, ry: -dy };
    case 270:
      return { rx: dy, ry: -dx };
    default:
      return { rx: dx, ry: dy };
  }
}

function rotateSide(
  side: "left" | "right" | "top" | "bottom",
  rotation: 0 | 90 | 180 | 270 = 0,
): "left" | "right" | "top" | "bottom" {
  const order: ReadonlyArray<"left" | "top" | "right" | "bottom"> = [
    "left",
    "top",
    "right",
    "bottom",
  ];
  const idx = order.indexOf(side);
  const steps = Math.round(rotation / 90) % 4;
  return order[(idx + steps) % 4] ?? side;
}

/**
 * Returns local pin definitions for a symbol kind before rotation.
 * Standard 2-terminal symbols span dx = -48 (left lead) to dx = +48 (right lead).
 * Multi-pin modules place pins on the left edge (dx = -56) spaced vertically by 18px.
 */
export function getLocalPinDefs(
  symbolKind: SymbolKind,
  pins?: ReadonlyArray<NormalizedPin>,
): LocalPinDef[] {
  switch (symbolKind) {
    case "resistor":
    case "ldr":
      return [
        { name: pins?.[0]?.name ?? "1", dx: -48, dy: 0, side: "left" },
        { name: pins?.[1]?.name ?? "2", dx: 48, dy: 0, side: "right" },
      ];
    case "led":
      return [
        { name: pins?.[0]?.name ?? "A", dx: -48, dy: 0, side: "left" },
        { name: pins?.[1]?.name ?? "K", dx: 48, dy: 0, side: "right" },
      ];
    case "button":
      return [
        { name: pins?.[0]?.name ?? "1", dx: -48, dy: 0, side: "left" },
        { name: pins?.[1]?.name ?? "2", dx: 48, dy: 0, side: "right" },
      ];
    case "potentiometer":
      return [
        { name: "1", dx: -48, dy: -16, side: "left" },
        { name: "2", dx: -48, dy: 0, side: "left" },
        { name: "3", dx: -48, dy: 16, side: "left" },
      ];
    case "hc-sr04":
      return [
        { name: "VCC", dx: -56, dy: -27, side: "left" },
        { name: "TRIG", dx: -56, dy: -9, side: "left" },
        { name: "ECHO", dx: -56, dy: 9, side: "left" },
        { name: "GND", dx: -56, dy: 27, side: "left" },
      ];
    case "servo":
      return [
        { name: "PWM", dx: -56, dy: -18, side: "left" },
        { name: "VCC", dx: -56, dy: 0, side: "left" },
        { name: "GND", dx: -56, dy: 18, side: "left" },
      ];
    case "buzzer":
      return [
        { name: pins?.[0]?.name ?? "+", dx: -48, dy: -12, side: "left" },
        { name: pins?.[1]?.name ?? "-", dx: -48, dy: 12, side: "left" },
      ];
    case "oled":
      return [
        { name: "VCC", dx: -56, dy: -27, side: "left" },
        { name: "GND", dx: -56, dy: -9, side: "left" },
        { name: "SDA", dx: -56, dy: 9, side: "left" },
        { name: "SCL", dx: -56, dy: 27, side: "left" },
      ];
    default: {
      if (!pins || pins.length === 0) {
        return [
          { name: "1", dx: -48, dy: 0, side: "left" },
          { name: "2", dx: 48, dy: 0, side: "right" },
        ];
      }
      if (pins.length === 2) {
        return [
          { name: pins[0]!.name, dx: -48, dy: 0, side: "left" },
          { name: pins[1]!.name, dx: 48, dy: 0, side: "right" },
        ];
      }
      const count = pins.length;
      const step = 18;
      const startY = -((count - 1) * step) / 2;
      return pins.map((p, idx) => ({
        name: p.name,
        dx: -56,
        dy: startY + idx * step,
        side: "left" as const,
      }));
    }
  }
}

/**
 * Computes exact world SVG coordinates for all pins of a placed schematic symbol.
 */
export function getSymbolPinAnchors(
  symbolKind: SymbolKind,
  partId: string,
  x: number,
  y: number,
  rotation: 0 | 90 | 180 | 270 = 0,
  pins?: ReadonlyArray<NormalizedPin>,
): PinAnchor[] {
  const localDefs = getLocalPinDefs(symbolKind, pins);

  return localDefs.map((def, idx) => {
    const matchedPin =
      pins?.find((p) => p.name.toUpperCase() === def.name.toUpperCase()) ?? pins?.[idx];
    const { rx, ry } = rotatePoint(def.dx, def.dy, rotation);
    return {
      pinId: matchedPin?.id ?? `${partId}.${def.name}`,
      pinName: matchedPin?.name ?? def.name,
      x: Math.round(x + rx),
      y: Math.round(y + ry),
      side: rotateSide(def.side, rotation),
      netId: matchedPin?.netId ?? null,
    };
  });
}

/**
 * Returns the bounding box half-extents of a symbol around its (x, y) center
 * so the orthogonal router can avoid routing wires through symbol bodies.
 */
export function getSymbolObstacleBounds(
  symbolKind: SymbolKind,
  x: number,
  y: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  switch (symbolKind) {
    case "hc-sr04":
    case "oled":
      return { minX: x - 52, minY: y - 42, maxX: x + 56, maxY: y + 42 };
    case "servo":
      return { minX: x - 52, minY: y - 34, maxX: x + 52, maxY: y + 34 };
    case "potentiometer":
    case "buzzer":
      return { minX: x - 44, minY: y - 30, maxX: x + 44, maxY: y + 30 };
    default:
      return { minX: x - 42, minY: y - 24, maxX: x + 42, maxY: y + 24 };
  }
}

// ============================================================================
// SHARED STYLING HELPER
// ============================================================================

function getSymbolPalette(
  theme: "light" | "dark" = "light",
  active = false,
  color = "#1e293b",
) {
  const isDark = theme === "dark";
  const ink = active ? "#06b6d4" : isDark ? "#e2e8f0" : "#1e293b";
  const cardFill = isDark ? "#0f172a" : "#faf6ee";
  const subText = isDark ? "#94a3b8" : "#475569";
  const badgeBg = isDark ? "#1e293b" : "#f1ebe0";
  const accent = active ? "#06b6d4" : color;
  return { ink, cardFill, subText, badgeBg, accent, isDark };
}

// ============================================================================
// 1. IEC RESISTOR SYMBOL (with E24 4-Band Color Stripes + Value Badge)
// ============================================================================

export function ResistorSymbol({
  x,
  y,
  rotation = 0,
  active = false,
  dimmed = false,
  color,
  label,
  value,
  theme = "light",
  onSelect,
  onHoverChange,
}: SymbolProps): React.ReactElement {
  const { ink, cardFill, badgeBg, accent } = getSymbolPalette(theme, active, color);
  const bandSpec = resistorBands(value);
  const bandX = [-18, -7, 4, 16] as const;

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      style={{
        opacity: dimmed ? 0.3 : 1,
        cursor: "pointer",
        transition: "opacity 150ms ease",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      {active && (
        <rect
          x={-34}
          y={-15}
          width={68}
          height={30}
          rx={6}
          fill="none"
          stroke="#06b6d4"
          strokeWidth={4}
          opacity={0.35}
        />
      )}

      {/* Left & Right Axial Leads (-48..-28 and +28..+48) */}
      <line x1={-48} y1={0} x2={-28} y2={0} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
      <line x1={28} y1={0} x2={48} y2={0} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />

      {/* Pin Anchor Dots */}
      <circle cx={-48} cy={0} r={3} fill={accent} />
      <circle cx={48} cy={0} r={3} fill={accent} />

      {/* IEC Rectangular Body */}
      <rect
        x={-28}
        y={-10}
        width={56}
        height={20}
        rx={3}
        fill={cardFill}
        stroke={ink}
        strokeWidth={2}
      />

      {/* 4 E24 Color Bands Inside Body */}
      {bandSpec.bands.map((b, idx) => (
        <rect
          key={`${b.name}-${idx}`}
          x={bandX[idx] ?? 0}
          y={-9}
          width={5}
          height={18}
          fill={b.hex}
          stroke={ink}
          strokeWidth={0.5}
        />
      ))}

      {/* Component Reference Label Above */}
      <text
        x={0}
        y={-16}
        textAnchor="middle"
        fill={ink}
        fontSize={11}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label}
      </text>

      {/* Formatted E24 Value Badge Below */}
      <rect
        x={-28}
        y={14}
        width={56}
        height={16}
        rx={8}
        fill={badgeBg}
        stroke={ink}
        strokeWidth={1}
      />
      <text
        x={0}
        y={25}
        textAnchor="middle"
        fill={ink}
        fontSize={9.5}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {bandSpec.formatted}
      </text>
    </g>
  );
}

// ============================================================================
// 2. LED SYMBOL (Triangle + Cathode Bar + 2 Emission Arrows + Active Glow)
// ============================================================================

export function LedSymbol({
  x,
  y,
  rotation = 0,
  active = false,
  dimmed = false,
  color,
  label,
  value,
  ledColorHex = "#ef4444",
  theme = "light",
  onSelect,
  onHoverChange,
}: SymbolProps): React.ReactElement {
  const { ink, cardFill, subText, accent } = getSymbolPalette(theme, active, color);
  const emitColor = ledColorHex || color || "#ef4444";

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      style={{
        opacity: dimmed ? 0.3 : 1,
        cursor: "pointer",
        transition: "opacity 150ms ease",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      {/* Glow Halo when Active */}
      <circle
        cx={0}
        cy={0}
        r={active ? 26 : 18}
        fill={emitColor}
        opacity={active ? 0.28 : 0.1}
      />
      {active && (
        <circle
          cx={0}
          cy={0}
          r={22}
          fill="none"
          stroke="#06b6d4"
          strokeWidth={2.5}
          strokeDasharray="3 3"
        />
      )}

      {/* Leads: Anode (-48..-12) and Cathode (+12..+48) */}
      <line x1={-48} y1={0} x2={-12} y2={0} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
      <line x1={12} y1={0} x2={48} y2={0} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />

      <circle cx={-48} cy={0} r={3} fill={accent} />
      <circle cx={48} cy={0} r={3} fill={accent} />

      {/* A / K Polarity Markers */}
      <text x={-24} y={-6} textAnchor="middle" fill={subText} fontSize={8.5} fontWeight={700}>
        A+
      </text>
      <text x={24} y={-6} textAnchor="middle" fill={subText} fontSize={8.5} fontWeight={700}>
        K−
      </text>

      {/* Diode Triangle */}
      <polygon
        points="-12,-12 -12,12 12,0"
        fill={active ? emitColor : cardFill}
        fillOpacity={active ? 0.85 : 1}
        stroke={ink}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Cathode Bar */}
      <line x1={12} y1={-12} x2={12} y2={12} stroke={ink} strokeWidth={2.6} strokeLinecap="round" />

      {/* Two Optical Emission Arrows */}
      <g stroke={emitColor} strokeWidth={1.8} strokeLinecap="round" fill="none">
        <line x1={-2} y1={-14} x2={8} y2={-24} />
        <polyline points="3,-24 8,-24 8,-19" />
        <line x1={6} y1={-11} x2={16} y2={-21} />
        <polyline points="11,-21 16,-21 16,-16" />
      </g>

      {/* Label & Color Value */}
      <text
        x={0}
        y={25}
        textAnchor="middle"
        fill={ink}
        fontSize={10.5}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label} ({value})
      </text>
    </g>
  );
}

// ============================================================================
// 3. TACTILE PUSH BUTTON (SPST NO + INPUT_PULLUP Annotation)
// ============================================================================

export function ButtonSymbol({
  x,
  y,
  rotation = 0,
  active = false,
  dimmed = false,
  color,
  label,
  inputPullup = true,
  theme = "light",
  onSelect,
  onHoverChange,
}: SymbolProps): React.ReactElement {
  const { ink, badgeBg, accent } = getSymbolPalette(theme, active, color);

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      style={{
        opacity: dimmed ? 0.3 : 1,
        cursor: "pointer",
        transition: "opacity 150ms ease",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      {active && (
        <rect
          x={-36}
          y={-22}
          width={72}
          height={42}
          rx={8}
          fill="none"
          stroke="#06b6d4"
          strokeWidth={3.5}
          opacity={0.35}
        />
      )}

      {/* Left & Right Leads */}
      <line x1={-48} y1={0} x2={-16} y2={0} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
      <line x1={16} y1={0} x2={48} y2={0} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />

      <circle cx={-48} cy={0} r={3} fill={accent} />
      <circle cx={48} cy={0} r={3} fill={accent} />

      {/* SPST Stationary Contacts */}
      <circle cx={-16} cy={0} r={3.5} fill={badgeBg} stroke={ink} strokeWidth={2} />
      <circle cx={16} cy={0} r={3.5} fill={badgeBg} stroke={ink} strokeWidth={2} />

      {/* Normally-Open Bridge Bar + Plunger */}
      <line x1={-20} y1={-9} x2={20} y2={-9} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
      <line x1={0} y1={-9} x2={0} y2={-17} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
      <line x1={-7} y1={-17} x2={7} y2={-17} stroke={accent} strokeWidth={2.8} strokeLinecap="round" />

      {/* Label */}
      <text
        x={0}
        y={-23}
        textAnchor="middle"
        fill={ink}
        fontSize={10.5}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label}
      </text>

      {/* INPUT_PULLUP Badge */}
      <rect
        x={-38}
        y={10}
        width={76}
        height={15}
        rx={7.5}
        fill={badgeBg}
        stroke={accent}
        strokeWidth={1.1}
      />
      <text
        x={0}
        y={20.5}
        textAnchor="middle"
        fill={ink}
        fontSize={8.5}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {inputPullup ? "INPUT_PULLUP" : "SPST NO"}
      </text>
    </g>
  );
}

// ============================================================================
// 4. HC-SR04 ULTRASONIC SENSOR (VCC / TRIG / ECHO / GND + Acoustic Arcs)
// ============================================================================

export function HcSr04Symbol({
  x,
  y,
  rotation = 0,
  active = false,
  dimmed = false,
  color,
  label,
  theme = "light",
  onSelect,
  onHoverChange,
}: SymbolProps): React.ReactElement {
  const { ink, cardFill, subText, accent } = getSymbolPalette(theme, active, color);
  const pins = [
    { name: "VCC", dy: -27, pinColor: "#e0453a" },
    { name: "TRIG", dy: -9, pinColor: accent },
    { name: "ECHO", dy: 9, pinColor: accent },
    { name: "GND", dy: 27, pinColor: "#23263a" },
  ] as const;

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      style={{
        opacity: dimmed ? 0.3 : 1,
        cursor: "pointer",
        transition: "opacity 150ms ease",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      {/* Module Card */}
      <rect
        x={-42}
        y={-40}
        width={92}
        height={80}
        rx={8}
        fill={cardFill}
        stroke={ink}
        strokeWidth={active ? 2.6 : 2}
      />

      {/* Transducer Cylinders (TX / RX) */}
      <circle cx={18} cy={-16} r={11} fill="none" stroke={ink} strokeWidth={1.8} />
      <circle cx={18} cy={-16} r={5} fill="none" stroke={subText} strokeWidth={1.2} />
      <circle cx={18} cy={16} r={11} fill="none" stroke={ink} strokeWidth={1.8} />
      <circle cx={18} cy={16} r={5} fill="none" stroke={subText} strokeWidth={1.2} />

      {/* Acoustic Wave Arcs on Right */}
      <path
        d="M 54 -18 A 18 18 0 0 1 54 18"
        fill="none"
        stroke={accent}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <path
        d="M 61 -25 A 26 26 0 0 1 61 25"
        fill="none"
        stroke={accent}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.75}
      />
      <path
        d="M 68 -32 A 34 34 0 0 1 68 32"
        fill="none"
        stroke={accent}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.5}
      />

      {/* Left Pins: VCC, TRIG, ECHO, GND */}
      {pins.map((p) => (
        <g key={p.name}>
          <line
            x1={-56}
            y1={p.dy}
            x2={-42}
            y2={p.dy}
            stroke={ink}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle cx={-56} cy={p.dy} r={3} fill={p.pinColor} />
          <text
            x={-36}
            y={p.dy + 3.5}
            fill={ink}
            fontSize={9}
            fontWeight={700}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {p.name}
          </text>
        </g>
      ))}

      {/* Title Above */}
      <text
        x={4}
        y={-46}
        textAnchor="middle"
        fill={ink}
        fontSize={10.5}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label} · HC-SR04
      </text>
    </g>
  );
}

// ============================================================================
// 5. POTENTIOMETER & LDR SYMBOLS (Variable Resistor with Wiper or Light Arrows)
// ============================================================================

export function PotentiometerSymbol({
  x,
  y,
  rotation = 0,
  active = false,
  dimmed = false,
  color,
  label,
  value,
  theme = "light",
  onSelect,
  onHoverChange,
}: SymbolProps): React.ReactElement {
  const { ink, cardFill, subText, accent } = getSymbolPalette(theme, active, color);

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      style={{
        opacity: dimmed ? 0.3 : 1,
        cursor: "pointer",
        transition: "opacity 150ms ease",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <rect
        x={-34}
        y={-28}
        width={74}
        height={56}
        rx={8}
        fill={cardFill}
        stroke={ink}
        strokeWidth={active ? 2.6 : 2}
      />

      {/* 3 Left Pins: 1 (VCC), 2 (WIPER), 3 (GND) */}
      <line x1={-48} y1={-16} x2={-34} y2={-16} stroke={ink} strokeWidth={2} />
      <circle cx={-48} cy={-16} r={3} fill="#e0453a" />
      <text x={-29} y={-13} fill={subText} fontSize={8.5} fontWeight={700}>
        1
      </text>

      <line x1={-48} y1={0} x2={-34} y2={0} stroke={ink} strokeWidth={2} />
      <circle cx={-48} cy={0} r={3} fill={accent} />
      <text x={-29} y={3} fill={accent} fontSize={8.5} fontWeight={700}>
        W
      </text>

      <line x1={-48} y1={16} x2={-34} y2={16} stroke={ink} strokeWidth={2} />
      <circle cx={-48} cy={16} r={3} fill="#23263a" />
      <text x={-29} y={19} fill={subText} fontSize={8.5} fontWeight={700}>
        3
      </text>

      {/* Internal IEC Resistor Track + Diagonal Wiper Arrow */}
      <rect x={-4} y={-16} width={14} height={32} rx={2} fill="none" stroke={ink} strokeWidth={1.8} />
      <line x1={-16} y1={0} x2={-4} y2={0} stroke={accent} strokeWidth={1.8} />
      <polyline points="-8,-4 -4,0 -8,4" fill="none" stroke={accent} strokeWidth={1.8} />

      <text
        x={18}
        y={4}
        fill={ink}
        fontSize={9}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {value}
      </text>

      <text
        x={2}
        y={-34}
        textAnchor="middle"
        fill={ink}
        fontSize={10.5}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label}
      </text>
    </g>
  );
}

export function LdrSymbol({
  x,
  y,
  rotation = 0,
  active = false,
  dimmed = false,
  color,
  label,
  value,
  theme = "light",
  onSelect,
  onHoverChange,
}: SymbolProps): React.ReactElement {
  const { ink, cardFill, accent } = getSymbolPalette(theme, active, color);

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      style={{
        opacity: dimmed ? 0.3 : 1,
        cursor: "pointer",
        transition: "opacity 150ms ease",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      {/* Leads */}
      <line x1={-48} y1={0} x2={-24} y2={0} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
      <line x1={24} y1={0} x2={48} y2={0} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={-48} cy={0} r={3} fill={accent} />
      <circle cx={48} cy={0} r={3} fill={accent} />

      {/* Circular Photo-Cell Envelope + IEC Resistor */}
      <circle cx={0} cy={0} r={19} fill={cardFill} stroke={ink} strokeWidth={1.8} />
      <rect x={-14} y={-6} width={28} height={12} rx={2} fill="none" stroke={ink} strokeWidth={1.8} />

      {/* Incoming Light Arrows */}
      <g stroke="#f59e0b" strokeWidth={1.8} strokeLinecap="round" fill="none">
        <line x1={-16} y1={-24} x2={-6} y2={-14} />
        <polyline points="-11,-14 -6,-14 -6,-19" />
        <line x1={-6} y1={-26} x2={4} y2={-16} />
        <polyline points="-1,-16 4,-16 4,-21" />
      </g>

      <text
        x={0}
        y={31}
        textAnchor="middle"
        fill={ink}
        fontSize={10}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label} ({value || "LDR"})
      </text>
    </g>
  );
}

// ============================================================================
// 6. SERVO (SG90), PIEZO BUZZER, I2C OLED, AND GENERIC BLOCK SYMBOLS
// ============================================================================

export function ServoSymbol({
  x,
  y,
  rotation = 0,
  active = false,
  dimmed = false,
  color,
  label,
  theme = "light",
  onSelect,
  onHoverChange,
}: SymbolProps): React.ReactElement {
  const { ink, cardFill, accent } = getSymbolPalette(theme, active, color);
  const pins = [
    { name: "PWM", dy: -18, pinColor: accent },
    { name: "VCC", dy: 0, pinColor: "#e0453a" },
    { name: "GND", dy: 18, pinColor: "#23263a" },
  ] as const;

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      style={{
        opacity: dimmed ? 0.3 : 1,
        cursor: "pointer",
        transition: "opacity 150ms ease",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <rect
        x={-42}
        y={-30}
        width={90}
        height={60}
        rx={8}
        fill={cardFill}
        stroke={ink}
        strokeWidth={active ? 2.6 : 2}
      />

      {/* Servo Horn Circle + Arm */}
      <circle cx={22} cy={0} r={14} fill="none" stroke={ink} strokeWidth={1.8} />
      <line x1={22} y1={0} x2={32} y2={-8} stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={22} cy={0} r={3} fill={ink} />

      {pins.map((p) => (
        <g key={p.name}>
          <line x1={-56} y1={p.dy} x2={-42} y2={p.dy} stroke={ink} strokeWidth={2} />
          <circle cx={-56} cy={p.dy} r={3} fill={p.pinColor} />
          <text
            x={-36}
            y={p.dy + 3.5}
            fill={ink}
            fontSize={9}
            fontWeight={700}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {p.name}
          </text>
        </g>
      ))}

      <text
        x={3}
        y={-36}
        textAnchor="middle"
        fill={ink}
        fontSize={10.5}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label} · SG90
      </text>
    </g>
  );
}

export function BuzzerSymbol({
  x,
  y,
  rotation = 0,
  active = false,
  dimmed = false,
  color,
  label,
  theme = "light",
  onSelect,
  onHoverChange,
}: SymbolProps): React.ReactElement {
  const { ink, cardFill, accent } = getSymbolPalette(theme, active, color);

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      style={{
        opacity: dimmed ? 0.3 : 1,
        cursor: "pointer",
        transition: "opacity 150ms ease",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <rect
        x={-34}
        y={-24}
        width={68}
        height={48}
        rx={24}
        fill={cardFill}
        stroke={ink}
        strokeWidth={active ? 2.6 : 2}
      />

      <line x1={-48} y1={-12} x2={-32} y2={-12} stroke={ink} strokeWidth={2} />
      <circle cx={-48} cy={-12} r={3} fill={accent} />
      <text x={-24} y={-9} fill={ink} fontSize={9.5} fontWeight={700}>
        +
      </text>

      <line x1={-48} y1={12} x2={-32} y2={12} stroke={ink} strokeWidth={2} />
      <circle cx={-48} cy={12} r={3} fill="#23263a" />
      <text x={-24} y={15} fill={ink} fontSize={9.5} fontWeight={700}>
        −
      </text>

      <circle cx={6} cy={0} r={10} fill="none" stroke={ink} strokeWidth={1.6} />
      <circle cx={6} cy={0} r={3.5} fill={accent} />

      <text
        x={0}
        y={-30}
        textAnchor="middle"
        fill={ink}
        fontSize={10.5}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label} · PIEZO
      </text>
    </g>
  );
}

export function OledSymbol({
  x,
  y,
  rotation = 0,
  active = false,
  dimmed = false,
  color,
  label,
  theme = "light",
  onSelect,
  onHoverChange,
}: SymbolProps): React.ReactElement {
  const { ink, cardFill, accent } = getSymbolPalette(theme, active, color);
  const pins = [
    { name: "VCC", dy: -27, pinColor: "#e0453a" },
    { name: "GND", dy: -9, pinColor: "#23263a" },
    { name: "SDA", dy: 9, pinColor: accent },
    { name: "SCL", dy: 27, pinColor: accent },
  ] as const;

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      style={{
        opacity: dimmed ? 0.3 : 1,
        cursor: "pointer",
        transition: "opacity 150ms ease",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <rect
        x={-42}
        y={-40}
        width={94}
        height={80}
        rx={8}
        fill={cardFill}
        stroke={ink}
        strokeWidth={active ? 2.6 : 2}
      />

      {/* OLED Screen Frame */}
      <rect
        x={-2}
        y={-24}
        width={46}
        height={48}
        rx={4}
        fill="#0f172a"
        stroke={accent}
        strokeWidth={1.4}
      />
      <text
        x={21}
        y={-4}
        textAnchor="middle"
        fill="#38bdf8"
        fontSize={8}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        I2C OLED
      </text>
      <text
        x={21}
        y={9}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={7.5}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        128×64
      </text>

      {pins.map((p) => (
        <g key={p.name}>
          <line x1={-56} y1={p.dy} x2={-42} y2={p.dy} stroke={ink} strokeWidth={2} />
          <circle cx={-56} cy={p.dy} r={3} fill={p.pinColor} />
          <text
            x={-36}
            y={p.dy + 3.5}
            fill={ink}
            fontSize={8.5}
            fontWeight={700}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {p.name}
          </text>
        </g>
      ))}

      <text
        x={5}
        y={-46}
        textAnchor="middle"
        fill={ink}
        fontSize={10.5}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label}
      </text>
    </g>
  );
}

export function GenericBlockSymbol({
  x,
  y,
  rotation = 0,
  active = false,
  dimmed = false,
  color,
  label,
  value,
  pins,
  theme = "light",
  onSelect,
  onHoverChange,
}: SymbolProps): React.ReactElement {
  const { ink, cardFill, subText, accent } = getSymbolPalette(theme, active, color);
  const localDefs = getLocalPinDefs("generic", pins);
  const isTwoLead = localDefs.length === 2 && localDefs[0]?.side === "left" && localDefs[1]?.side === "right";
  const boxHeight = isTwoLead ? 36 : Math.max(48, localDefs.length * 18 + 16);

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      style={{
        opacity: dimmed ? 0.3 : 1,
        cursor: "pointer",
        transition: "opacity 150ms ease",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <rect
        x={isTwoLead ? -32 : -42}
        y={-boxHeight / 2}
        width={isTwoLead ? 64 : 84}
        height={boxHeight}
        rx={7}
        fill={cardFill}
        stroke={ink}
        strokeWidth={active ? 2.6 : 2}
      />

      {localDefs.map((p) => {
        const edgeX = p.side === "left" ? (isTwoLead ? -32 : -42) : 32;
        return (
          <g key={p.name}>
            <line x1={p.dx} y1={p.dy} x2={edgeX} y2={p.dy} stroke={ink} strokeWidth={2} />
            <circle cx={p.dx} cy={p.dy} r={3} fill={accent} />
            <text
              x={p.side === "left" ? edgeX + 6 : edgeX - 6}
              y={p.dy + 3}
              textAnchor={p.side === "left" ? "start" : "end"}
              fill={subText}
              fontSize={8.5}
              fontWeight={700}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {p.name}
            </text>
          </g>
        );
      })}

      <text
        x={0}
        y={isTwoLead ? 4 : 0}
        textAnchor="middle"
        fill={ink}
        fontSize={9.5}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {value}
      </text>

      <text
        x={0}
        y={-boxHeight / 2 - 6}
        textAnchor="middle"
        fill={ink}
        fontSize={10.5}
        fontWeight={700}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Unified dispatcher that renders the appropriate pure SVG schematic symbol for any `SymbolKind`.
 */
export function SchematicSymbol(
  props: SymbolProps & { symbolKind: SymbolKind },
): React.ReactElement {
  switch (props.symbolKind) {
    case "resistor":
      return <ResistorSymbol {...props} />;
    case "led":
      return <LedSymbol {...props} />;
    case "button":
      return <ButtonSymbol {...props} />;
    case "hc-sr04":
      return <HcSr04Symbol {...props} />;
    case "potentiometer":
      return <PotentiometerSymbol {...props} />;
    case "ldr":
      return <LdrSymbol {...props} />;
    case "servo":
      return <ServoSymbol {...props} />;
    case "buzzer":
      return <BuzzerSymbol {...props} />;
    case "oled":
      return <OledSymbol {...props} />;
    default:
      return <GenericBlockSymbol {...props} />;
  }
}
