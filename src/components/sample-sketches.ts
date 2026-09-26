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
];
