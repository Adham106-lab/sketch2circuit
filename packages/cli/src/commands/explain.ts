/**
 * @license Apache-2.0
 * @s2c/cli — `s2c explain <ruleId>` Command (Doc §13).
 */

import { ALL_ERC_RULES, getRule } from "@s2c/rules";

export interface ExplainOptions {
  json?: boolean;
}

interface RuleDoc {
  rationale: string;
  remediation: string;
  mathFormula?: string;
  standardReference?: string;
}

const RULE_DOCS: Record<string, RuleDoc> = {
  "erc.floating-input": {
    rationale:
      "High-impedance CMOS/TTL input pins without pull-up or pull-down pick up ambient electromagnetic interference, oscillating rapidly and wasting power or reading erratic false triggers.",
    remediation:
      "Enable internal pull-up (pinMode(pin, INPUT_PULLUP)), add an external 10kΩ pull-up or pull-down resistor, or connect directly to an active push-pull output driver.",
    standardReference: "TI App Note SCBA004C: Implications of Slow or Floating CMOS Inputs",
  },
  "erc.unconnected-port": {
    rationale:
      "Non-power ports left unconnected in schematic may indicate incomplete wiring, broken net names, or missed peripheral connections.",
    remediation:
      "Verify schematic connections; wire the disconnected port to its target net or explicitly mark it as no-connect if intentional.",
  },
  "erc.power-short": {
    rationale:
      "Connecting positive power supply rails of differing voltages (e.g. 5V to 3.3V) or shorting positive supply rails directly to ground causes instantaneous overcurrent, thermal runaway, and permanent hardware destruction.",
    remediation:
      "Isolate separate voltage domains; verify ground nets (GND) are never joined directly to positive power nets (5V, 3.3V, VIN).",
  },
  "erc.output-contention": {
    rationale:
      "Two push-pull digital outputs connected to the same electrical net drive in opposite directions when one is HIGH and the other is LOW, resulting in excessive shoot-through currents (>100mA) that destroy driver transistors.",
    remediation:
      "Ensure only one push-pull output drives a net at any time. For shared buses, use tri-state buffers, open-collector/open-drain outputs with pull-up resistors, or diodes.",
  },
  "erc.led-no-resistor": {
    rationale:
      "LEDs exhibit an exponential forward I-V characteristic (Shockley diode equation). Without series resistance or current-limiting driver circuitry, forward current rises uncontrollably, destroying the LED and burning the MCU I/O driver stage.",
    remediation:
      "Insert a current-limiting series resistor calculated via Ohm's law: R = (Vcc - Vf) / If (typically 220Ω–1kΩ).",
    mathFormula: "R = (V_supply - V_forward) / I_target",
  },
  "erc.led-current": {
    rationale:
      "Calculated forward current I = (Vcc - Vf) / R must stay within safe LED continuous forward rating (<= 20mA typical, <= 30mA absolute max) and above minimum visible threshold (>= 1mA).",
    remediation:
      "Select a standard E24 resistor value that limits current to 10–15mA (e.g. 330Ω for 5V red/green LEDs).",
    mathFormula: "I_f = (V_supply - V_f) / R_series <= I_max",
  },
  "erc.pin-current": {
    rationale:
      "Microcontroller GPIO pins have strict physical current ratings (e.g. ATmega328P max 40mA absolute maximum, 20mA continuous recommended). Drawing excessive current overheats bond wires and damages internal driver FETs.",
    remediation:
      "Increase load resistance or use an external switching transistor, MOSFET (e.g. 2N7000), or relay module.",
  },
  "erc.total-current": {
    rationale:
      "The total aggregate current sourced or sunk through all microcontroller I/O pins and power pins must not exceed the package limit (e.g. 200mA across all pins for ATmega328P).",
    remediation:
      "Offload high-current devices (displays, servos, multiple LEDs, relays) to external power supply rails or driver ICs (e.g. ULN2003, TPIC6B595).",
  },
  "erc.i2c-pullups": {
    rationale:
      "The I2C bus protocol uses open-drain/open-collector outputs. Bus lines (SDA and SCL) cannot pull themselves HIGH and rely on external pull-up resistors to reach logic HIGH when idle.",
    remediation:
      "Add pull-up resistors (4.7kΩ for standard 100kHz / 400kHz mode, or 2.2kΩ for fast mode with high bus capacitance) between SDA/SCL and Vcc.",
    standardReference: "NXP UM10204: I2C-bus specification and user manual",
  },
  "erc.i2c-address-conflict": {
    rationale:
      "Every slave peripheral on an I2C bus must have a unique 7-bit address. If two devices share an address, both will ACK and drive data lines simultaneously, causing bus contention and packet corruption.",
    remediation:
      "Change address selection pin jumpers (A0, A1, A2) on one peripheral, or insert an I2C multiplexer (e.g. TCA9548A).",
  },
  "erc.decoupling": {
    rationale:
      "Digital ICs draw fast, high-frequency current spikes during state transitions. Without local decoupling capacitors, rail inductance causes supply dips and ground bounce, leading to glitching or unexpected resets.",
    remediation:
      "Place a 100nF ceramic capacitor across VCC and GND pins as close as physically possible to each IC package.",
  },
  "erc.logic-level-mismatch": {
    rationale:
      "Driving a 3.3V microcontroller or sensor input directly with a 5V logic signal exceeds the maximum input voltage rating (typically VDD + 0.3V), triggering substrate diode conduction and irreversible damage.",
    remediation:
      "Use a bidirectional logic level shifter (e.g. BSS138 circuit), resistor divider (5V -> 10kΩ/20kΩ -> 3.3V), or dedicated level-shifting buffer (e.g. 74LVC245).",
  },
  "erc.inductive-load-no-flyback": {
    rationale:
      "Inductive loads (relays, solenoids, DC motors) store energy in magnetic fields. When switching off, the collapsing magnetic field creates a reverse voltage spike (V = -L * di/dt) reaching hundreds of volts, destroying driving transistors.",
    remediation:
      "Place a flyback diode (e.g. 1N4007 or 1N4148) in reverse parallel across the inductive coil to safely clamp back-EMF spikes.",
    mathFormula: "V_spike = -L * (dI / dt)",
  },
  "erc.servo-power": {
    rationale:
      "RC hobby servos (e.g. SG90) draw large peak currents (500mA–1.5A during acceleration and stall). Powering them directly from the microcontroller 5V rail can collapse the supply and trigger continuous brown-out resets (BOR).",
    remediation:
      "Power the servo motor VCC pin from an external regulated 5V power supply capable of 1A+, connecting all grounds together in a common ground reference.",
  },
  "erc.pwm-capability": {
    rationale:
      "Arduino analogWrite() relies on internal microcontroller hardware timer/counter compare channels. Pins without hardware PWM support cannot generate PWM waveforms and will produce static digital HIGH/LOW states.",
    remediation:
      "Relocate the analogWrite() signal to a hardware PWM-capable pin (D3, D5, D6, D9, D10, D11 on Arduino Uno, marked with ~).",
  },
  "erc.adc-capability": {
    rationale:
      "Arduino analogRead() requires connection to an internal Analog-to-Digital Converter (ADC) multiplexer channel. Pure digital pins lack sampling circuitry and cannot measure continuous voltages.",
    remediation:
      "Connect analog sensors, potentiometers, and thermistors to dedicated ADC pins (A0–A5 on Arduino Uno).",
  },
  "erc.reserved-pin": {
    rationale:
      "Pins D0 (RX) and D1 (TX) are physically wired to the onboard USB-to-UART bridge (ATmega16U2/FT232). Using them for general GPIO interferes with sketch uploading and Serial debugging.",
    remediation:
      "Move general-purpose components to pins D2–D13 or analog pins A0–A5, reserving D0/D1 exclusively for Serial communications.",
  },
  "erc.power-budget": {
    rationale:
      "Microcontroller onboard linear voltage regulators (e.g. LP2985, NCP1117) have strict thermal and current ratings (typically 500mA USB limit, 800mA DC jack limit). Exceeding this triggers thermal shutdown.",
    remediation:
      "Calculate total system current draw and power high-current peripherals from an external regulated power supply.",
  },
};

export function explainCommand(
  ruleId: string,
  options: ExplainOptions = {},
): { code: number; output: string } {
  if (!ruleId) {
    const list = ALL_ERC_RULES.map(
      (r) => `  - ${r.id.padEnd(30)} [${r.defaultSeverity}] ${r.name}`,
    ).join("\n");
    return {
      code: 3,
      output: `Error: Missing <ruleId> argument.\n\nAvailable ERC rules in catalog:\n${list}\n\nUsage: s2c explain <ruleId>`,
    };
  }

  const normalizedId = ruleId.startsWith("erc.") ? ruleId : `erc.${ruleId}`;
  const rule = getRule(normalizedId);

  if (!rule) {
    const available = ALL_ERC_RULES.map((r) => `  - ${r.id}`).join("\n");
    return {
      code: 3,
      output: `Unknown rule '${ruleId}'.\n\nAvailable rules:\n${available}`,
    };
  }

  const doc = RULE_DOCS[rule.id] || {
    rationale: "Engineering safety and design integrity check.",
    remediation:
      "Check schematic connections and component ratings against datasheet specifications.",
  };

  if (options.json) {
    return {
      code: 0,
      output: JSON.stringify(
        {
          id: rule.id,
          name: rule.name,
          category: rule.category,
          defaultSeverity: rule.defaultSeverity,
          description: rule.description,
          rationale: doc.rationale,
          remediation: doc.remediation,
          mathFormula: doc.mathFormula,
          standardReference: doc.standardReference,
        },
        null,
        2,
      ),
    };
  }

  const lines = [
    "================================================================================",
    `RULE: ${rule.id} (${rule.name})`,
    "================================================================================",
    `Category:         ${rule.category}`,
    `Default Severity: ${rule.defaultSeverity.toUpperCase()}`,
    "",
    "DESCRIPTION:",
    `  ${rule.description}`,
    "",
    "ENGINEERING RATIONALE:",
    `  ${doc.rationale}`,
    "",
    "REMEDIATION / SUGGESTED FIX:",
    `  ${doc.remediation}`,
  ];

  if (doc.mathFormula) {
    lines.push("");
    lines.push("GOVERNING FORMULA:");
    lines.push(`  ${doc.mathFormula}`);
  }

  if (doc.standardReference) {
    lines.push("");
    lines.push("INDUSTRY STANDARD REFERENCE:");
    lines.push(`  ${doc.standardReference}`);
  }

  lines.push("================================================================================");

  return {
    code: 0,
    output: lines.join("\n"),
  };
}
