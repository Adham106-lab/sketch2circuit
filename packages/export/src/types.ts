/**
 * @license Apache-2.0
 * @s2c/export — Exporter Types (Doc §12.9 & §13).
 */

export interface WiringRow {
  /** Source pin or MCU pin (e.g. "U1.D13" or "D13") */
  fromPort: string;
  /** Destination port on peripheral/passive (e.g. "R1.1") */
  toPort: string;
  /** Destination component reference designator (e.g. "R1", "D1") */
  componentRef: string;
  /** Peripheral kind (e.g. "LED", "Resistor", "Servo") */
  componentKind: string;
  /** Physical terminal name/number (e.g. "1", "A", "PWM") */
  terminal: string;
  /** Connected electrical net identifier (e.g. "N$1", "GND", "5V") */
  netId: string;
  /** Human-readable explanation or wiring direction */
  notes?: string;
}

export interface BomRow {
  /** Line item number */
  item: number;
  /** Quantity of this component */
  quantity: number;
  /** Reference designators, comma-separated (e.g. "R1, R2") */
  designators: string;
  /** Component nominal value or color (e.g. "330Ω", "Red", "10kΩ") */
  value: string;
  /** Part number (e.g. "RES-330", "SG90", "HC-SR04") */
  partNumber: string;
  /** Human-readable description */
  description: string;
  /** Physical footprint or package (e.g. "R_Axial_DIN0207", "LED_5mm") */
  footprint?: string;
}
