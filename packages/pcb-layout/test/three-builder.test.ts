/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Three.js Scene Hierarchy Builder Unit Tests.
 */

import { synthesizeSketch } from "@s2c/arduino";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import fs from "fs";
import path from "path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { placeCircuit } from "../src/placer.js";
import { routeCircuit } from "../src/router.js";
import { buildPcbScene3D } from "../src/scene3d.js";
import { buildThreeNode, buildThreePcbGroup } from "../src/three-builder.js";

describe("M13 Three.js 3D Hierarchy Builder", () => {
  it("builds Three.js meshes and hierarchy for Blink circuit", () => {
    const blinkCode = `
      void setup() { pinMode(13, OUTPUT); }
      void loop() { digitalWrite(13, HIGH); }
    `;
    const syn = synthesizeSketch(blinkCode, { boardId: "ARDUINO_UNO_R3" });
    const plc = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const route = routeCircuit(plc.layout, syn.circuit);
    const scene3d = buildPcbScene3D(route.layout, syn.circuit);

    const hierarchy = buildThreePcbGroup(scene3d);

    // Root group
    expect(hierarchy.root).toBeInstanceOf(THREE.Group);
    expect(hierarchy.root.children.length).toBe(6); // 6 layers

    // Board group
    expect(hierarchy.boardGroup.children.length).toBe(1);
    const boardMesh = hierarchy.boardGroup.children[0] as THREE.Mesh;
    expect(boardMesh).toBeInstanceOf(THREE.Mesh);
    expect(boardMesh.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);

    // Traces
    expect(hierarchy.tracesTopGroup).toBeInstanceOf(THREE.Group);
    expect(hierarchy.tracesBottomGroup).toBeInstanceOf(THREE.Group);

    // Pads
    expect(hierarchy.padsGroup.children.length).toBeGreaterThan(0);

    // Vias
    expect(hierarchy.viasGroup.children.length).toBe(route.layout.vias.length * 2);

    // Components
    expect(hierarchy.componentsGroup.children.length).toBeGreaterThan(0);
    expect(hierarchy.componentMeshes.has("D1")).toBe(true);
    expect(hierarchy.componentMeshes.has("R1")).toBe(true);
  });

  it("builds complete Three.js hierarchy for user_multi_peripheral with all 16 components", () => {
    const fixturePath = path.resolve(
      __dirname,
      "../../../fixtures/sketches/user_multi_peripheral.ino",
    );
    const userCode = fs.readFileSync(fixturePath, "utf-8");
    const syn = synthesizeSketch(userCode, { boardId: "ARDUINO_UNO_R3" });
    const plc = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const route = routeCircuit(plc.layout, syn.circuit);
    const scene3d = buildPcbScene3D(route.layout, syn.circuit);

    const hierarchy = buildThreePcbGroup(scene3d);

    // All 16 components must have 3D mesh entries
    const expectedComponents = [
      "U1",
      "SW1",
      "SW2",
      "D1",
      "D2",
      "R1",
      "R2",
      "R3",
      "R4",
      "M1",
      "SPK1",
      "SERVO1",
      "POT1",
      "LDR1",
      "C_DECOUPLING",
      "C_SERVO1",
    ];

    for (const compId of expectedComponents) {
      expect(hierarchy.componentMeshes.has(compId), `Component mesh present for ${compId}`).toBe(
        true,
      );
      const meshes = hierarchy.componentMeshes.get(compId)!;
      expect(meshes.length).toBeGreaterThan(0);
    }

    // Check material properties
    const d1Meshes = hierarchy.componentMeshes.get("D1")!;
    const d1Dome = d1Meshes.find((m) => m.name.includes("Dome")) as THREE.Mesh;
    expect(d1Dome).toBeDefined();
    const d1Mat = d1Dome.material as THREE.MeshStandardMaterial;
    expect(d1Mat.transparent).toBe(true);

    // Total child objects in hierarchy
    let totalObjects = 0;
    hierarchy.root.traverse(() => {
      totalObjects++;
    });
    expect(totalObjects).toBeGreaterThan(100);
  });
});
