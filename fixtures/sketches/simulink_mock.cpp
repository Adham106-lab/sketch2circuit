/*
 * Academic License - for use in teaching, academic research, and meeting
 * course requirements at degree granting institutions only.  Not for
 * government, commercial, or other organizational use.
 *
 * File: simulink_mock.cpp
 *
 * Code generated for Simulink model 'simulink_mock'.
 *
 * Model version                  : 1.1
 * Simulink Coder version         : 9.9 (R2023a)
 * C/C++ source code generated on : Wed Sep 30 10:00:00 2026
 *
 * Target selection: ert.tlc
 * Embedded hardware selection: Atmel->AVR (Arduino Uno)
 * Code generation objectives: Unspecified
 * Validation result: Not run
 */

#include "simulink_mock.h"
#include "MW_target_hardware_resources.h"
#include "MW_arduino_digitalio.h"
#include "MW_PWM.h"

/* Real-time model data structure */
typedef struct {
  struct {
    double stepSize0;
    unsigned long clockTick0;
  } Timing;
} RT_MODEL_simulink_mock_T;

/* Block states (default storage) */
typedef struct {
  int dummy;
} DW_simulink_mock_T;

DW_simulink_mock_T simulink_mock_DW;

/* Real-time model */
RT_MODEL_simulink_mock_T simulink_mock_M_;
RT_MODEL_simulink_mock_T *const simulink_mock_M = &simulink_mock_M_;

/* Model step function */
void simulink_mock_step(void)
{
  unsigned char rtb_Step;
  unsigned char rtb_DigitalInput;

  /* Step: '<Root>/Step' */
  if (simulink_mock_M->Timing.stepSize0 * (double)
      simulink_mock_M->Timing.clockTick0 < 1.0) {
    rtb_Step = 0;
  } else {
    rtb_Step = 1;
  }
  /* End of Step: '<Root>/Step' */

  /* MATLABSystem: '<Root>/Digital Input' */
  rtb_DigitalInput = MW_digitalIO_read(2);

  /* MATLABSystem: '<Root>/Digital Output' incorporates:
   *  Step: '<Root>/Step'
   */
  MW_digitalIO_write(13, rtb_Step);

  /* MATLABSystem: '<Root>/PWM' */
  MW_PWM_write(9, 128);
}

/* Model initialize function */
void simulink_mock_initialize(void)
{
  /* Registration code */

  /* Start for MATLABSystem: '<Root>/Digital Input' */
  MW_pinMode(2, MW_INPUT_PULLUP);

  /* Start for MATLABSystem: '<Root>/Digital Output' */
  MW_pinMode(13, MW_OUTPUT);

  /* Start for MATLABSystem: '<Root>/PWM' */
  MW_pinMode(9, MW_OUTPUT);
  MW_PWM_write(9, 0);
}

/* Model terminate function */
void simulink_mock_terminate(void)
{
  /* (no terminate code required) */
}

/*
 * File trailer for generated code.
 *
 * [EOF]
 */
