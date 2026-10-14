/**
 * @license Apache-2.0
 * @s2c/export-gerber — Gerber RS-274X file generator strictly adhering to Ucamco specification.
 */

export interface GerberCircleAperture {
  kind: "circle";
  diameter: number;
}

export interface GerberRectAperture {
  kind: "rect";
  width: number;
  height: number;
}

export interface GerberObroundAperture {
  kind: "obround";
  width: number;
  height: number;
}

export type GerberAperture = GerberCircleAperture | GerberRectAperture | GerberObroundAperture;

export interface GerberFlash {
  kind: "flash";
  apertureKey: string;
  x: number;
  y: number;
}

export interface GerberLine {
  kind: "line";
  apertureKey: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GerberTrack {
  kind: "track";
  apertureKey: string;
  points: { x: number; y: number }[];
}

export type GerberPrimitive = GerberFlash | GerberLine | GerberTrack;

/**
 * Formats a coordinate in millimeters to Gerber integer format (4.6 leading-zero omitted).
 * Per Ucamco Section 4.1: %FSLAX46Y46*%
 * Multiply by 10^6 and output integer with leading zeros omitted.
 */
export function formatGerberCoord(valMm: number): string {
  const scaled = Math.round(valMm * 1e6);
  return scaled.toString();
}

/**
 * Normalizes aperture keys with 6 decimal places for deterministic hashing.
 */
export function makeCircleKey(diameterMm: number): string {
  return `C_${diameterMm.toFixed(6)}`;
}

export function makeRectKey(widthMm: number, heightMm: number): string {
  return `R_${widthMm.toFixed(6)}X${heightMm.toFixed(6)}`;
}

export function makeObroundKey(widthMm: number, heightMm: number): string {
  return `O_${widthMm.toFixed(6)}X${heightMm.toFixed(6)}`;
}

export class GerberLayerBuilder {
  private layerName: string;
  private apertures: Map<string, GerberAperture> = new Map();
  private primitives: GerberPrimitive[] = [];

  constructor(layerName: string) {
    this.layerName = layerName;
  }

  addCircleAperture(diameterMm: number): string {
    const key = makeCircleKey(diameterMm);
    if (!this.apertures.has(key)) {
      this.apertures.set(key, { kind: "circle", diameter: diameterMm });
    }
    return key;
  }

  addRectAperture(widthMm: number, heightMm: number): string {
    const key = makeRectKey(widthMm, heightMm);
    if (!this.apertures.has(key)) {
      this.apertures.set(key, { kind: "rect", width: widthMm, height: heightMm });
    }
    return key;
  }

  addObroundAperture(widthMm: number, heightMm: number): string {
    const key = makeObroundKey(widthMm, heightMm);
    if (!this.apertures.has(key)) {
      this.apertures.set(key, { kind: "obround", width: widthMm, height: heightMm });
    }
    return key;
  }

  flashPad(apertureKey: string, x: number, y: number): void {
    this.primitives.push({ kind: "flash", apertureKey, x, y });
  }

  drawLine(apertureKey: string, x1: number, y1: number, x2: number, y2: number): void {
    this.primitives.push({ kind: "line", apertureKey, x1, y1, x2, y2 });
  }

  drawTrack(apertureKey: string, points: { x: number; y: number }[]): void {
    if (points.length < 2) return;
    this.primitives.push({ kind: "track", apertureKey, points });
  }

  getApertureCount(): number {
    return this.apertures.size;
  }

  getPrimitiveCount(): number {
    return this.primitives.length;
  }

  /**
   * Generates complete, byte-deterministic Gerber RS-274X file string.
   */
  build(): string {
    const lines: string[] = [];

    // 1. Header comments
    lines.push(`G04 Layer: ${this.layerName}*`);
    lines.push(`G04 Format: RS-274X, Metric (mm), 4.6 leading-zero omitted*`);
    lines.push(`G04 Generator: @s2c/export-gerber*`);

    // 2. Mandatory Format Specification & Units (Ucamco Section 4.1 & 4.2)
    lines.push(`%FSLAX46Y46*%`);
    lines.push(`%MOMM*%`);
    lines.push(`%IPPOS*%`);

    // 3. Deterministically sort apertures and assign D-codes starting from D10
    const sortedKeys = Array.from(this.apertures.keys()).sort();
    const dCodeMap = new Map<string, number>();

    let currentD = 10;
    for (const key of sortedKeys) {
      dCodeMap.set(key, currentD);
      const ap = this.apertures.get(key);
      if (!ap) continue;
      if (ap.kind === "circle") {
        lines.push(`%ADD${currentD}C,${ap.diameter.toFixed(6)}*%`);
      } else if (ap.kind === "rect") {
        lines.push(`%ADD${currentD}R,${ap.width.toFixed(6)}X${ap.height.toFixed(6)}*%`);
      } else if (ap.kind === "obround") {
        lines.push(`%ADD${currentD}O,${ap.width.toFixed(6)}X${ap.height.toFixed(6)}*%`);
      }
      currentD++;
    }

    // 4. Linear interpolation mode default (Ucamco Section 4.6)
    lines.push(`G01*`);

    // 5. Output primitives
    let activeD: number | null = null;

    for (const prim of this.primitives) {
      const dCode = dCodeMap.get(prim.apertureKey);
      if (dCode === undefined) continue;

      if (activeD !== dCode) {
        lines.push(`D${dCode}*`);
        activeD = dCode;
      }

      if (prim.kind === "flash") {
        const xStr = formatGerberCoord(prim.x);
        const yStr = formatGerberCoord(prim.y);
        lines.push(`X${xStr}Y${yStr}D03*`);
      } else if (prim.kind === "line") {
        const x1Str = formatGerberCoord(prim.x1);
        const y1Str = formatGerberCoord(prim.y1);
        const x2Str = formatGerberCoord(prim.x2);
        const y2Str = formatGerberCoord(prim.y2);
        lines.push(`X${x1Str}Y${y1Str}D02*`);
        lines.push(`X${x2Str}Y${y2Str}D01*`);
      } else if (prim.kind === "track") {
        const pts = prim.points;
        if (pts.length < 2) continue;
        const first = pts[0];
        if (!first) continue;
        lines.push(`X${formatGerberCoord(first.x)}Y${formatGerberCoord(first.y)}D02*`);
        for (let i = 1; i < pts.length; i++) {
          const pt = pts[i];
          if (!pt) continue;
          lines.push(`X${formatGerberCoord(pt.x)}Y${formatGerberCoord(pt.y)}D01*`);
        }
      }
    }

    // 6. Mandatory End of File (Ucamco Section 4.7)
    lines.push(`M02*`);

    return `${lines.join("\n")}\n`;
  }
}
