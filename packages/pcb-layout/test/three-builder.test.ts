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
import { buildPcbScene3D, eiaColorBands, parseResistanceOhms } from "../src/scene3d.js";
import {
  applyResistorColorBands,
  buildThreeNode,
  buildThreePcbGroup,
  disposeThreeHierarchy,
} from "../src/three-builder.js";

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

  it("builds smooth CatmullRom TubeGeometry splines and Dupont boots for jumper wires", () => {
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

    const servoMeshes = hierarchy.componentMeshes.get("SERVO1")!;
    expect(servoMeshes).toBeDefined();

    // Find the wire spline group
    const wireGroups = servoMeshes.filter(
      (m) => m instanceof THREE.Group && m.name.includes("Servo Harness"),
    );
    expect(wireGroups.length).toBeGreaterThan(0);

    for (const wg of wireGroups) {
      // 1. Spline mesh with TubeGeometry
      const splineMesh = wg.children.find(
        (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.TubeGeometry,
      ) as THREE.Mesh;
      expect(splineMesh, "Wire has TubeGeometry spline mesh").toBeDefined();

      // 2. Black rectangular Dupont connector boots at the endpoints
      const boots = wg.children.filter(
        (c) =>
          c instanceof THREE.Mesh &&
          c.geometry instanceof THREE.BoxGeometry &&
          c.name.includes("Dupont Boot"),
      );
      expect(boots.length, "Has start and end Dupont connector boots").toBe(2);

      for (const boot of boots) {
        const mat = (boot as THREE.Mesh).material as THREE.MeshStandardMaterial;
        expect(mat.color.getHexString()).toBe("111827");
        const geom = (boot as THREE.Mesh).geometry as THREE.BoxGeometry;
        expect(geom.parameters.width).toBeCloseTo(2.54, 1);
        expect(geom.parameters.height).toBeCloseTo(2.54, 1);
        expect(geom.parameters.depth).toBeGreaterThan(5);
      }
    }
  });

  it("correctly parses resistance strings and maps to 4-band EIA color codes with 10k fallback", () => {
    // 1. 220 and 220R (Red, Red, Brown, Gold)
    expect(parseResistanceOhms("220")).toBe(220);
    expect(parseResistanceOhms("220R")).toBe(220);
    expect(eiaColorBands("220")).toEqual(["#dc2626", "#dc2626", "#78350f", "#eab308"]);
    expect(eiaColorBands("220R")).toEqual(["#dc2626", "#dc2626", "#78350f", "#eab308"]);

    // 2. 1k (Brown, Black, Red, Gold)
    expect(parseResistanceOhms("1k")).toBe(1000);
    expect(eiaColorBands("1k")).toEqual(["#78350f", "#111827", "#dc2626", "#eab308"]);

    // 3. 4.7k (Yellow, Violet, Red, Gold)
    expect(parseResistanceOhms("4.7k")).toBe(4700);
    expect(eiaColorBands("4.7k")).toEqual(["#eab308", "#9333ea", "#dc2626", "#eab308"]);

    // 4. 10k (Brown, Black, Orange, Gold)
    expect(parseResistanceOhms("10k")).toBe(10000);
    expect(eiaColorBands("10k")).toEqual(["#78350f", "#111827", "#ea580c", "#eab308"]);

    // 5. 1M (Brown, Black, Green, Gold)
    expect(parseResistanceOhms("1M")).toBe(1000000);
    expect(eiaColorBands("1M")).toEqual(["#78350f", "#111827", "#16a34a", "#eab308"]);

    // 6. Graceful fallback to 10k (Brown, Black, Orange, Gold) on unparseable / missing values
    expect(parseResistanceOhms("unparseable")).toBe(10000);
    expect(parseResistanceOhms(undefined)).toBe(10000);
    expect(parseResistanceOhms("")).toBe(10000);
    expect(eiaColorBands("invalid-res")).toEqual(["#78350f", "#111827", "#ea580c", "#eab308"]);
    expect(eiaColorBands(undefined)).toEqual(["#78350f", "#111827", "#ea580c", "#eab308"]);
  });

  it("dynamically updates axial resistor color bands via applyResistorColorBands", () => {
    const blinkCode = `
      void setup() { pinMode(13, OUTPUT); }
      void loop() { digitalWrite(13, HIGH); }
    `;
    const syn = synthesizeSketch(blinkCode, { boardId: "ARDUINO_UNO_R3" });
    const plc = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const route = routeCircuit(plc.layout, syn.circuit);
    const scene3d = buildPcbScene3D(route.layout, syn.circuit);
    const hierarchy = buildThreePcbGroup(scene3d);

    const rMeshes = hierarchy.componentMeshes.get("R1");
    expect(rMeshes).toBeDefined();

    // Dynamically update R1 to 1M (Brown-Black-Green-Gold)
    applyResistorColorBands(rMeshes!, "1M");

    const band0Mesh = rMeshes!.find((m) => m.name.includes("Band 1")) as THREE.Mesh;
    const band1Mesh = rMeshes!.find((m) => m.name.includes("Band 2")) as THREE.Mesh;
    const band2Mesh = rMeshes!.find((m) => m.name.includes("Band 3")) as THREE.Mesh;
    const band3Mesh = rMeshes!.find((m) => m.name.includes("Band 4")) as THREE.Mesh;

    expect((band0Mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("78350f"); // Brown
    expect((band1Mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("111827"); // Black
    expect((band2Mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("16a34a"); // Green
    expect((band3Mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("eab308"); // Gold
  });

  it("safely cleans up all Three.js geometries and materials via disposeThreeHierarchy", () => {
    const blinkCode = `
      void setup() { pinMode(13, OUTPUT); }
      void loop() { digitalWrite(13, HIGH); }
    `;
    const syn = synthesizeSketch(blinkCode, { boardId: "ARDUINO_UNO_R3" });
    const plc = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const route = routeCircuit(plc.layout, syn.circuit);
    const scene3d = buildPcbScene3D(route.layout, syn.circuit);
    const hierarchy = buildThreePcbGroup(scene3d);

    let disposedGeometries = 0;
    let disposedMaterials = 0;

    hierarchy.root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        const origDispose = mesh.geometry.dispose.bind(mesh.geometry);
        mesh.geometry.dispose = () => {
          disposedGeometries++;
          origDispose();
        };
      }
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const origMatDispose = m.dispose.bind(m);
          m.dispose = () => {
            disposedMaterials++;
            origMatDispose();
          };
        }
      }
    });

    disposeThreeHierarchy(hierarchy);

    expect(disposedGeometries).toBeGreaterThan(10);
    expect(disposedMaterials).toBeGreaterThan(10);
    expect(hierarchy.componentMeshes.size).toBe(0);
  });
});
