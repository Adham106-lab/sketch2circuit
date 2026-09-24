/**
 * @license Apache-2.0
 * @s2c/arduino — Physical Header GND Pin Allocator & Rail Fallback (GAP-02).
 */

export interface PhysicalGndAllocation {
  /**
   * The port ID or breadboard rail reference to wire to.
   * e.g. "U1.POWER.GND.1", "U1.POWER.GND.2", "U1.DIGITAL.GND", or "Breadboard.GND_RAIL"
   */
  assignedPin: string;

  /**
   * Physical header pin location.
   */
  headerLocation: string;

  /**
   * Detailed instruction for breadboard jumper wiring.
   */
  wiringNote: string;

  /**
   * True if this allocation exceeds physical pins and connects to the breadboard ground rail.
   */
  usesBreadboardRail: boolean;
}

export class PhysicalGndAllocator {
  private boardRef: string;
  private gndPins: Array<{ pin: string; header: string; description: string }>;
  private allocatedCount = 0;
  private maxPhysicalPins: number;

  constructor(boardRef = "U1", boardType = "ARDUINO_UNO_R3") {
    this.boardRef = boardRef;
    if (boardType === "ARDUINO_UNO_R3") {
      // Official Arduino Uno R3 Schematic Pinout:
      // Exactly 3 female header GND pins accessible to breadboard jumpers:
      // 1. JP2 Pin 6 (between 5V and GND2 on Power header)
      // 2. JP2 Pin 7 (between GND1 and VIN on Power header)
      // 3. JP1 Pin 4 (between AREF and D13 on Digital header)
      this.gndPins = [
        {
          pin: "POWER.GND.1",
          header: "Power Header JP2 Pin 6",
          description: "Power header GND.1 (between 5V and GND.2)",
        },
        {
          pin: "POWER.GND.2",
          header: "Power Header JP2 Pin 7",
          description: "Power header GND.2 (between GND.1 and VIN)",
        },
        {
          pin: "DIGITAL.GND",
          header: "Digital Header JP1 Pin 4",
          description: "Digital header GND (between AREF and D13)",
        },
      ];
    } else {
      // Default / Arduino Nano (pins 4 and 29)
      this.gndPins = [
        {
          pin: "GND.1",
          header: "Header Pin 4",
          description: "Board GND 1",
        },
        {
          pin: "GND.2",
          header: "Header Pin 29",
          description: "Board GND 2",
        },
      ];
    }
    this.maxPhysicalPins = this.gndPins.length;
  }

  /**
   * Allocates a physical GND pin.
   * If count <= maxPhysicalPins: returns dedicated physical pin (POWER.GND.1, POWER.GND.2, DIGITAL.GND).
   * If count > maxPhysicalPins: gracefully designates the shared breadboard ground rail
   * without erroring out or double-booking pins.
   */
  allocate(targetComponent?: string): PhysicalGndAllocation {
    this.allocatedCount++;

    if (this.allocatedCount <= this.maxPhysicalPins) {
      const p = this.gndPins[this.allocatedCount - 1];
      return {
        assignedPin: `${this.boardRef}.${p.pin}`,
        headerLocation: p.header,
        wiringNote: `Direct jumper to ${p.header} (${p.description})`,
        usesBreadboardRail: false,
      };
    }

    // Graceful breadboard rail fallback (>3 GND connections on Uno R3)
    const primaryGnd = `${this.boardRef}.${this.gndPins[0].pin}`;
    return {
      assignedPin: "Breadboard.GND_RAIL",
      headerLocation: "Breadboard Ground Rail (-)",
      wiringNote: `Connect ${targetComponent || "component"} to Breadboard Ground Bus Rail (-) [Tie ${primaryGnd} to breadboard blue rail]`,
      usesBreadboardRail: true,
    };
  }

  get totalAllocations(): number {
    return this.allocatedCount;
  }

  get isRailTieInRequired(): boolean {
    return this.allocatedCount > this.maxPhysicalPins;
  }

  get physicalPinCount(): number {
    return this.maxPhysicalPins;
  }
}
