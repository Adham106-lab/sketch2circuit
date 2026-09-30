/**
 * @license Apache-2.0
 * Sample Arduino sketches for the interactive playground.
 */

export interface SampleSketch {
  id: string;
  name: string;
  category: "Basics" | "Sensors" | "Actuators" | "Edge Cases";
  description: string;
  code: string;
}

export const SAMPLE_SKETCHES: SampleSketch[] = [
  {
    id: "blink",
    name: "01. Blink (LED on D13)",
    category: "Basics",
    description:
      "The classic Arduino Hello World. Synthesizes a red LED with an automatically calculated 330Ω E24 current-limiting resistor.",
    code: `// Classic Blink Sketch
// sketch2circuit will synthesize an LED + current limiting resistor
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(1000);
  digitalWrite(ledPin, LOW);
  delay(1000);
}
`,
  },
  {
    id: "button_pullup",
    name: "02. Button (INPUT_PULLUP)",
    category: "Basics",
    description:
      "Pushbutton using internal microcontroller pull-up resistor. No external resistor is required; connects directly between D2 and GND.",
    code: `// Button with internal pull-up enabled
// No external pull-up resistor needed!
const int buttonPin = 2;
const int ledPin = 13;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
}

void loop() {
  int sensorVal = digitalRead(buttonPin);
  if (sensorVal == LOW) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}
`,
  },
  {
    id: "button_pulldown",
    name: "03. Button (External 10kΩ Pull-down)",
    category: "Basics",
    description:
      "Standard active-high pushbutton using pinMode(pin, INPUT). The synthesizer infers an external 10kΩ pull-down resistor to GND.",
    code: `// Active-high Pushbutton with external pull-down resistor
const int buttonPin = 2;
const int ledPin = 12;

void setup() {
  pinMode(buttonPin, INPUT);
  pinMode(ledPin, OUTPUT);
}

void loop() {
  int buttonState = digitalRead(buttonPin);
  digitalWrite(ledPin, buttonState);
}
`,
  },
  {
    id: "servo_sweep",
    name: "04. Servo Motor Sweep",
    category: "Actuators",
    description:
      "Position servo on PWM pin D9 using Servo.h. Triggers the ERC power check warning regarding stall current on the onboard 5V regulator.",
    code: `// TowerPro SG90 Servo Sweep
#include <Servo.h>

Servo myservo;
int pos = 0;

void setup() {
  myservo.attach(9); // Connects to PWM pin 9
}

void loop() {
  for (pos = 0; pos <= 180; pos += 1) {
    myservo.write(pos);
    delay(15);
  }
  for (pos = 180; pos >= 0; pos -= 1) {
    myservo.write(pos);
    delay(15);
  }
}
`,
  },
  {
    id: "hc_sr04",
    name: "05. Ultrasonic Rangefinder (HC-SR04)",
    category: "Sensors",
    description:
      "Multi-pin ultrasonic distance sensor combining pulseIn() on Echo (D12) with trigger pulses on Trig (D11).",
    code: `// HC-SR04 Ultrasonic Distance Sensor
const int trigPin = 11;
const int echoPin = 12;

void setup() {
  Serial.begin(9600);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
}

void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH);
  long distanceCm = duration * 0.034 / 2;
  Serial.println(distanceCm);
  delay(100);
}
`,
  },
  {
    id: "pot_analog",
    name: "06. Potentiometer / Analog Input",
    category: "Sensors",
    description:
      "Analog reading on pin A0. Infers a 10kΩ potentiometer voltage divider connecting 5V, A0 wiper, and GND.",
    code: `// Potentiometer Analog Voltage Divider
const int potPin = A0;
const int ledPin = 9; // PWM pin for dimming

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  int sensorValue = analogRead(potPin);
  int brightness = map(sensorValue, 0, 1023, 0, 255);
  analogWrite(ledPin, brightness);
  delay(10);
}
`,
  },
  {
    id: "piezo_tone",
    name: "07. Piezo Buzzer Melody",
    category: "Actuators",
    description:
      "Passive piezo buzzer driven with tone() frequency output on D8, synthesized with a protective 100Ω series resistor.",
    code: `// Piezo Buzzer Melody
const int buzzerPin = 8;

void setup() {
  // Play a brief 440 Hz startup chime
  tone(buzzerPin, 440, 500);
}

void loop() {
  delay(1000);
}
`,
  },
  {
    id: "dynamic_loop",
    name: "08. Dynamic Loop (Unresolved Diagnostic)",
    category: "Edge Cases",
    description:
      "Demonstrates how runtime-computed pin indexes (e.g. pins[i] in a loop) are flagged as Unresolved rather than guessed.",
    code: `// Dynamic pin indexing example
// The synthesizer flags pins[i] as Unresolved because it cannot be evaluated at compile time
int pins[] = {2, 3, 4, 5};

void setup() {
  for (int i = 0; i < 4; i++) {
    pinMode(pins[i], OUTPUT);
  }
}

void loop() {
  for (int i = 0; i < 4; i++) {
    digitalWrite(pins[i], HIGH);
  }
}
`,
  },
  {
    id: "annotated_rgb",
    name: "09. User-Annotated Circuit (@s2c)",
    category: "Edge Cases",
    description:
      "Demonstrates explicit @s2c developer annotations to override default inferences with 100% confidence.",
    code: `// Developer-annotated circuit pins
// @s2c: led(color=blue) on D6
// @s2c: led(color=green) on D5
// @s2c: button on D2

const int blueLed = 6;
const int greenLed = 5;
const int buttonPin = 2;

void setup() {
  pinMode(blueLed, OUTPUT);
  pinMode(greenLed, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);
}

void loop() {
  int state = digitalRead(buttonPin);
  if (state == LOW) {
    digitalWrite(blueLed, HIGH);
    digitalWrite(greenLed, LOW);
  } else {
    digitalWrite(blueLed, LOW);
    digitalWrite(greenLed, HIGH);
  }
}
`,
  },
  {
    id: "multi_peripheral_benchmark",
    name: "10. Multi-Peripheral Stress Test",
    category: "Edge Cases",
    description:
      "Full multi-peripheral integration test with 2 buttons, 2 LEDs, DC motor, piezo buzzer, servo with constant pin, pot, and LDR.",
    code: `// Multi-Peripheral Stress Test (Real-World Benchmark)
#include <Servo.h>

const int BUTTON1_PIN = 2;
const int MOTOR_PIN = 3;
const int BUTTON2_PIN = 4;
const int BUZZER_PIN = 7;
const int SERVO_PIN = 9;
const int LED1_PIN = 12;
const int LED2_PIN = 13;
const int POT_PIN = A0;
const int LDR_PIN = A1;

Servo testServo;

void setup() {
  pinMode(BUTTON1_PIN, INPUT_PULLUP);
  pinMode(BUTTON2_PIN, INPUT_PULLUP);
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  testServo.attach(SERVO_PIN);
}

void loop() {
  int potValue = analogRead(POT_PIN);
  int ldrValue = analogRead(LDR_PIN);

  int btn1State = digitalRead(BUTTON1_PIN);
  int btn2State = digitalRead(BUTTON2_PIN);

  if (btn1State == LOW) {
    digitalWrite(LED1_PIN, HIGH);
    tone(BUZZER_PIN, 1000);
  } else {
    digitalWrite(LED1_PIN, LOW);
    noTone(BUZZER_PIN);
  }

  if (btn2State == LOW) {
    digitalWrite(LED2_PIN, HIGH);
    testServo.write(180);
  } else {
    digitalWrite(LED2_PIN, LOW);
    testServo.write(0);
  }

  int motorSpeed = map(potValue, 0, 1023, 0, 255);
  analogWrite(MOTOR_PIN, motorSpeed);
}
`,
  },
  {
    id: "erc_hazards",
    name: "11. ERC Hazards (Flyback Diode & Pin Over-Current)",
    category: "Edge Cases",
    description:
      "Triggers critical ERC safety diagnostics: bare DC motor driving GPIO without flyback clamp diode (erc.inductive-load-no-flyback), and heavy load exceeding 40mA GPIO limit (erc.pin-current).",
    code: `// ERC Diagnostics Benchmark: Flyback Diode & Pin Over-Current
// Demonstrates electrical safety & absolute maximum ratings enforcement
const int motorPin = 3;      // Bare DC inductive motor without clamp diode
const int heavyLoadPin = 6;  // Driving low-resistance load directly to GND

void setup() {
  pinMode(motorPin, OUTPUT);
  pinMode(heavyLoadPin, OUTPUT);
}

void loop() {
  // Inductive kickback hazard: PWM motor drive without flyback diode
  analogWrite(motorPin, 180);

  // Pin over-current hazard: direct output into heavy load
  digitalWrite(heavyLoadPin, HIGH);
  delay(100);
}
`,
  },
  {
    id: "user_multi_peripheral",
    name: "12. User Multi-Peripheral Benchmark",
    category: "Sensors",
    description:
      "Full hardware benchmark fixture: 2x Buttons, 2x LEDs, DC Motor, Piezo Buzzer, Servo Motor, Potentiometer, and LDR light sensor with self-test sequence.",
    code: `#include <Servo.h>

/*
  Sketch2Circuit - Arduino UNO Hardware Test

  Components:
    Button 1       -> D2
    Button 2       -> D3
    LED 1          -> D4
    LED 2          -> D5
    DC Motor       -> D6
    Buzzer         -> D7
    Servo          -> D9
    Potentiometer  -> A0
    LDR            -> A1

  Serial Monitor:
    115200 baud
*/

// =========================
// Pin Definitions
// =========================

const int BUTTON_1_PIN = 2;
const int BUTTON_2_PIN = 3;

const int LED_1_PIN = 4;
const int LED_2_PIN = 5;

const int MOTOR_PIN = 6;
const int BUZZER_PIN = 7;

const int SERVO_PIN = 9;

const int POT_PIN = A0;
const int LDR_PIN = A1;


// =========================
// Servo
// =========================

Servo testServo;


// =========================
// State
// =========================

bool motorState = false;
bool led1State = false;
bool led2State = false;

unsigned long lastStatusTime = 0;


// =========================
// Setup
// =========================

void setup() {

  Serial.begin(115200);

  while (!Serial) {
    ;
  }

  Serial.println();
  Serial.println("=================================");
  Serial.println(" Sketch2Circuit Hardware Tester");
  Serial.println(" Arduino UNO Board");
  Serial.println("=================================");
  Serial.println();


  pinMode(BUTTON_1_PIN, INPUT_PULLUP);
  pinMode(BUTTON_2_PIN, INPUT_PULLUP);

  pinMode(LED_1_PIN, OUTPUT);
  pinMode(LED_2_PIN, OUTPUT);

  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  testServo.attach(SERVO_PIN);

  digitalWrite(LED_1_PIN, LOW);
  digitalWrite(LED_2_PIN, LOW);
  analogWrite(MOTOR_PIN, 0);
  noTone(BUZZER_PIN);
  testServo.write(90);


  runSelfTest();


  Serial.println("Ready. Entering main loop...");
  Serial.println();
}


// =========================
// Main Loop
// =========================

void loop() {

  readButtons();

  controlLEDs();

  controlMotor();

  controlServo();

  readSensors();

  printStatus();

  delay(20);
}


// ============================================================
// SELF TEST
// ============================================================

void runSelfTest() {

  Serial.println("Starting hardware self-test...");
  Serial.println();

  // -------------------------
  // LED 1
  // -------------------------

  Serial.println("[1/6] Testing LED 1...");

  digitalWrite(LED_1_PIN, HIGH);
  delay(500);

  digitalWrite(LED_1_PIN, LOW);
  delay(300);

  Serial.println("LED 1 test complete.");
  Serial.println();


  // -------------------------
  // LED 2
  // -------------------------

  Serial.println("[2/6] Testing LED 2...");

  digitalWrite(LED_2_PIN, HIGH);
  delay(500);

  digitalWrite(LED_2_PIN, LOW);
  delay(300);

  Serial.println("LED 2 test complete.");
  Serial.println();


  // -------------------------
  // Buzzer
  // -------------------------

  Serial.println("[3/6] Testing buzzer...");

  tone(BUZZER_PIN, 1000);
  delay(400);

  tone(BUZZER_PIN, 1500);
  delay(400);

  tone(BUZZER_PIN, 2000);
  delay(400);

  noTone(BUZZER_PIN);

  Serial.println("Buzzer test complete.");
  Serial.println();


  // -------------------------
  // Servo
  // -------------------------

  Serial.println("[4/6] Testing servo...");

  testServo.write(0);
  delay(700);

  testServo.write(90);
  delay(700);

  testServo.write(180);
  delay(700);

  testServo.write(90);
  delay(500);

  Serial.println("Servo test complete.");
  Serial.println();


  // -------------------------
  // DC Motor
  // -------------------------

  Serial.println("[5/6] Testing DC motor...");

  Serial.println("Motor LOW...");
  analogWrite(MOTOR_PIN, 0);
  delay(500);

  Serial.println("Motor 50%...");
  analogWrite(MOTOR_PIN, 128);
  delay(1000);

  Serial.println("Motor 100%...");
  analogWrite(MOTOR_PIN, 255);
  delay(1000);

  Serial.println("Motor OFF...");
  analogWrite(MOTOR_PIN, 0);
  delay(500);

  Serial.println("Motor test complete.");
  Serial.println();


  // -------------------------
  // Analog sensors
  // -------------------------

  Serial.println("[6/6] Testing analog inputs...");

  int potValue = analogRead(POT_PIN);
  int ldrValue = analogRead(LDR_PIN);

  Serial.print("Potentiometer: ");
  Serial.println(potValue);

  Serial.print("LDR: ");
  Serial.println(ldrValue);

  Serial.println("Analog input test complete.");
  Serial.println();

  Serial.println("=================================");
  Serial.println(" SELF-TEST COMPLETE");
  Serial.println("=================================");
}


// ============================================================
// BUTTONS
// ============================================================

void readButtons() {

  static bool lastButton1 = HIGH;
  static bool lastButton2 = HIGH;

  bool button1 = digitalRead(BUTTON_1_PIN);
  bool button2 = digitalRead(BUTTON_2_PIN);


  // Button 1 pressed
  if (button1 == LOW && lastButton1 == HIGH) {

    Serial.println("[BUTTON 1] Pressed");

    led1State = !led1State;

    digitalWrite(
      LED_1_PIN,
      led1State ? HIGH : LOW
    );

    beep(1000, 100);
  }


  // Button 2 pressed
  if (button2 == LOW && lastButton2 == HIGH) {

    Serial.println("[BUTTON 2] Pressed");

    motorState = !motorState;

    if (motorState) {
      analogWrite(MOTOR_PIN, 180);
      Serial.println("Motor -> ON");
    }
    else {
      analogWrite(MOTOR_PIN, 0);
      Serial.println("Motor -> OFF");
    }

    beep(1500, 100);
  }


  lastButton1 = button1;
  lastButton2 = button2;
}


// ============================================================
// LED CONTROL
// ============================================================

void controlLEDs() {

  int potValue = analogRead(POT_PIN);

  if (potValue >= 512) {
    digitalWrite(LED_2_PIN, HIGH);
    led2State = true;
  }
  else {
    digitalWrite(LED_2_PIN, LOW);
    led2State = false;
  }
}


// ============================================================
// MOTOR CONTROL
// ============================================================

void controlMotor() {

  if (!motorState) {
    analogWrite(MOTOR_PIN, 0);
    return;
  }

  int ldrValue = analogRead(LDR_PIN);

  int motorSpeed = map(
    ldrValue,
    0,
    1023,
    50,
    255
  );

  motorSpeed = constrain(
    motorSpeed,
    0,
    255
  );

  analogWrite(
    MOTOR_PIN,
    motorSpeed
  );
}


// ============================================================
// SERVO CONTROL
// ============================================================

void controlServo() {

  int potValue = analogRead(POT_PIN);

  int angle = map(
    potValue,
    0,
    1023,
    0,
    180
  );

  angle = constrain(
    angle,
    0,
    180
  );

  testServo.write(angle);
}


// ============================================================
// SENSOR READING
// ============================================================

void readSensors() {
}


// ============================================================
// STATUS
// ============================================================

void printStatus() {

  if (millis() - lastStatusTime < 500) {
    return;
  }

  lastStatusTime = millis();


  int potValue = analogRead(POT_PIN);
  int ldrValue = analogRead(LDR_PIN);

  int servoAngle = map(
    potValue,
    0,
    1023,
    0,
    180
  );

  int motorSpeed = 0;

  if (motorState) {

    motorSpeed = map(
      ldrValue,
      0,
      1023,
      50,
      255
    );

    motorSpeed = constrain(
      motorSpeed,
      0,
      255
    );
  }


  Serial.print("POT=");
  Serial.print(potValue);

  Serial.print(" | LDR=");
  Serial.print(ldrValue);

  Serial.print(" | SERVO=");
  Serial.print(servoAngle);
  Serial.print("deg");

  Serial.print(" | MOTOR=");
  Serial.print(motorSpeed);

  Serial.print(" | LED1=");
  Serial.print(led1State ? "ON" : "OFF");

  Serial.print(" | LED2=");
  Serial.print(led2State ? "ON" : "OFF");

  Serial.println();
}


// ============================================================
// BEEP
// ============================================================

void beep(
  int frequency,
  int duration
) {

  tone(
    BUZZER_PIN,
    frequency,
    duration
  );

  delay(duration);

  noTone(BUZZER_PIN);
}
`,
  },
  {
    id: "esp32_board_mismatch",
    name: "13. ESP32 Sketch (Board Mismatch Diagnostic)",
    category: "Edge Cases",
    description:
      "Demonstrates explicit board-architecture mismatch reporting for out-of-scope ESP32 sketches with unknown libraries (WiFi, WebServer, Preferences) and GPIOs (21, 22, 27).",
    code: `// Real-World ESP32 Web/RTC Sketch (Out of v1 Uno scope)
// sketch2circuit detects non-Uno GPIOs and unsupported libraries,
// surfacing explicit diagnostics instead of failing silently.
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <RTClib.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

void setup() {
  pinMode(21, OUTPUT); // ESP32 SDA / GPIO 21
  pinMode(22, INPUT);  // ESP32 SCL / GPIO 22
  pinMode(27, OUTPUT); // ESP32 GPIO 27
  pinMode(4, OUTPUT);  // Valid Uno D4 pin (synthesizes LED)
  digitalWrite(21, HIGH);
  digitalWrite(27, LOW);
}

void loop() {
  digitalWrite(4, HIGH);
  delay(500);
  digitalWrite(4, LOW);
  delay(500);
}
`,
  },
];
