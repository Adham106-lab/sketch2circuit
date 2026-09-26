// Multi-Peripheral Real-World Sketch
// Pinout: Buttons D2/D3, LEDs D4/D5, DC Motor D6, Buzzer D7, Servo D9, Pot A0, LDR A1.

#include <Servo.h>

const int BUTTON1_PIN = 2;
const int BUTTON2_PIN = 3;
const int LED1_PIN = 4;
const int LED2_PIN = 5;
const int MOTOR_PIN = 6;
const int BUZZER_PIN = 7;
const int SERVO_PIN = 9;
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
    tone(BUZZER_PIN, 440);
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
