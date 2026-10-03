/**
 * @license Apache-2.0
 * @s2c/block-diagram — Data model and Zod validation schemas for Block Diagrams.
 */

import { z } from "zod";

export const PortDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  required: z.boolean().default(true),
  description: z.string().optional(),
});

export type PortDefinition = z.infer<typeof PortDefinitionSchema>;

export const BlockNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string().optional(),
  params: z.record(z.unknown()).default({}),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

export type BlockNode = z.infer<typeof BlockNodeSchema>;

export const BlockConnectionSchema = z.object({
  id: z.string(),
  fromBlockId: z.string(),
  fromPortId: z.string().default("out"),
  toBlockId: z.string(),
  toPortId: z.string().default("in"),
});

export type BlockConnection = z.infer<typeof BlockConnectionSchema>;

export const BlockDiagramSchema = z.object({
  blocks: z.array(BlockNodeSchema),
  connections: z.array(BlockConnectionSchema),
});

export type BlockDiagram = z.infer<typeof BlockDiagramSchema>;
