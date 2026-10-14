/**
 * @license Apache-2.0
 * @s2c/export-gerber — Type definitions for Gerber RS-274X and Excellon NC drill export.
 */

export interface GerberExportMetrics {
  topCopperTraceCount: number;
  bottomCopperTraceCount: number;
  topPadCount: number;
  bottomPadCount: number;
  viaCount: number;
  drillHoleCount: number;
  toolsUsedCount: number;
  aperturesDefinedTopCopper: number;
  aperturesDefinedBottomCopper: number;
}

export interface GerberFileSet {
  boardName: string;
  topCopper: string; // .gtl
  bottomCopper: string; // .gbl
  topSilkscreen: string; // .gto
  bottomSilkscreen: string; // .gbo
  topSoldermask: string; // .gts
  bottomSoldermask: string; // .gbs
  boardOutline: string; // .gko
  drill: string; // .drl
  files: Record<string, string>;
  metrics: GerberExportMetrics;
}

export interface GerberExportOptions {
  boardName?: string;
  soldermaskExpansionMm?: number;
  silkscreenLineWidthMm?: number;
  outlineLineWidthMm?: number;
}
