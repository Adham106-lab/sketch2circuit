/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Three.js Mesh and Scene Graph Builder.
 * Converts pure PcbScene3D descriptions into interactive Three.js 3D objects.
 */

import * as THREE from "three";
import type { PcbScene3D, Scene3DNode } from "./scene3d.js";

export interface ThreePcbHierarchy {
  root: THREE.Group;
  boardGroup: THREE.Group;
  tracesTopGroup: THREE.Group;
  tracesBottomGroup: THREE.Group;
  viasGroup: THREE.Group;
  padsGroup: THREE.Group;
  componentsGroup: THREE.Group;
  componentMeshes: Map<string, THREE.Object3D[]>;
}

/**
 * Creates a Three.js material from a Scene3DNode material definition.
 */
export function createThreeMaterial(mat: Scene3DNode["material"]): THREE.MeshStandardMaterial {
  const threeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(mat.color),
    roughness: mat.roughness ?? 0.4,
    metalness: mat.metalness ?? 0.1,
    transparent: mat.transparent ?? false,
    opacity: mat.opacity ?? 1.0,
    wireframe: mat.wireframe ?? false,
  });

  if (mat.emissive) {
    threeMat.emissive = new THREE.Color(mat.emissive);
    threeMat.emissiveIntensity = 0.3;
  }

  return threeMat;
}

/**
 * Converts a Scene3DNode into a Three.js Mesh or Group.
 */
export function buildThreeNode(node: Scene3DNode): THREE.Object3D {
  let obj: THREE.Object3D;

  if (!node.geometry) {
    obj = new THREE.Group();
  } else {
    const geom = node.geometry;
    let threeGeom: THREE.BufferGeometry;

    switch (geom.kind) {
      case "box":
        threeGeom = new THREE.BoxGeometry(geom.width, geom.depth, geom.height);
        break;

      case "cylinder":
        threeGeom = new THREE.CylinderGeometry(
          geom.radiusTop,
          geom.radiusBottom,
          geom.height,
          geom.radialSegments ?? 20,
        );
        break;

      case "sphere":
        threeGeom = new THREE.SphereGeometry(geom.radius, 16, 16);
        break;

      case "extruded-polygon": {
        const shape = new THREE.Shape();
        const poly = geom.polygon;
        if (poly.length > 0) {
          shape.moveTo(poly[0]!.x, poly[0]!.y);
          for (let i = 1; i < poly.length; i++) {
            shape.lineTo(poly[i]!.x, poly[i]!.y);
          }
          shape.closePath();
        }

        // Mounting holes
        for (const hole of geom.holes ?? []) {
          const holePath = new THREE.Path();
          holePath.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true);
          shape.holes.push(holePath);
        }

        threeGeom = new THREE.ExtrudeGeometry(shape, {
          depth: geom.depth,
          bevelEnabled: false,
        });
        break;
      }

      case "tube": {
        // Build connected line/cylinder segments with joint spheres for smooth realistic copper tracks
        const group = new THREE.Group();
        const pts = geom.path;
        const rad = Math.max(0.12, geom.radius);
        const mat = createThreeMaterial(node.material);

        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i]!;
          const p2 = pts[i + 1]!;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          if (len < 0.001) continue;

          // Segment cylinder
          const cylGeom = new THREE.CylinderGeometry(rad, rad, len, 12);
          const cylMesh = new THREE.Mesh(cylGeom, mat);
          cylMesh.position.set((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 0);

          // Rotate cylinder from default Y-axis orientation to segment direction
          const angle = Math.atan2(dy, dx);
          cylMesh.rotation.z = angle - Math.PI / 2;
          group.add(cylMesh);

          // Joint sphere
          const sphereGeom = new THREE.SphereGeometry(rad, 10, 10);
          const sphereMesh = new THREE.Mesh(sphereGeom, mat);
          sphereMesh.position.set(p1.x, p1.y, 0);
          group.add(sphereMesh);
        }

        if (pts.length > 0) {
          const lastPt = pts[pts.length - 1]!;
          const sphereGeom = new THREE.SphereGeometry(rad, 10, 10);
          const sphereMesh = new THREE.Mesh(sphereGeom, mat);
          sphereMesh.position.set(lastPt.x, lastPt.y, 0);
          group.add(sphereMesh);
        }

        obj = group;
        break;
      }

      default:
        threeGeom = new THREE.BoxGeometry(1, 1, 1);
        break;
    }

    if (geom.kind !== "tube") {
      const mat = createThreeMaterial(node.material);
      obj = new THREE.Mesh(threeGeom!, mat);
    }
  }

  // Set position, rotation, scale
  obj!.position.set(node.position.x, node.position.y, node.position.z);
  obj!.rotation.set(node.rotation.x, node.rotation.y, node.rotation.z);
  if (node.scale) {
    obj!.scale.set(node.scale.x, node.scale.y, node.scale.z);
  }

  obj!.name = node.name;
  obj!.userData = {
    id: node.id,
    kind: node.kind,
    metadata: node.metadata,
  };

  // Add child nodes
  if (node.children) {
    for (const child of node.children) {
      obj!.add(buildThreeNode(child));
    }
  }

  return obj!;
}

/**
 * Builds the complete structured Three.js hierarchy for a PcbScene3D.
 */
export function buildThreePcbGroup(scene: PcbScene3D): ThreePcbHierarchy {
  const root = new THREE.Group();
  root.name = "PCB_3D_ROOT";

  const boardGroup = new THREE.Group();
  boardGroup.name = "LAYER_BOARD_SUBSTRATE";

  const tracesTopGroup = new THREE.Group();
  tracesTopGroup.name = "LAYER_TRACES_TOP";

  const tracesBottomGroup = new THREE.Group();
  tracesBottomGroup.name = "LAYER_TRACES_BOTTOM";

  const viasGroup = new THREE.Group();
  viasGroup.name = "LAYER_VIAS";

  const padsGroup = new THREE.Group();
  padsGroup.name = "LAYER_PADS";

  const componentsGroup = new THREE.Group();
  componentsGroup.name = "LAYER_COMPONENTS";

  const componentMeshes = new Map<string, THREE.Object3D[]>();

  // 1. Board Slab
  boardGroup.add(buildThreeNode(scene.board));

  // 2. Copper Traces (segregated by top / bottom)
  for (const traceNode of scene.traces) {
    const threeTrace = buildThreeNode(traceNode);
    if (traceNode.metadata?.layer === "bottom") {
      tracesBottomGroup.add(threeTrace);
    } else {
      tracesTopGroup.add(threeTrace);
    }
  }

  // 3. Vias
  for (const viaNode of scene.vias) {
    viasGroup.add(buildThreeNode(viaNode));
  }

  // 4. Pads
  for (const padNode of scene.pads) {
    padsGroup.add(buildThreeNode(padNode));
  }

  // 5. Component Bodies
  for (const compNode of scene.components) {
    const threeComp = buildThreeNode(compNode);
    componentsGroup.add(threeComp);

    // Group by component ID prefix (e.g. "D1-dome" -> "D1")
    const dashIdx = compNode.id.indexOf("-");
    const compId = dashIdx !== -1 ? compNode.id.substring(0, dashIdx) : compNode.id;
    const existing = componentMeshes.get(compId) ?? [];
    existing.push(threeComp);
    componentMeshes.set(compId, existing);
  }

  root.add(boardGroup);
  root.add(tracesTopGroup);
  root.add(tracesBottomGroup);
  root.add(viasGroup);
  root.add(padsGroup);
  root.add(componentsGroup);

  return {
    root,
    boardGroup,
    tracesTopGroup,
    tracesBottomGroup,
    viasGroup,
    padsGroup,
    componentsGroup,
    componentMeshes,
  };
}
