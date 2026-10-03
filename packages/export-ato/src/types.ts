/**
 * @license Apache-2.0
 * @s2c/export-ato — Atopile (.ato) Exporter Types (Doc §15).
 */

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
