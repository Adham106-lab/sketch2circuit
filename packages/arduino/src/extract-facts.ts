/**
 * @license Apache-2.0
 * @s2c/arduino — Sub-steps 2 & 3: Tree-sitter C++ AST Fact Extraction (Doc §12.2).
 */

import type { Node, Tree } from "web-tree-sitter";
import { getCachedParser, getParser } from "./parser.js";
import { preprocessSketch } from "./preprocess.js";
import type { CallFact, ConstructorFact, SketchFacts, SourceRange } from "./types.js";

/**
 * Extracts facts from an Arduino sketch by traversing a Tree-sitter C++ AST.
 * If tree is not passed, parses using the cached tree-sitter parser.
 */
export function extractFacts(source: string, tree?: Tree): SketchFacts {
  const pre = preprocessSketch(source);

  const constants = new Map<string, string | number>();
  const arrays = new Map<string, (string | number)[]>();
  const calls: CallFact[] = [];
  const constructors: ConstructorFact[] = [];
  let serialEnabled = false;
  let wireEnabled = false;
  let spiEnabled = false;

  // Pre-seed defines into constants
  for (const [k, v] of pre.defines.entries()) {
    constants.set(k, v);
  }

  // Parse with Tree-sitter if tree is not provided
  let ast: Tree | null | undefined = tree;
  if (!ast) {
    const parser = getCachedParser();
    if (parser) {
      ast = parser.parse(source);
    }
  }

  if (ast) {
    // -------------------------------------------------------------
    // Real Tree-sitter AST Walker
    // -------------------------------------------------------------
    walkTree(ast.rootNode, {
      constants,
      arrays,
      calls,
      constructors,
      onSerial: () => {
        serialEnabled = true;
      },
      onWire: () => {
        wireEnabled = true;
      },
      onSpi: () => {
        spiEnabled = true;
      },
    });
  } else {
    // Fallback extraction in case parser wasm is still initializing
    extractFallbackFacts(pre.cleanedSource, {
      constants,
      arrays,
      calls,
      constructors,
      onSerial: () => {
        serialEnabled = true;
      },
      onWire: () => {
        wireEnabled = true;
      },
      onSpi: () => {
        spiEnabled = true;
      },
    });
  }

  return {
    includes: pre.includes,
    defines: pre.defines,
    constants,
    arrays,
    calls,
    constructors,
    annotations: pre.annotations,
    serialEnabled,
    wireEnabled,
    spiEnabled,
  };
}

/**
 * Asynchronous variant guaranteeing Tree-sitter C++ parser is initialized and loaded.
 */
export async function extractFactsWithTreeSitter(source: string): Promise<SketchFacts> {
  const parser = await getParser();
  const tree = parser.parse(source);
  return extractFacts(source, tree ?? undefined);
}

interface WalkerState {
  constants: Map<string, string | number>;
  arrays: Map<string, (string | number)[]>;
  calls: CallFact[];
  constructors: ConstructorFact[];
  onSerial: () => void;
  onWire: () => void;
  onSpi: () => void;
}

/**
 * Recursive tree-sitter AST visitor that walks all AST nodes.
 */
function walkTree(node: Node, state: WalkerState): void {
  const type = node.type;

  // 1. Declarations: constants, variables, arrays, object constructors
  if (type === "declaration") {
    handleDeclarationNode(node, state);
  }

  // 2. Function and method calls
  else if (type === "call_expression") {
    handleCallExpressionNode(node, state);
  }

  // Traverse children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      walkTree(child, state);
    }
  }
}

function handleDeclarationNode(node: Node, state: WalkerState): void {
  // Check for C++ object constructors: e.g. Servo myservo; or DHT dht(2, DHT11);
  const typeNode = node.childForFieldName("type") || node.child(0);
  const typeName = typeNode?.text || "";

  // Check known peripheral classes
  if (
    ["Servo", "LiquidCrystal", "LiquidCrystal_I2C", "Adafruit_NeoPixel", "DHT", "Stepper"].includes(
      typeName,
    )
  ) {
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (!child || child === typeNode) continue;

      if (child.type === "identifier") {
        // e.g. Servo myservo;
        state.constructors.push({
          className: typeName,
          instanceName: child.text,
          args: [],
          range: nodeToRange(node),
        });
      } else if (child.type === "init_declarator") {
        // e.g. LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
        const declarator = child.childForFieldName("declarator");
        const instanceName = declarator?.text || child.child(0)?.text || "";
        const argsNode = child.childForFieldName("value");
        const args: (string | number)[] = [];
        if (argsNode) {
          for (let a = 0; a < argsNode.namedChildCount; a++) {
            const argChild = argsNode.namedChild(a);
            if (argChild) args.push(cleanArg(argChild.text));
          }
        }
        state.constructors.push({
          className: typeName,
          instanceName,
          args,
          range: nodeToRange(node),
        });
      }
    }
    return;
  }

  // Check variable or array declarations
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child && child.type === "init_declarator") {
      const decl = child.childForFieldName("declarator");
      const val = child.childForFieldName("value");

      if (decl && val) {
        // Check array initializer: int leds[] = {2, 3, 4};
        if (decl.type === "array_declarator" || val.type === "initializer_list") {
          const arrName = decl.child(0)?.text || decl.text.replace(/\[.*\]/, "");
          const items: (string | number)[] = [];
          for (let idx = 0; idx < val.namedChildCount; idx++) {
            const itemNode = val.namedChild(idx);
            if (itemNode) items.push(cleanArg(itemNode.text));
          }
          state.arrays.set(arrName, items);
        } else {
          // Standard constant or variable: const int ledPin = 13;
          state.constants.set(decl.text, cleanArg(val.text));
        }
      }
    }
  }
}

function handleCallExpressionNode(node: Node, state: WalkerState): void {
  const fnNode = node.childForFieldName("function");
  const argsNode = node.childForFieldName("arguments");
  if (!fnNode || !argsNode) return;

  const args: (string | number)[] = [];
  for (let i = 0; i < argsNode.namedChildCount; i++) {
    const argChild = argsNode.namedChild(i);
    if (argChild) {
      args.push(cleanArg(argChild.text));
    }
  }

  const range = nodeToRange(node);

  // Simple function calls: pinMode(p, MODE), digitalWrite(p, v), analogRead(p), etc.
  if (fnNode.type === "identifier") {
    const fnName = fnNode.text;
    if (
      [
        "pinMode",
        "digitalWrite",
        "digitalRead",
        "analogWrite",
        "analogRead",
        "tone",
        "noTone",
        "pulseIn",
        "attachInterrupt",
      ].includes(fnName)
    ) {
      state.calls.push({
        name: fnName,
        args,
        range,
      });
    }
  }

  // Method calls: object.method(args) -> e.g. myservo.attach(9), Serial.begin(9600)
  else if (fnNode.type === "field_expression") {
    const objNode = fnNode.childForFieldName("argument");
    const methodNode = fnNode.childForFieldName("field");
    const objName = objNode?.text || "";
    const methodName = methodNode?.text || "";

    if (objName.startsWith("Serial") && methodName === "begin") {
      state.onSerial();
      state.calls.push({
        name: "Serial.begin",
        target: objName,
        args,
        range,
      });
    } else if (
      objName === "Wire" &&
      (methodName === "begin" || methodName === "beginTransmission")
    ) {
      state.onWire();
      state.calls.push({
        name: "Wire.begin",
        target: objName,
        args,
        range,
      });
    } else if (objName === "SPI" && methodName === "begin") {
      state.onSpi();
      state.calls.push({
        name: "SPI.begin",
        target: objName,
        args,
        range,
      });
    } else {
      // General library method: e.g. myservo.attach(9)
      state.calls.push({
        name: methodName,
        target: objName,
        args,
        range,
      });
    }
  }
}

function nodeToRange(node: Node): SourceRange {
  return {
    startLine: node.startPosition.row + 1,
    startCol: node.startPosition.column,
    endLine: node.endPosition.row + 1,
    endCol: node.endPosition.column,
  };
}

function cleanArg(raw: string): string | number {
  const trimmed = raw.trim();
  const n = Number(trimmed);
  return Number.isNaN(n) ? trimmed : n;
}

/**
 * Fallback parser used only if wasm binary cannot be loaded.
 */
function extractFallbackFacts(source: string, state: WalkerState): void {
  const lines = source.split(/\r?\n/);
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1;

    // Detect variables
    const varMatch = line.match(
      /(?:const\s+)?(?:unsigned\s+)?(?:int|byte|uint8_t|long|short)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]+);/,
    );
    if (varMatch) {
      state.constants.set(varMatch[1], cleanArg(varMatch[2]));
    }

    // Detect arrays
    const arrMatch = line.match(
      /(?:const\s+)?(?:unsigned\s+)?(?:int|byte|uint8_t)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*\d*\s*\]\s*=\s*\{([^}]+)\};/,
    );
    if (arrMatch) {
      const items = arrMatch[2].split(",").map((s) => cleanArg(s.trim()));
      state.arrays.set(arrMatch[1], items);
    }

    // Detect hardware calls
    const callPatterns = [
      "pinMode",
      "digitalWrite",
      "digitalRead",
      "analogWrite",
      "analogRead",
      "tone",
      "noTone",
      "pulseIn",
      "attachInterrupt",
    ];
    for (const name of callPatterns) {
      const regex = new RegExp(`${name}\\s*\\(([^)]*)\\)`, "g");
      for (const m of line.matchAll(regex)) {
        const rawArgs = m[1].split(",").map((s) => cleanArg(s.trim()));
        state.calls.push({
          name,
          args: rawArgs,
          range: {
            startLine: lineNumber,
            startCol: m.index ?? 0,
            endLine: lineNumber,
            endCol: (m.index ?? 0) + m[0].length,
          },
        });
      }
    }

    // Detect method calls: myservo.attach(9)
    const methodMatch = line.match(/([A-Za-z_][A-Za-z0-9_]*)\.(attach|begin|write)\s*\(([^)]*)\)/);
    if (methodMatch) {
      const target = methodMatch[1];
      const name = methodMatch[2];
      const rawArgs = methodMatch[3]
        .split(",")
        .map((s) => cleanArg(s.trim()))
        .filter(Boolean);
      state.calls.push({
        name,
        target,
        args: rawArgs,
        range: {
          startLine: lineNumber,
          startCol: methodMatch.index ?? 0,
          endLine: lineNumber,
          endCol: (methodMatch.index ?? 0) + methodMatch[0].length,
        },
      });
    }

    if (/Serial(?:1|2|3)?\.begin\s*\(/.test(line)) state.onSerial();
    if (/Wire\.begin\s*\(/.test(line)) state.onWire();
    if (/SPI\.begin\s*\(/.test(line)) state.onSpi();
  }
}
