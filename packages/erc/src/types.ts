/**
 * @license Apache-2.0
 * @s2c/erc — Electrical Rule Check (ERC) Pass Types.
 */

import type {
  Circuit,
  Diagnostic,
  DiagnosticTarget,
  SourceRange,
} from "@s2c/circuit-json";
import type { BoardManifest } from "@s2c/manifests";

export type ErcSeverity = "error" | "warning" | "info";

export interface ErcDiagnostic extends Diagnostic {
  ruleId: string;
  severity: ErcSeverity;
  message: string;
  explanation: string;
  target: DiagnosticTarget;
  suggestion?: string;
  sourceRange?: SourceRange;
}

export interface ErcContext {
  board?: BoardManifest;
  circuit: Circuit;
  strict?: boolean;
}

export interface ErcRule {
  id: string;
  name: string;
  description: string;
  run: (circuit: Circuit, context: ErcContext) => ErcDiagnostic[];
}

export interface ErcPassOptions {
  boardId?: string;
  boardManifest?: BoardManifest;
  strict?: boolean;
  autoInjectI2CPullups?: boolean;
  pullupValue?: string;
}

export interface ErcPassResult {
  diagnostics: ErcDiagnostic[];
  errors: ErcDiagnostic[];
  warnings: ErcDiagnostic[];
  infos: ErcDiagnostic[];
  circuit: Circuit;
  injectedComponentsCount: number;
}
