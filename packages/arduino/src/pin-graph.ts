/**
 * @license Apache-2.0
 * @s2c/arduino — Sub-step 5: Pin Usage Graph Construction (Doc §12.4).
 */

import { resolveMode, resolvePin } from "./resolve.js";
import type { PinUse, SketchFacts, SourceRange, UnresolvedItem } from "./types.js";

export interface PinGraphResult {
  pinGraph: Map<string, PinUse>;
  unresolved: UnresolvedItem[];
}

/**
 * Builds the Pin Usage Graph from extracted sketch facts and collects any unresolved items.
 */
export function buildPinUsageGraph(
  facts: SketchFacts,
  unresolvedOut?: UnresolvedItem[],
): Map<string, PinUse> {
  const pinMap = new Map<string, PinUse>();

  const getOrCreatePin = (pinId: string, pinNum: number, nameHint?: string): PinUse => {
    let pinUse = pinMap.get(pinId);
    if (!pinUse) {
      pinUse = {
        pin: pinId,
        pinNumber: pinNum,
        modes: new Set(),
        ops: new Set(),
        nameHints: [],
        ranges: [],
      };
      pinMap.set(pinId, pinUse);
    }
    if (nameHint && !pinUse.nameHints.includes(nameHint)) {
      pinUse.nameHints.push(nameHint);
    }
    return pinUse;
  };

  const recordUnresolved = (
    rawPin: string | number | undefined,
    opName: string,
    range: SourceRange,
  ) => {
    if (unresolvedOut && rawPin !== undefined) {
      unresolvedOut.push({
        expression: String(rawPin),
        reason: `Runtime-computed pin '${rawPin}' in ${opName}() at line ${range.startLine} cannot be resolved statically; skipping guess per Doc §12.3`,
        range,
      });
    }
  };

  // 1. Process function calls
  for (const call of facts.calls) {
    if (call.name === "pinMode") {
      const [rawPin, rawMode] = call.args;
      const resolved = resolvePin(rawPin, facts);
      if (resolved) {
        const pinUse = getOrCreatePin(resolved.pinId, resolved.pinNumber, resolved.nameHint);
        const mode = resolveMode(rawMode, facts);
        pinUse.modes.add(mode);
        pinUse.ranges.push(call.range);
      } else {
        recordUnresolved(rawPin, "pinMode", call.range);
      }
    } else if (call.name === "digitalWrite") {
      const [rawPin] = call.args;
      const resolved = resolvePin(rawPin, facts);
      if (resolved) {
        const pinUse = getOrCreatePin(resolved.pinId, resolved.pinNumber, resolved.nameHint);
        pinUse.ops.add("digitalWrite");
        pinUse.ranges.push(call.range);
      } else {
        recordUnresolved(rawPin, "digitalWrite", call.range);
      }
    } else if (call.name === "digitalRead") {
      const [rawPin] = call.args;
      const resolved = resolvePin(rawPin, facts);
      if (resolved) {
        const pinUse = getOrCreatePin(resolved.pinId, resolved.pinNumber, resolved.nameHint);
        pinUse.ops.add("digitalRead");
        pinUse.ranges.push(call.range);
      } else {
        recordUnresolved(rawPin, "digitalRead", call.range);
      }
    } else if (call.name === "analogWrite") {
      const [rawPin] = call.args;
      const resolved = resolvePin(rawPin, facts);
      if (resolved) {
        const pinUse = getOrCreatePin(resolved.pinId, resolved.pinNumber, resolved.nameHint);
        pinUse.ops.add("analogWrite");
        pinUse.ranges.push(call.range);
      } else {
        recordUnresolved(rawPin, "analogWrite", call.range);
      }
    } else if (call.name === "analogRead") {
      const [rawPin] = call.args;
      const resolved = resolvePin(rawPin, facts);
      if (resolved) {
        const pinUse = getOrCreatePin(resolved.pinId, resolved.pinNumber, resolved.nameHint);
        pinUse.ops.add("analogRead");
        pinUse.ranges.push(call.range);
      } else {
        recordUnresolved(rawPin, "analogRead", call.range);
      }
    } else if (call.name === "tone" || call.name === "noTone") {
      const [rawPin] = call.args;
      const resolved = resolvePin(rawPin, facts);
      if (resolved) {
        const pinUse = getOrCreatePin(resolved.pinId, resolved.pinNumber, resolved.nameHint);
        pinUse.ops.add("tone");
        pinUse.ranges.push(call.range);
      } else {
        recordUnresolved(rawPin, call.name, call.range);
      }
    } else if (call.name === "pulseIn") {
      const [rawPin] = call.args;
      const resolved = resolvePin(rawPin, facts);
      if (resolved) {
        const pinUse = getOrCreatePin(resolved.pinId, resolved.pinNumber, resolved.nameHint);
        pinUse.ops.add("pulseIn");
        pinUse.ranges.push(call.range);
      } else {
        recordUnresolved(rawPin, "pulseIn", call.range);
      }
    } else if (call.name === "attachInterrupt") {
      const [rawPin] = call.args;
      const resolved = resolvePin(rawPin, facts);
      if (resolved) {
        const pinUse = getOrCreatePin(resolved.pinId, resolved.pinNumber, resolved.nameHint);
        pinUse.ops.add("interrupt");
        pinUse.ranges.push(call.range);
      } else {
        recordUnresolved(rawPin, "attachInterrupt", call.range);
      }
    } else if (call.name === "attach" && call.target) {
      // e.g. myservo.attach(9)
      const [rawPin] = call.args;
      const resolved = resolvePin(rawPin, facts);
      if (resolved) {
        const pinUse = getOrCreatePin(resolved.pinId, resolved.pinNumber, call.target);
        pinUse.ops.add("library");
        pinUse.ranges.push(call.range);
      } else {
        recordUnresolved(rawPin, "Servo.attach", call.range);
      }
    }
  }

  // 2. Process constructors (e.g. LiquidCrystal lcd(12, 11, 5, 4, 3, 2))
  for (const ctor of facts.constructors) {
    if (ctor.className === "LiquidCrystal") {
      for (const arg of ctor.args) {
        const resolved = resolvePin(arg, facts);
        if (resolved) {
          const pinUse = getOrCreatePin(resolved.pinId, resolved.pinNumber, ctor.instanceName);
          pinUse.ops.add("library");
          pinUse.ranges.push(ctor.range);
        } else {
          recordUnresolved(arg, "LiquidCrystal", ctor.range);
        }
      }
    }
  }

  return pinMap;
}
