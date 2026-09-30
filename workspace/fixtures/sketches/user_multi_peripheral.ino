#include <Servo.h>

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

  // Digital outputs
  pinMode(LED_1_PIN, OUTPUT);
  pinMode(LED_2_PIN, OUTPUT);

  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Buttons
  pinMode(BUTTON_1_PIN, INPUT_PULLUP);
  pinMode(BUTTON_2_PIN, INPUT_PULLUP);

  // Servo
  testServo.attach(SERVO_PIN);

  // Initial state
  digitalWrite(LED_1_PIN, LOW);
  digitalWrite(LED_2_PIN, LOW);
  digitalWrite(MOTOR_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  testServo.write(90);

  delay(1000);

  Serial.println();
  Serial.println("=================================");
  Serial.println(" Sketch2Circuit Hardware Tester");
  Serial.println(" Arduino UNO");
  Serial.println("=================================");
  Serial.println();

  runSelfTest();

  Serial.println();
  Serial.println("Entering interactive mode...");
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

  /*
    LED 1:
      Controlled by Button 1

    LED 2:
      Controlled by potentiometer

    Pot < 512  -> OFF
    Pot >= 512 -> ON
  */

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

  /*
    Button 2 toggles the motor.

    Motor speed is controlled by LDR.

    More light -> higher speed.
  */

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

  /*
    Servo angle follows the potentiometer.

    Pot:
      0    -> Servo 0°
      512  -> Servo 90°
      1023 -> Servo 180°
  */

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

  /*
    We don't print here continuously.
    Values are printed by printStatus()
  */
}


// ============================================================
// STATUS
// ============================================================

void printStatus() {

  // Print every 500 ms

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
