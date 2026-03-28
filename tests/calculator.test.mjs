import test from "node:test";
import assert from "node:assert/strict";

import { calculateMotorOperatingPoint, normalizeInputs } from "../src/calculator.mjs";

const baseInput = {
  vehicle: {
    weightG: 150,
    inertiaGmm2: 150000,
    wheelDiameterMm: 24,
    gearRatioNumerator: 4,
    gearRatioDenominator: 1,
    trackWidthMm: 72,
    supplyVoltageV: 4.2,
  },
  motor: {
    backEmfConstantMVRpm: 0.38,
    torqueConstantMNmA: 1.6,
    terminalResistanceOhm: 1.2,
  },
  operatingPoint: {
    speedMps: 1.5,
    accelerationMps2: 0,
    yawRateDegS: 0,
    yawAccelerationDegS2: 0,
  },
};

test("normalizeInputs converts user units into SI-friendly values", () => {
  const normalized = normalizeInputs(baseInput);

  assert.equal(normalized.vehicle.massKg, 0.15);
  assert.equal(normalized.vehicle.wheelRadiusM, 0.012);
  assert.equal(normalized.vehicle.gearRatio, 4);
  assert.equal(normalized.vehicle.trackWidthM, 0.072);
  assert.equal(normalized.motor.torqueConstantNmPerA, 0.0016);
});

test("straight-line constant speed produces symmetric zero-torque results", () => {
  const result = calculateMotorOperatingPoint(baseInput);

  assert.equal(result.left.motorCurrentA, 0);
  assert.equal(result.right.motorCurrentA, 0);
  assert.equal(result.left.motorSpeedRpm, result.right.motorSpeedRpm);
  assert.equal(result.left.batteryCurrentA, 0);
  assert.equal(result.right.batteryCurrentA, 0);
  assert.equal(result.warnings.length, 0);
});

test("yaw rate splits left and right motor speeds", () => {
  const result = calculateMotorOperatingPoint({
    ...baseInput,
    operatingPoint: {
      ...baseInput.operatingPoint,
      yawRateDegS: 180,
    },
  });

  assert.ok(result.left.motorSpeedRpm < result.right.motorSpeedRpm);
  assert.equal(result.left.motorCurrentA, 0);
  assert.equal(result.right.motorCurrentA, 0);
});

test("yaw acceleration creates opposite wheel torques", () => {
  const result = calculateMotorOperatingPoint({
    ...baseInput,
    operatingPoint: {
      ...baseInput.operatingPoint,
      yawAccelerationDegS2: 720,
    },
  });

  assert.ok(result.left.motorCurrentA < 0);
  assert.ok(result.right.motorCurrentA > 0);
  assert.equal(Math.abs(result.left.motorCurrentA), Math.abs(result.right.motorCurrentA));
});

test("high demand reports voltage saturation warning", () => {
  const result = calculateMotorOperatingPoint({
    ...baseInput,
    operatingPoint: {
      ...baseInput.operatingPoint,
      speedMps: 5,
      accelerationMps2: 12,
    },
  });

  assert.ok(result.warnings.some((warning) => warning.includes("Duty 比")));
});
