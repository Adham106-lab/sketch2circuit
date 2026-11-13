/**
 * @license Apache-2.0
 * @s2c/export-ato — Atopile (.ato) Exporter Types (Doc §15).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";

export interface AtoExportOptions {
  /**
   * Name of top-level module in generated .ato file (default: sanitized circuit title or "SynthesizedCircuit").
   */
  moduleName?: string;

  /**
   * Whether to declare custom/header component definitions at top of file (default: true).
   */
  includeComponentDefinitions?: boolean;

  /**
   * Whether to include circuit provenance docstrings (default: true).
   */
  includeDocstrings?: boolean;

  /**
   * Fixed timestamp string for deterministic byte-identical export across runs.
   */
  timestamp?: string;
}

export interface AtoParseOptions {
  boardId?: string;
  boardRef?: string;
  sourceFile?: string;
  timestamp?: string;
}

export interface AtoParseResult {
  valid: boolean;
  circuit: Circuit;
  diagnostics: Diagnostic[];
  moduleName: string;
}

export interface AtoPartReference {
  componentType: string;
  isStdLib: boolean;
  mpn?: string;
  manufacturer?: string;
  lcscId?: string;
  verified: boolean;
  valueConstraint?: string;
  packageHint?: string;
  comment?: string;
  portMap: Record<string, string>;
}
