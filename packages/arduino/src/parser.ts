/**
 * @license Apache-2.0
 * @s2c/arduino — Sub-step 2: Tree-sitter C++ AST Parser (Doc §12.2).
 */

import { Language, Parser, type Tree } from "web-tree-sitter";

let cachedParser: Parser | null = null;
let parserPromise: Promise<Parser> | null = null;

/**
 * Initializes and returns the shared web-tree-sitter C++ parser instance.
 * Loads tree-sitter-cpp.wasm once and caches the parser.
 */
export async function getParser(): Promise<Parser> {
  if (cachedParser) return cachedParser;
  if (!parserPromise) {
    parserPromise = (async () => {
      let wasmPath = "";
      if (typeof window !== "undefined") {
        // Browser environment: load from root public directory
        await Parser.init({
          locateFile(scriptName: string) {
            if (scriptName === "tree-sitter.wasm") return "/web-tree-sitter.wasm";
            return `/${scriptName}`;
          },
        });
        wasmPath = "/tree-sitter-cpp.wasm";
      } else {
        // Node.js environment: dynamic require to avoid bundling issues in browsers
        await Parser.init();
        const { createRequire } = await import("node:module");
        const require = createRequire(import.meta.url);
        wasmPath = require.resolve("tree-sitter-cpp/tree-sitter-cpp.wasm");
      }

      const CppLanguage = await Language.load(wasmPath);
      const parser = new Parser();
      parser.setLanguage(CppLanguage);
      cachedParser = parser;
      return parser;
    })();
  }
  return parserPromise;
}

export const initParser = getParser;

export function getCachedParser(): Parser | null {
  return cachedParser;
}

/**
 * Parses C++ Arduino sketch source code into a tree-sitter syntax tree.
 * Tolerates syntax errors without throwing (generates partial/error AST nodes).
 */
export async function parseSketchToTree(source: string): Promise<Tree> {
  const parser = await getParser();
  const tree = parser.parse(source);
  if (!tree) {
    throw new Error("Tree-sitter failed to parse Arduino sketch");
  }
  return tree;
}

// Eagerly kick off parser initialization in Node.js environments
if (typeof window === "undefined") {
  try {
    void getParser();
  } catch {
    // Ignored in environments where wasm cannot be loaded synchronously
  }
}
