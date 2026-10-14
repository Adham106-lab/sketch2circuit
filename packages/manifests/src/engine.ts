/**
 * @license Apache-2.0
 * @s2c/manifests — Declarative Manifest Registry & Template Sub-Circuit Expansion Engine.
 */

import type {
  Bus,
  Circuit,
  Component,
  Net,
  Port,
  Provenance,
} from "@s2c/circuit-json";
import { ARDUINO_UNO_MANIFEST } from "./boards/arduino-uno.js";
import { ESP32_DEVKIT_V1_MANIFEST } from "./boards/esp32-devkit-v1.js";
import { ACTIVE_BUZZER_TEMPLATE } from "./templates/active-buzzer.js";
import { DS3231_TEMPLATE } from "./templates/ds3231.js";
import { SOLENOID_TEMPLATE } from "./templates/solenoid.js";
import { SSD1306_TEMPLATE } from "./templates/ssd1306.js";
import { WS2812_TEMPLATE } from "./templates/ws2812.js";
import type {
  BoardManifest,
  ComponentTemplateManifest,
  TemplateExpansionResult,
} from "./types.js";

const BOARD_REGISTRY = new Map<string, BoardManifest>([
  ["arduino-uno", ARDUINO_UNO_MANIFEST],
  ["uno", ARDUINO_UNO_MANIFEST],
  ["arduino_uno", ARDUINO_UNO_MANIFEST],
  ["arduino_uno_r3", ARDUINO_UNO_MANIFEST],
  ["esp32-devkit-v1", ESP32_DEVKIT_V1_MANIFEST],
  ["esp32", ESP32_DEVKIT_V1_MANIFEST],
  ["esp32_devkit", ESP32_DEVKIT_V1_MANIFEST],
  ["esp32-devkitc", ESP32_DEVKIT_V1_MANIFEST],
]);

const TEMPLATE_REGISTRY = new Map<string, ComponentTemplateManifest>([
  ["ds3231", DS3231_TEMPLATE],
  ["ssd1306", SSD1306_TEMPLATE],
  ["ws2812", WS2812_TEMPLATE],
  ["ws2812b", WS2812_TEMPLATE],
  ["neopixel", WS2812_TEMPLATE],
  ["activebuzzer", ACTIVE_BUZZER_TEMPLATE],
  ["active-buzzer", ACTIVE_BUZZER_TEMPLATE],
  ["buzzer", ACTIVE_BUZZER_TEMPLATE],
  ["solenoid", SOLENOID_TEMPLATE],
  ["relay", SOLENOID_TEMPLATE],
]);

/**
 * Retrieves a declarative board manifest by id or alias.
 */
export function getBoardManifest(id: string): BoardManifest | undefined {
  return BOARD_REGISTRY.get(id.toLowerCase().replace(/[\s-]+/g, "-"));
}

/**
 * Registers or overrides a board manifest.
 */
export function registerBoardManifest(manifest: BoardManifest): void {
  BOARD_REGISTRY.set(manifest.id.toLowerCase(), manifest);
}

/**
 * Retrieves a peripheral sub-circuit template manifest by id or alias.
 */
export function getComponentTemplate(id: string): ComponentTemplateManifest | undefined {
  return TEMPLATE_REGISTRY.get(id.toLowerCase().replace(/[\s_-]+/g, ""));
}

/**
 * Registers a new peripheral sub-circuit template manifest.
 */
export function registerComponentTemplate(template: ComponentTemplateManifest): void {
  TEMPLATE_REGISTRY.set(template.id.toLowerCase(), template);
}

export interface ExpandOptions {
  injectPassives?: boolean;
  mcuRef?: string;
  sourceFile?: string;
}

/**
 * Expands a declarative component template into a complete sub-circuit
 * containing the primary component and all required supporting passives
 * (e.g. decoupling capacitors, pull-up resistors, flyback diodes, gate drivers).
 */
export function expandComponentTemplate(
  templateId: string,
  instanceId: string,
  pinBindings: Record<string, string>,
  options: ExpandOptions = {},
): TemplateExpansionResult {
  const template = getComponentTemplate(templateId);
  if (!template) {
    throw new Error(`Component template manifest "${templateId}" not found in registry.`);
  }

  const injectPassives = options.injectPassives ?? true;
  const provenance: Provenance = {
    sourceFile: options.sourceFile,
    evidenceType: "TEMPLATE_AUTO_INJECTED",
    confidence: 0.95,
    notes: `Instantiated from peripheral template "${template.name}"`,
  };

  // 1. Primary component
  const primaryPorts: Port[] = template.primaryPorts.map((p) => ({
    id: `${instanceId}.${p.name}`,
    name: p.name,
    kind: p.kind,
  }));

  const primaryComponent: Component = {
    id: instanceId,
    kind: template.primaryKind,
    name: template.name,
    partNumber: template.primaryPartNumber,
    footprint: template.primaryFootprint,
    ports: primaryPorts,
    provenance,
  };

  const supportingComponents: Component[] = [];
  const generatedNets: Net[] = [];
  const netPortMap = new Map<string, string[]>();

  // Map primary ports to caller net bindings
  for (const [portName, targetNet] of Object.entries(pinBindings)) {
    const portId = `${instanceId}.${portName}`;
    const list = netPortMap.get(targetNet) ?? [];
    list.push(portId);
    netPortMap.set(targetNet, list);
  }

  // 2. Expand supporting passives if enabled
  if (injectPassives) {
    for (const passive of template.supportingPassives) {
      const passiveId = `${instanceId}_${passive.refSuffix}`;
      const passivePorts: Port[] = passive.ports.map((pt) => ({
        id: `${passiveId}.${pt.name}`,
        name: pt.name,
        kind: pt.kind,
      }));

      const passiveComp: Component = {
        id: passiveId,
        kind: passive.kind,
        name: passive.name,
        value: passive.value,
        footprint: passive.footprint,
        ports: passivePorts,
        provenance: {
          ...provenance,
          notes: `Supporting passive (${passive.role}) for ${instanceId}`,
        },
      };
      supportingComponents.push(passiveComp);

      // Wire passive connections
      for (const conn of passive.connections) {
        const localPortId = `${passiveId}.${conn.passivePort}`;
        let resolvedTargetNet: string | undefined;

        if (conn.target.startsWith("PRIMARY.")) {
          const primaryPortName = conn.target.replace("PRIMARY.", "");
          // Target net bound to this primary port
          resolvedTargetNet = pinBindings[primaryPortName] ?? `NET_${instanceId}_${primaryPortName}`;
          // Ensure primary port is in this net
          const pList = netPortMap.get(resolvedTargetNet) ?? [];
          const primaryPortId = `${instanceId}.${primaryPortName}`;
          if (!pList.includes(primaryPortId)) {
            pList.push(primaryPortId);
          }
          netPortMap.set(resolvedTargetNet, pList);
        } else if (conn.target === "RAIL_VCC") {
          resolvedTargetNet = pinBindings.VCC ?? "5V";
        } else if (conn.target === "RAIL_GND") {
          resolvedTargetNet = pinBindings.GND ?? "GND";
        } else if (conn.target.startsWith("EXTERNAL_NET.")) {
          const key = conn.target.replace("EXTERNAL_NET.", "");
          resolvedTargetNet = pinBindings[key] ?? `NET_${instanceId}_${key}`;
        } else if (conn.target.startsWith("SUPPORTING.")) {
          // Internal connection between two supporting passives
          const parts = conn.target.replace("SUPPORTING.", "").split(".");
          const subRef = parts[0];
          const subPort = parts[1];
          const targetPortId = `${instanceId}_${subRef}.${subPort}`;
          resolvedTargetNet = `NET_${instanceId}_${subRef}_${subPort}`;
          const sList = netPortMap.get(resolvedTargetNet) ?? [];
          if (!sList.includes(targetPortId)) sList.push(targetPortId);
          netPortMap.set(resolvedTargetNet, sList);
        }

        if (resolvedTargetNet) {
          const list = netPortMap.get(resolvedTargetNet) ?? [];
          if (!list.includes(localPortId)) {
            list.push(localPortId);
          }
          netPortMap.set(resolvedTargetNet, list);
        }
      }
    }
  }

  // Convert net map to Net[]
  for (const [netId, ports] of netPortMap.entries()) {
    const isGround = netId.toUpperCase() === "GND";
    const isPower = netId.toUpperCase() === "5V" || netId.toUpperCase() === "3V3" || netId.toUpperCase() === "VCC";

    generatedNets.push({
      id: netId,
      name: netId,
      kind: isGround ? "ground" : isPower ? "power" : "signal",
      voltage: isGround ? 0 : isPower ? 5.0 : undefined,
      portIds: ports,
      provenance,
    });
  }

  const allComponents = [primaryComponent, ...supportingComponents];

  return {
    primaryComponent,
    supportingComponents,
    allComponents,
    generatedNets,
  };
}

/**
 * Merges an expanded component template directly into an existing Circuit IR.
 */
export function mergeTemplateIntoCircuit(
  circuit: Circuit,
  templateId: string,
  instanceId: string,
  pinBindings: Record<string, string>,
  options: ExpandOptions = {},
): Circuit {
  const result = expandComponentTemplate(templateId, instanceId, pinBindings, options);

  const newComponents = [...circuit.components, ...result.allComponents];
  const existingNetsMap = new Map<string, Net>(circuit.nets.map((n) => [n.id, { ...n, portIds: [...n.portIds] }]));

  for (const genNet of result.generatedNets) {
    const existing = existingNetsMap.get(genNet.id);
    if (existing) {
      for (const p of genNet.portIds) {
        if (!existing.portIds.includes(p)) {
          existing.portIds.push(p);
        }
      }
    } else {
      existingNetsMap.set(genNet.id, genNet);
    }
  }

  return {
    ...circuit,
    components: newComponents,
    nets: Array.from(existingNetsMap.values()),
  };
}
