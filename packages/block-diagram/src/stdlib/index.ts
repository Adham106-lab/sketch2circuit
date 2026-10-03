/**
 * @license Apache-2.0
 * @s2c/block-diagram — Standard Library Block Registration.
 */

import { registerBlock } from "../blocks.js";
import { PidControllerBlock } from "./composite.js";
import { DelayBlock, IntegratorBlock, TransferFunctionBlock } from "./dynamics.js";
import { AbsBlock, GainBlock, ProductBlock, SaturationBlock, SumBlock } from "./math.js";
import { ScopeBlock } from "./sink.js";
import { ConstantBlock, RampBlock, SineBlock, StepBlock } from "./sources.js";

export function registerAllStdlibBlocks(): void {
  // Sources
  registerBlock(ConstantBlock);
  registerBlock(StepBlock);
  registerBlock(RampBlock);
  registerBlock(SineBlock);

  // Math
  registerBlock(GainBlock);
  registerBlock(SumBlock);
  registerBlock(ProductBlock);
  registerBlock(SaturationBlock);
  registerBlock(AbsBlock);

  // Dynamics
  registerBlock(IntegratorBlock);
  registerBlock(TransferFunctionBlock);
  registerBlock(DelayBlock);

  // Composite
  registerBlock(PidControllerBlock);

  // Sinks
  registerBlock(ScopeBlock);
}

// Auto-register stdlib blocks upon import
registerAllStdlibBlocks();

export {
  AbsBlock,
  ConstantBlock,
  DelayBlock,
  GainBlock,
  IntegratorBlock,
  PidControllerBlock,
  ProductBlock,
  RampBlock,
  SaturationBlock,
  ScopeBlock,
  SineBlock,
  StepBlock,
  SumBlock,
  TransferFunctionBlock,
};
