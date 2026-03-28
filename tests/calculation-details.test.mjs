import test from "node:test";
import assert from "node:assert/strict";

import { calculateMotorOperatingPoint } from "../src/calculator.mjs";
import { buildMetricDetails, metricRows } from "../src/calculation-details.mjs";

const baseInput = {
  vehicle: {
    weightG: 150,
    inertiaGmm2: 150000,
    wheelDiameterMm: 24,
    pinionTeeth: 13,
    spurTeeth: 52,
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
    accelerationMps2: 0.8,
    yawRateDegS: 180,
    yawAccelerationDegS2: 720,
  },
};

test("buildMetricDetails returns explanation data for every result row", () => {
  const result = calculateMotorOperatingPoint(baseInput);

  metricRows.forEach((metric) => {
    const details = buildMetricDetails(result, metric.key);

    assert.ok(details, `${metric.key} should have details`);
    assert.equal(details.label, metric.label);
    assert.equal(details.sides.length, 2);
    assert.ok(details.sharedSymbols.length >= 4);
    assert.ok(details.sides.every((side) => side.steps.length >= 2));
  });
});

test("motor current details include torque-to-current flow for each side", () => {
  const result = calculateMotorOperatingPoint(baseInput);
  const details = buildMetricDetails(result, "motorCurrentA");

  assert.ok(details);
  assert.match(details.overview, /モータ電流/);
  assert.deepEqual(
    details.sides[0].steps.map((step) => step.label),
    ["ヨー由来の左右差荷重", "左輪の駆動力", "ホイールトルク", "モータトルク", "モータ電流"],
  );
  assert.match(details.sides[1].steps[1].substitution, /F_\{wheel\}/);
});
