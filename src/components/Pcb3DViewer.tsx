/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Milestone 13: Interactive Three.js 3D PCB Viewer.
 * Features:
 * - Real-time 3D WebGL renderer with OrbitControls (pan, tilt, zoom)
 * - Interactive View-Cube orientation widget (Top, Bottom, Front, Back, Left, Right, Isometric)
 * - Individual 3D layer visibility toggles (Board, Top Cu, Bottom Cu, Vias, Pads, Components)
 * - Component hover raycaster with floating HUD
 * - Pure Scene JSON & Binary GLB CAD exports
 */

import type { Circuit } from "@s2c/circuit-json";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import type { PcbLayout } from "@s2c/pcb-json";
import {
  type PcbScene3D,
  type ThreePcbHierarchy,
  buildPcbScene3D,
  buildThreePcbGroup,
  placeCircuit,
  routeCircuit,
} from "@s2c/pcb-layout";
import {
  Box,
  Compass,
  Download,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  RefreshCw,
  Sun,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

interface Pcb3DViewerProps {
  circuit: Circuit;
  layout?: PcbLayout;
  sketchName?: string;
  theme?: "dark" | "light";
}

type ViewPreset = "iso" | "top" | "bottom" | "front" | "back" | "left" | "right";

export const Pcb3DViewer: React.FC<Pcb3DViewerProps> = ({
  circuit,
  layout: providedLayout,
  sketchName = "arduino_circuit",
  theme = "dark",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Layer Toggles
  const [showBoard, setShowBoard] = useState<boolean>(true);
  const [showTopCopper, setShowTopCopper] = useState<boolean>(true);
  const [showBottomCopper, setShowBottomCopper] = useState<boolean>(true);
  const [showVias, setShowVias] = useState<boolean>(true);
  const [showPads, setShowPads] = useState<boolean>(true);
  const [showComponents, setShowComponents] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);

  // Hover state
  const [hoveredComponent, setHoveredComponent] = useState<{
    id: string;
    kind?: string;
    x: number;
    y: number;
  } | null>(null);

  // WebGL support flag
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  // Active scene & hierarchy references
  const hierarchyRef = useRef<ThreePcbHierarchy | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const boardCenterRef = useRef<THREE.Vector3>(new THREE.Vector3(34, 27, 0));

  // Compute routed layout if not provided
  const routedLayout = useMemo(() => {
    if (providedLayout) return providedLayout;
    try {
      const placementRes = placeCircuit(circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      const routingRes = routeCircuit(placementRes.layout, circuit, { gridPitchMm: 0.635 });
      return routingRes.layout;
    } catch {
      const placementRes = placeCircuit(circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      return placementRes.layout;
    }
  }, [circuit, providedLayout]);

  // Build pure 3D Scene Model
  const scene3d: PcbScene3D = useMemo(() => {
    return buildPcbScene3D(routedLayout, circuit);
  }, [routedLayout, circuit]);

  // Camera preset handler
  const setCameraPreset = (preset: ViewPreset) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const center = boardCenterRef.current;
    const dist = 95;

    switch (preset) {
      case "iso":
        camera.position.set(center.x + 45, center.y - 60, 65);
        camera.up.set(0, 0, 1);
        break;
      case "top":
        camera.position.set(center.x, center.y, dist);
        camera.up.set(0, 1, 0);
        break;
      case "bottom":
        camera.position.set(center.x, center.y, -dist);
        camera.up.set(0, -1, 0);
        break;
      case "front":
        camera.position.set(center.x, center.y - dist, 0);
        camera.up.set(0, 0, 1);
        break;
      case "back":
        camera.position.set(center.x, center.y + dist, 0);
        camera.up.set(0, 0, 1);
        break;
      case "left":
        camera.position.set(center.x - dist, center.y, 0);
        camera.up.set(0, 0, 1);
        break;
      case "right":
        camera.position.set(center.x + dist, center.y, 0);
        camera.up.set(0, 0, 1);
        break;
    }

    controls.target.copy(center);
    controls.update();
  };

  // Three.js Mount & Render Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
      if (!gl) {
        setWebglSupported(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === "dark" ? "#070b0e" : "#f1f5f9");

    // Board center
    const center = new THREE.Vector3(
      scene3d.metadata.boardWidthMm / 2,
      scene3d.metadata.boardHeightMm / 2,
      0,
    );
    boardCenterRef.current = center;

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 1000);
    camera.position.set(center.x + 45, center.y - 65, 75);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.copy(center);
    controls.maxPolarAngle = Math.PI; // Full rotation
    controlsRef.current = controls;

    // Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLightKey = new THREE.DirectionalLight(0xfffbeb, 1.4);
    dirLightKey.position.set(center.x + 50, center.y - 70, 90);
    scene.add(dirLightKey);

    const dirLightFill = new THREE.DirectionalLight(0xe0f2fe, 0.9);
    dirLightFill.position.set(center.x - 60, center.y + 70, 70);
    scene.add(dirLightFill);

    const dirLightBottom = new THREE.DirectionalLight(0xbfdbfe, 0.8);
    dirLightBottom.position.set(center.x, center.y, -80);
    scene.add(dirLightBottom);

    // Subtle Ground Shadow/Grid Plane
    const gridHelper = new THREE.GridHelper(140, 28, 0x166534, 0x0f291e);
    gridHelper.position.set(center.x, center.y, -scene3d.metadata.thicknessMm - 0.2);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Build 3D PCB Hierarchy
    const hierarchy = buildThreePcbGroup(scene3d);
    hierarchyRef.current = hierarchy;
    scene.add(hierarchy.root);

    // Raycasting for component hover inspection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(hierarchy.componentsGroup.children, true);

      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0]!.object;
        while (obj && !obj.userData?.id) {
          obj = obj.parent;
        }
        if (obj?.userData?.id) {
          const compId = obj.userData.id.split("-")[0];
          setHoveredComponent({
            id: compId,
            kind: obj.userData.kind,
            x: e.clientX,
            y: e.clientY,
          });
          return;
        }
      }
      setHoveredComponent(null);
    };

    renderer.domElement.addEventListener("mousemove", handlePointerMove);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("mousemove", handlePointerMove);
      renderer.dispose();
      controls.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [scene3d, theme]);

  // Update Layer Visibilities
  useEffect(() => {
    const h = hierarchyRef.current;
    if (!h) return;

    h.boardGroup.visible = showBoard;
    h.tracesTopGroup.visible = showTopCopper;
    h.tracesBottomGroup.visible = showBottomCopper;
    h.viasGroup.visible = showVias;
    h.padsGroup.visible = showPads;
    h.componentsGroup.visible = showComponents;

    // Wireframe toggle
    h.root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          for (const m of mesh.material) m.wireframe = wireframe;
        } else if (mesh.material) {
          mesh.material.wireframe = wireframe;
        }
      }
    });
  }, [showBoard, showTopCopper, showBottomCopper, showVias, showPads, showComponents, wireframe]);

  // Export Scene JSON
  const handleDownloadSceneJson = () => {
    const jsonStr = JSON.stringify(scene3d, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sketchName.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_scene3d.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Binary GLB
  const handleExportGlb = () => {
    const h = hierarchyRef.current;
    if (!h) return;

    const exporter = new GLTFExporter();
    exporter.parse(
      h.root,
      (gltf) => {
        const blob = new Blob([gltf as ArrayBuffer], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${sketchName.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_pcb_model.glb`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      (err) => {
        console.error("GLB Export error:", err);
      },
      { binary: true },
    );
  };

  return (
    <div
      className="flex flex-col h-full border rounded-[2px] overflow-hidden relative"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-app)",
        color: "var(--text-main)",
      }}
    >
      {/* Top 3D Control Ribbon */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-b text-xs z-10"
        style={{
          backgroundColor: "var(--bg-subpanel)",
          borderColor: "var(--border-app)",
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold tracking-tight uppercase text-[11px] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block animate-pulse" />
            3D PCB VIEWER (M13)
          </span>

          <span
            className="px-2 py-0.5 border rounded-[2px] font-mono text-[10px]"
            style={{
              borderColor: "var(--border-strong)",
              backgroundColor: "var(--bg-sunken)",
              color: "var(--text-main)",
            }}
          >
            {scene3d.metadata.componentCount} COMPONENTS · {scene3d.metadata.traceCount} TRACES ·{" "}
            {scene3d.metadata.viaCount} VIAS
          </span>
        </div>

        {/* View-Cube Presets Toolbar */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/10 text-[10px]">
          <span className="px-1 text-slate-400 font-bold">VIEW:</span>
          {(["iso", "top", "bottom", "front", "back", "left", "right"] as ViewPreset[]).map(
            (p) => (
              <button
                key={p}
                type="button"
                onClick={() => setCameraPreset(p)}
                className="px-1.5 py-0.5 rounded hover:bg-white/20 transition uppercase font-mono font-bold"
                title={`Set camera to ${p} view`}
              >
                {p}
              </button>
            ),
          )}
        </div>

        {/* Actions: Export JSON & GLB */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSceneJson}
            className="eng-btn text-[10px]"
            title="Download pure scene-description JSON (unit-testable CAD spec)"
          >
            <Download className="w-3 h-3" />
            <span>SCENE JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportGlb}
            className="eng-btn text-[10px] font-bold text-amber-400"
            title="Export binary 3D CAD model (.glb) for Blender, KiCad, or Three.js"
          >
            <Download className="w-3 h-3" />
            <span>EXPORT GLB</span>
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Area */}
      <div className="flex-1 relative w-full h-full min-h-[500px]">
        {webglSupported ? (
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            <Box className="w-12 h-12 text-amber-400 animate-pulse" />
            <h3 className="text-base font-bold">WebGL Hardware Acceleration Unavailable</h3>
            <p className="text-xs max-w-md text-slate-400">
              The pure 3D scene description is generated and fully functional. You can inspect the
              scene metadata or download the binary GLB / Scene JSON below.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={handleDownloadSceneJson} className="eng-btn">
                Download Scene JSON
              </button>
              <button type="button" onClick={handleExportGlb} className="eng-btn font-bold">
                Export GLB Model
              </button>
            </div>
          </div>
        )}

        {/* Layer Visibility Floating Dock (Bottom Left) */}
        <div
          className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5 p-2 rounded-[2px] border text-[10px] backdrop-blur-md z-20"
          style={{
            backgroundColor: "rgba(10, 15, 20, 0.85)",
            borderColor: "var(--border-strong)",
          }}
        >
          <span className="font-bold text-slate-400 pr-1">LAYERS:</span>

          <button
            type="button"
            onClick={() => setShowBoard(!showBoard)}
            className={`px-1.5 py-0.5 border rounded-[1px] transition ${showBoard ? "border-green-500 text-green-400 bg-green-950/40" : "border-slate-700 text-slate-500"}`}
          >
            FR4 BOARD
          </button>

          <button
            type="button"
            onClick={() => setShowTopCopper(!showTopCopper)}
            className={`px-1.5 py-0.5 border rounded-[1px] transition ${showTopCopper ? "border-amber-500 text-amber-400 bg-amber-950/40" : "border-slate-700 text-slate-500"}`}
          >
            TOP CU
          </button>

          <button
            type="button"
            onClick={() => setShowBottomCopper(!showBottomCopper)}
            className={`px-1.5 py-0.5 border rounded-[1px] transition ${showBottomCopper ? "border-blue-500 text-blue-400 bg-blue-950/40" : "border-slate-700 text-slate-500"}`}
          >
            BOT CU
          </button>

          <button
            type="button"
            onClick={() => setShowVias(!showVias)}
            className={`px-1.5 py-0.5 border rounded-[1px] transition ${showVias ? "border-yellow-500 text-yellow-400 bg-yellow-950/40" : "border-slate-700 text-slate-500"}`}
          >
            VIAS
          </button>

          <button
            type="button"
            onClick={() => setShowPads(!showPads)}
            className={`px-1.5 py-0.5 border rounded-[1px] transition ${showPads ? "border-amber-400 text-amber-300 bg-amber-950/40" : "border-slate-700 text-slate-500"}`}
          >
            PADS
          </button>

          <button
            type="button"
            onClick={() => setShowComponents(!showComponents)}
            className={`px-1.5 py-0.5 border rounded-[1px] transition ${showComponents ? "border-emerald-400 text-emerald-300 bg-emerald-950/40" : "border-slate-700 text-slate-500"}`}
          >
            COMPONENTS
          </button>

          <button
            type="button"
            onClick={() => setWireframe(!wireframe)}
            className={`px-1.5 py-0.5 border rounded-[1px] transition ${wireframe ? "border-cyan-400 text-cyan-300 bg-cyan-950/40" : "border-slate-700 text-slate-500"}`}
          >
            WIREFRAME
          </button>
        </div>

        {/* Interactive 3D View-Cube Orientation Widget (Top Right) */}
        <div className="absolute top-3 right-3 z-20 pointer-events-auto">
          <div
            className="w-20 h-20 border rounded-[2px] p-1 flex flex-col items-center justify-between text-[8px] font-bold font-mono select-none backdrop-blur-md shadow-lg"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              borderColor: "rgba(59, 130, 246, 0.5)",
              color: "#93c5fd",
            }}
          >
            <div className="flex justify-between w-full">
              <button
                type="button"
                onClick={() => setCameraPreset("top")}
                className="hover:text-white"
                title="Top View"
              >
                TOP
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset("iso")}
                className="text-amber-400 hover:text-amber-200"
                title="Isometric View"
              >
                ISO
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset("bottom")}
                className="hover:text-white"
                title="Bottom View"
              >
                BOT
              </button>
            </div>

            <div className="flex justify-between w-full items-center">
              <button
                type="button"
                onClick={() => setCameraPreset("left")}
                className="hover:text-white"
                title="Left View"
              >
                L
              </button>
              <div className="w-6 h-6 rounded-full border border-blue-400/40 flex items-center justify-center text-[7px] text-blue-300 pointer-events-none">
                CAD
              </div>
              <button
                type="button"
                onClick={() => setCameraPreset("right")}
                className="hover:text-white"
                title="Right View"
              >
                R
              </button>
            </div>

            <div className="flex justify-between w-full">
              <button
                type="button"
                onClick={() => setCameraPreset("front")}
                className="hover:text-white"
                title="Front View"
              >
                FRONT
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset("back")}
                className="hover:text-white"
                title="Back View"
              >
                BACK
              </button>
            </div>
          </div>
        </div>

        {/* Hovered Component HUD */}
        {hoveredComponent && (
          <div
            className="absolute pointer-events-none px-2.5 py-1.5 border rounded-[2px] text-[10px] font-mono shadow-xl backdrop-blur-md z-30"
            style={{
              left: Math.min(hoveredComponent.x + 12, window.innerWidth - 180),
              top: hoveredComponent.y + 12,
              backgroundColor: "rgba(10, 15, 25, 0.95)",
              borderColor: "#38bdf8",
              color: "#f8fafc",
            }}
          >
            <div className="font-bold text-amber-400">{hoveredComponent.id}</div>
            <div className="text-slate-400 text-[9px] uppercase">
              {hoveredComponent.kind ?? "3D Component"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
