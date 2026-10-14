/**
 * @license Apache-2.0
 * @s2c/manifests — Declarative Board Manifest for ESP32-DevKitC V1.
 */

import type { BoardManifest } from "../types.js";

export const ESP32_DEVKIT_V1_MANIFEST: BoardManifest = {
  id: "esp32-devkit-v1",
  name: "ESP32 DevKit V1 (30/36-pin)",
  mcuFamily: "ESP32",
  operatingVoltage: 3.3,
  maxGpioCurrentMa: 12.0, // conservative safe source/sink current; absolute max is 40mA
  totalPackageCurrentMa: 1200.0,
  defaultI2C: { sda: "GPIO21", scl: "GPIO22" },
  defaultSPI: { mosi: "GPIO23", miso: "GPIO19", sck: "GPIO18", ss: "GPIO5" },
  defaultUART: { tx: "GPIO1", rx: "GPIO3" },
  pins: {
    GPIO0: {
      id: "GPIO0",
      name: "GPIO0 (BOOT)",
      capabilities: ["GPIO", "ADC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
      strappingRule: {
        safeBootState: "HIGH",
        riskDescription:
          "Strapping pin GPIO0 selects boot mode. Must be HIGH during normal boot. If held LOW at reset, MCU enters UART bootloader / flashing mode and sketch execution fails.",
      },
    },
    GPIO1: {
      id: "GPIO1",
      name: "GPIO1 (TX0)",
      capabilities: ["GPIO", "UART_TX"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO2: {
      id: "GPIO2",
      name: "GPIO2 (LED/BOOT)",
      capabilities: ["GPIO", "ADC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
      strappingRule: {
        safeBootState: "LOW",
        riskDescription:
          "Strapping pin GPIO2 must be left floating or pulled LOW during flashing. Connected to onboard blue LED. Pulling HIGH during boot can cause flashing errors.",
      },
    },
    GPIO3: {
      id: "GPIO3",
      name: "GPIO3 (RX0)",
      capabilities: ["GPIO", "UART_RX"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO4: {
      id: "GPIO4",
      name: "GPIO4",
      capabilities: ["GPIO", "ADC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO5: {
      id: "GPIO5",
      name: "GPIO5 (SS)",
      capabilities: ["GPIO", "PWM", "SPI_SS"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
      strappingRule: {
        safeBootState: "HIGH",
        riskDescription:
          "Strapping pin GPIO5 determines SDIO timing at boot. Must not be pulled LOW during reset to avoid boot delays or SDIO slave timing faults.",
      },
    },
    GPIO12: {
      id: "GPIO12",
      name: "GPIO12 (MTDI)",
      capabilities: ["GPIO", "ADC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
      strappingRule: {
        safeBootState: "LOW",
        riskDescription:
          "Strapping pin GPIO12 selects SPI flash LDO voltage (LOW=3.3V, HIGH=1.8V). Pulling GPIO12 HIGH at reset will cause internal LDO to drop flash voltage to 1.8V, crashing 3.3V flash memory and causing a brownout/boot-loop.",
      },
    },
    GPIO13: {
      id: "GPIO13",
      name: "GPIO13 (MTCK)",
      capabilities: ["GPIO", "ADC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO14: {
      id: "GPIO14",
      name: "GPIO14 (MTMS)",
      capabilities: ["GPIO", "ADC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO15: {
      id: "GPIO15",
      name: "GPIO15 (MTDO)",
      capabilities: ["GPIO", "ADC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
      strappingRule: {
        safeBootState: "HIGH",
        riskDescription:
          "Strapping pin GPIO15 controls ROM boot log output (HIGH=silent, LOW=logs). Pulling LOW affects boot debug printing.",
      },
    },
    GPIO18: {
      id: "GPIO18",
      name: "GPIO18 (SCK)",
      capabilities: ["GPIO", "PWM", "SPI_SCK"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO19: {
      id: "GPIO19",
      name: "GPIO19 (MISO)",
      capabilities: ["GPIO", "PWM", "SPI_MISO"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO21: {
      id: "GPIO21",
      name: "GPIO21 (SDA)",
      capabilities: ["GPIO", "PWM", "I2C_SDA"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO22: {
      id: "GPIO22",
      name: "GPIO22 (SCL)",
      capabilities: ["GPIO", "PWM", "I2C_SCL"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO23: {
      id: "GPIO23",
      name: "GPIO23 (MOSI)",
      capabilities: ["GPIO", "PWM", "SPI_MOSI"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO25: {
      id: "GPIO25",
      name: "GPIO25 (DAC1)",
      capabilities: ["GPIO", "ADC", "DAC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO26: {
      id: "GPIO26",
      name: "GPIO26 (DAC2)",
      capabilities: ["GPIO", "ADC", "DAC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO27: {
      id: "GPIO27",
      name: "GPIO27",
      capabilities: ["GPIO", "ADC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO32: {
      id: "GPIO32",
      name: "GPIO32",
      capabilities: ["GPIO", "ADC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    GPIO33: {
      id: "GPIO33",
      name: "GPIO33",
      capabilities: ["GPIO", "ADC", "PWM"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 12.0,
    },
    // RESTRICTED: Input-Only Pins (No output drivers, no internal pullup/pulldown resistors)
    GPIO34: {
      id: "GPIO34",
      name: "GPIO34 (INPUT ONLY)",
      capabilities: ["ADC"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 0.0,
      inputOnly: true,
      description: "Input-only pin (GPI). Cannot be driven as digital OUTPUT.",
    },
    GPIO35: {
      id: "GPIO35",
      name: "GPIO35 (INPUT ONLY)",
      capabilities: ["ADC"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 0.0,
      inputOnly: true,
      description: "Input-only pin (GPI). Cannot be driven as digital OUTPUT.",
    },
    GPIO36: {
      id: "GPIO36",
      name: "GPIO36 / SENSOR_VP (INPUT ONLY)",
      capabilities: ["ADC"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 0.0,
      inputOnly: true,
      description: "Input-only pin (SENSOR_VP). Cannot be driven as digital OUTPUT.",
    },
    GPIO39: {
      id: "GPIO39",
      name: "GPIO39 / SENSOR_VN (INPUT ONLY)",
      capabilities: ["ADC"],
      voltageRange: [0, 3.3],
      maxCurrentMa: 0.0,
      inputOnly: true,
      description: "Input-only pin (SENSOR_VN). Cannot be driven as digital OUTPUT.",
    },
  },
};
