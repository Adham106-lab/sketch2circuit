#include <Servo.h>

/*
 * Sketch2Circuit - Arduino UNO Hardware Test
 *
 * Pin assignments:
 *  - D2: BUTTON_1_PIN (pushbutton with internal pull-up)
 *  - D3: BUTTON_2_PIN (pushbutton with internal pull-up)
 *  - D4: LED_1_PIN (LED status indicator 1)
 *  - D5: LED_2_PIN (LED status indicator 2)
 *  - D6: MOTOR_PIN (DC motor drive output)
 *  - D7: BUZZER_PIN (piezo buzzer tone output)
 *  - D9: SERVO_PIN (SG90 servo motor PWM control)
 *  - A0: POT_PIN (analog rotary potentiometer input)
 *  - A1: LDR_PIN (analog light-dependent resistor sensor input)
 */

const int BUTTON_1_PIN = 2;
const int BUTTON_2_PIN = 3;
const int LED_1_PIN = 4;
const int LED_2_PIN = 5;
const int MOTOR_PIN = 6;
const int BUZZER_PIN = 7;
const int SERVO_PIN = 9;
const int POT_PIN = A0;
const int LDR_PIN = A1;

Servo testServo;

void beep(int durationMs) {
  tone(BUZZER_PIN, 1000, durationMs);
}

void setup() {
  Serial.begin(9600);
  pinMode(BUTTON_1_PIN, INPUT_PULLUP);
  pinMode(BUTTON_2_PIN, INPUT_PULLUP);
  pinMode(LED_1_PIN, OUTPUT);
  pinMode(LED_2_PIN, OUTPUT);
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  testServo.attach(SERVO_PIN);
}

void loop() {
  int potVal = analogRead(POT_PIN);
  int ldrVal = analogRead(LDR_PIN);
  int btn1State = digitalRead(BUTTON_1_PIN);
  int btn2State = digitalRead(BUTTON_2_PIN);

  if (btn1State == LOW) {
    digitalWrite(LED_1_PIN, HIGH);
    beep(100);
  } else {
    digitalWrite(LED_1_PIN, LOW);
  }

  if (btn2State == LOW) {
    digitalWrite(LED_2_PIN, HIGH);
    testServo.write(180);
  } else {
    digitalWrite(LED_2_PIN, LOW);
    testServo.write(0);
  }

  int motorSpeed = map(potVal, 0, 1023, 0, 255);
  analogWrite(MOTOR_PIN, motorSpeed);
  Serial.println(ldrVal);
}
