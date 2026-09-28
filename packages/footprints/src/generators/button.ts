/**
 * @license Apache-2.0
 * @s2c/footprints — 6x6mm Tactile Switch Footprint Generator.
 */

import type { FootprintDef } from "@s2c/pcb-json";

export interface TactileButtonOptions {
  id?: string;
  name?: string;
  xPitchMm?: number;
  yPitchMm?: number;
  bodySizeMm?: number;
  leadDrillMm?: number;
  padDiameterMm?: number;
}

export function generateTactileButtonFootprint(options?: TactileButtonOptions): FootprintDef {
  const xPitch = options?.xPitchMm ?? 6.5; // Omron B3F terminal row spacing across body
  const yPitch = options?.yPitchMm ?? 4.5; // Omron B3F terminal pitch along sides
  const bodySize = options?.bodySizeMm ?? 6.0;
  const drill = options?.leadDrillMm ?? 1.1;
  const padDia = options?.padDiameterMm ?? 2.0;
  const hx = xPitch / 2;
  const hy = yPitch / 2;
  const id = options?.id ?? "button:tact-6mm";

  const isStd6x6 = Math.abs(xPitch - 6.5) < 0.01 && Math.abs(yPitch - 4.5) < 0.01;
  const source = isStd6x6
    ? "KiCad Official Library: Button_Switch_THT.pretty/SW_PUSH_6mm.kicad_mod (commit 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd)"
    : "Tactile switch (unverified geometry)";
  const verification = isStd6x6 ? "cross-checked-kicad-lib" : "unverified";

  return {
    id,
    name: options?.name ?? "Tactile Switch 6x6mm (Omron B3F-1000)",
    source,
    verification,
    verified: isStd6x6,
    pads: [
      {
        number: "1",
        shape: "circle",
        x: -hx,
        y: -hy,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
      {
        number: "1",
        shape: "circle",
        x: hx,
        y: -hy,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
      {
        number: "2",
        shape: "circle",
        x: -hx,
        y: hy,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
      {
        number: "2",
        shape: "circle",
        x: hx,
        y: hy,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
    ],
    courtyard: [
      { x: -(hx + padDia / 2 + 0.5), y: -(hy + padDia / 2 + 0.5) },
      { x: hx + padDia / 2 + 0.5, y: -(hy + padDia / 2 + 0.5) },
      { x: hx + padDia / 2 + 0.5, y: hy + padDia / 2 + 0.5 },
      { x: -(hx + padDia / 2 + 0.5), y: hy + padDia / 2 + 0.5 },
    ],
    silk: [
      // 6x6 square outer housing
      {
        kind: "rect",
        x: -bodySize / 2,
        y: -bodySize / 2,
        w: bodySize,
        h: bodySize,
        strokeWidth: 0.15,
        layer: "top",
      },
      // Actuator button circle in center
      {
        kind: "circle",
        cx: 0,
        cy: 0,
        r: 1.75,
        strokeWidth: 0.15,
        layer: "top",
      },
    ],
    body3d: {
      kind: "composite",
      parts: [
        {
          kind: "box",
          w: bodySize,
          d: bodySize,
          h: 3.5,
          color: "#1e293b",
        },
        {
          kind: "cylinder",
          r: 1.75,
          h: 4.5,
          z: 3.5,
          color: "#f59e0b",
        },
      ],
    },
  };
}
