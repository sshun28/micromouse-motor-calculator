const DEG_TO_RAD = Math.PI / 180;
const RAD_PER_SEC_TO_RPM = 60 / (2 * Math.PI);

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} には有限の数値を入力してください。`);
  }
}

function assertPositive(value, label) {
  assertFiniteNumber(value, label);

  if (value <= 0) {
    throw new Error(`${label} には 0 より大きい値を入力してください。`);
  }
}

function assertNonNegative(value, label) {
  assertFiniteNumber(value, label);

  if (value < 0) {
    throw new Error(`${label} には 0 以上の値を入力してください。`);
  }
}

export function normalizeInputs(input) {
  const vehicle = input?.vehicle ?? {};
  const motor = input?.motor ?? {};
  const operatingPoint = input?.operatingPoint ?? {};

  assertPositive(vehicle.weightG, "重量");
  assertNonNegative(vehicle.inertiaGmm2, "慣性モーメント");
  assertPositive(vehicle.wheelDiameterMm, "ホイール直径");
  assertPositive(vehicle.trackWidthMm, "トレッド幅");
  assertPositive(vehicle.supplyVoltageV, "電源電圧");
  assertPositive(vehicle.gearRatioNumerator, "減速比の分子");
  assertPositive(vehicle.gearRatioDenominator, "減速比の分母");

  assertPositive(motor.backEmfConstantMVRpm, "発生電圧定数");
  assertPositive(motor.torqueConstantMNmA, "トルク定数");
  assertNonNegative(motor.terminalResistanceOhm, "端子間抵抗");

  assertFiniteNumber(operatingPoint.speedMps, "速度");
  assertFiniteNumber(operatingPoint.accelerationMps2, "加速度");
  assertFiniteNumber(operatingPoint.yawRateDegS, "角速度");
  assertFiniteNumber(operatingPoint.yawAccelerationDegS2, "角加速度");

  return {
    vehicle: {
      massKg: vehicle.weightG / 1000,
      yawInertiaKgM2: vehicle.inertiaGmm2 * 1e-9,
      wheelRadiusM: vehicle.wheelDiameterMm / 2000,
      gearRatio: vehicle.gearRatioNumerator / vehicle.gearRatioDenominator,
      gearRatioNumerator: vehicle.gearRatioNumerator,
      gearRatioDenominator: vehicle.gearRatioDenominator,
      trackWidthM: vehicle.trackWidthMm / 1000,
      supplyVoltageV: vehicle.supplyVoltageV,
    },
    motor: {
      backEmfConstantVPerRpm: motor.backEmfConstantMVRpm / 1000,
      torqueConstantNmPerA: motor.torqueConstantMNmA / 1000,
      terminalResistanceOhm: motor.terminalResistanceOhm,
    },
    operatingPoint: {
      speedMps: operatingPoint.speedMps,
      accelerationMps2: operatingPoint.accelerationMps2,
      yawRateRadS: operatingPoint.yawRateDegS * DEG_TO_RAD,
      yawAccelerationRadS2: operatingPoint.yawAccelerationDegS2 * DEG_TO_RAD,
    },
  };
}

function buildSideResult({ side, linearSpeedMps, linearAccelerationMps2, wheelForceN, normalized }) {
  const motorAngularSpeedRadS =
    (linearSpeedMps / normalized.vehicle.wheelRadiusM) * normalized.vehicle.gearRatio;
  const motorSpeedRpm = motorAngularSpeedRadS * RAD_PER_SEC_TO_RPM;
  const wheelTorqueNm = wheelForceN * normalized.vehicle.wheelRadiusM;
  const motorTorqueNm = wheelTorqueNm / normalized.vehicle.gearRatio;
  const motorCurrentA = motorTorqueNm / normalized.motor.torqueConstantNmPerA;
  const motorBackEmfV = motorSpeedRpm * normalized.motor.backEmfConstantVPerRpm;
  const motorTerminalVoltageV =
    motorBackEmfV + motorCurrentA * normalized.motor.terminalResistanceOhm;
  const motorDutyRatio = motorTerminalVoltageV / normalized.vehicle.supplyVoltageV;
  const motorDutyPercent = motorDutyRatio * 100;
  const motorOutputW = motorTorqueNm * motorAngularSpeedRadS;
  const motorLossW = motorCurrentA ** 2 * normalized.motor.terminalResistanceOhm;
  const batteryOutputW = motorTerminalVoltageV * motorCurrentA;
  const batteryCurrentA = batteryOutputW / normalized.vehicle.supplyVoltageV;

  return {
    side,
    linearSpeedMps,
    linearAccelerationMps2,
    wheelForceN,
    wheelTorqueNm,
    motorTorqueNm,
    motorSpeedRpm,
    motorBackEmfV,
    motorTerminalVoltageV,
    motorCurrentA,
    motorDutyRatio,
    motorDutyPercent,
    motorOutputW,
    motorLossW,
    batteryCurrentA,
    batteryOutputW,
  };
}

function buildWarnings(result) {
  const warnings = [];

  for (const side of [result.left, result.right]) {
    if (Math.abs(side.motorDutyPercent) > 100) {
      warnings.push(
        `${side.side}モータの必要 Duty 比が ${side.motorDutyPercent.toFixed(1)}% で、電源電圧では到達できません。`,
      );
    }

    if (side.batteryOutputW < 0) {
      warnings.push(`${side.side}モータは回生方向の電力になっています。`);
    }
  }

  return warnings;
}

export function calculateMotorOperatingPoint(input) {
  const normalized = normalizeInputs(input);

  const halfTrack = normalized.vehicle.trackWidthM / 2;
  const yawSpeedOffset = normalized.operatingPoint.yawRateRadS * halfTrack;
  const yawAccelerationOffset = normalized.operatingPoint.yawAccelerationRadS2 * halfTrack;
  const forceBias =
    normalized.vehicle.trackWidthM === 0
      ? 0
      : (normalized.vehicle.yawInertiaKgM2 * normalized.operatingPoint.yawAccelerationRadS2) /
        normalized.vehicle.trackWidthM;

  const left = buildSideResult({
    side: "左",
    linearSpeedMps: normalized.operatingPoint.speedMps - yawSpeedOffset,
    linearAccelerationMps2: normalized.operatingPoint.accelerationMps2 - yawAccelerationOffset,
    wheelForceN: normalized.vehicle.massKg * normalized.operatingPoint.accelerationMps2 * 0.5 - forceBias,
    normalized,
  });

  const right = buildSideResult({
    side: "右",
    linearSpeedMps: normalized.operatingPoint.speedMps + yawSpeedOffset,
    linearAccelerationMps2: normalized.operatingPoint.accelerationMps2 + yawAccelerationOffset,
    wheelForceN: normalized.vehicle.massKg * normalized.operatingPoint.accelerationMps2 * 0.5 + forceBias,
    normalized,
  });

  const totals = {
    motorOutputW: left.motorOutputW + right.motorOutputW,
    motorLossW: left.motorLossW + right.motorLossW,
    batteryCurrentA: left.batteryCurrentA + right.batteryCurrentA,
    batteryOutputW: left.batteryOutputW + right.batteryOutputW,
  };

  return {
    normalized,
    left,
    right,
    totals,
    warnings: buildWarnings({ left, right }),
  };
}
