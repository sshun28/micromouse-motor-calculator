export const metricRows = [
  { label: "モータ回転数", unit: "rpm", key: "motorSpeedRpm", digits: 1 },
  { label: "モータ逆起電力", unit: "V", key: "motorBackEmfV", digits: 3 },
  { label: "モータ電流", unit: "A", key: "motorCurrentA", digits: 3 },
  { label: "モータ Duty 比", unit: "%", key: "motorDutyPercent", digits: 1 },
  { label: "モータ出力", unit: "W", key: "motorOutputW", digits: 3 },
  { label: "モータ損失", unit: "W", key: "motorLossW", digits: 3 },
  { label: "電池電流", unit: "A", key: "batteryCurrentA", digits: 3 },
  { label: "電池出力", unit: "W", key: "batteryOutputW", digits: 3 },
];

const metricDefinitions = {
  motorSpeedRpm: {
    overview: "車速とヨー角速度から左右輪の線速度を求め、それをホイール半径と減速比でモータ回転数に変換します。",
    createSteps(side, context) {
      return [buildLinearSpeedStep(side, context), buildMotorSpeedStep(side, context)];
    },
  },
  motorBackEmfV: {
    overview: "モータ回転数に発生電圧定数を掛けて、逆起電力を計算します。",
    createSteps(side, context) {
      return [buildLinearSpeedStep(side, context), buildMotorSpeedStep(side, context), buildBackEmfStep(side, context)];
    },
  },
  motorCurrentA: {
    overview: "加速度とヨー角加速度から左右輪の駆動力を求め、ホイールトルクと減速比を介してモータ電流へ変換します。",
    createSteps(side, context) {
      return buildMotorCurrentFlow(side, context);
    },
  },
  motorDutyPercent: {
    overview: "逆起電力と巻線抵抗による電圧降下から端子電圧を求め、電源電圧に対する比率を Duty 比として表示します。",
    createSteps(side, context) {
      return [
        ...buildMotorCurrentFlow(side, context),
        buildLinearSpeedStep(side, context),
        buildMotorSpeedStep(side, context),
        buildBackEmfStep(side, context),
        buildTerminalVoltageStep(side, context),
        buildDutyStep(side, context),
      ];
    },
  },
  motorOutputW: {
    overview: "モータトルクとモータ角速度の積として機械出力を計算します。",
    createSteps(side, context) {
      return [
        ...buildMotorCurrentFlow(side, context),
        buildLinearSpeedStep(side, context),
        buildMotorAngularSpeedStep(side, context),
        buildMotorOutputStep(side, context),
      ];
    },
  },
  motorLossW: {
    overview: "モータ電流の二乗に端子間抵抗を掛けて、銅損を計算します。",
    createSteps(side, context) {
      return [...buildMotorCurrentFlow(side, context), buildMotorLossStep(side, context)];
    },
  },
  batteryCurrentA: {
    overview: "端子電圧とモータ電流から電池出力を求め、それを電源電圧で割って電池電流に変換します。",
    createSteps(side, context) {
      return [
        ...buildMotorCurrentFlow(side, context),
        buildLinearSpeedStep(side, context),
        buildMotorSpeedStep(side, context),
        buildBackEmfStep(side, context),
        buildTerminalVoltageStep(side, context),
        buildBatteryOutputStep(side, context),
        buildBatteryCurrentStep(side, context),
      ];
    },
  },
  batteryOutputW: {
    overview: "モータ端子電圧とモータ電流の積として、電池から見た出力を計算します。",
    createSteps(side, context) {
      return [
        ...buildMotorCurrentFlow(side, context),
        buildLinearSpeedStep(side, context),
        buildMotorSpeedStep(side, context),
        buildBackEmfStep(side, context),
        buildTerminalVoltageStep(side, context),
        buildBatteryOutputStep(side, context),
      ];
    },
  },
};

function formatFixed(value, digits) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(digits);
}

function formatDisplayValue(value, digits) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatSignedTerm(value, digits) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign} ${formatFixed(Math.abs(value), digits)}`;
}

function getContext(result) {
  const normalized = result.normalized;
  const halfTrackM = normalized.vehicle.trackWidthM / 2;
  const yawSpeedOffsetMps = normalized.operatingPoint.yawRateRadS * halfTrackM;
  const yawForceBiasN =
    normalized.vehicle.trackWidthM === 0
      ? 0
      : (normalized.vehicle.yawInertiaKgM2 * normalized.operatingPoint.yawAccelerationRadS2) /
        normalized.vehicle.trackWidthM;

  return {
    normalized,
    halfTrackM,
    yawSpeedOffsetMps,
    yawForceBiasN,
  };
}

function buildSharedSymbols(context) {
  const { normalized, halfTrackM } = context;

  return [
    {
      label: "ホイール半径",
      formula: `r_w = \\frac{d_w}{2}`,
      substitution: `r_w = \\frac{${formatFixed(normalized.vehicle.wheelRadiusM * 2 * 1000, 3)}}{2000} = ${formatFixed(normalized.vehicle.wheelRadiusM, 6)}`,
      unit: "m",
    },
    {
      label: "減速比",
      formula: `G = \\frac{N_{spur}}{N_{pinion}}`,
      substitution: `G = \\frac{${formatFixed(normalized.vehicle.spurTeeth, 0)}}{${formatFixed(normalized.vehicle.pinionTeeth, 0)}} = ${formatFixed(normalized.vehicle.gearRatio, 6)}`,
      unit: "-",
    },
    {
      label: "半トレッド幅",
      formula: `\\frac{T}{2}`,
      substitution: `\\frac{T}{2} = \\frac{${formatFixed(normalized.vehicle.trackWidthM, 6)}}{2} = ${formatFixed(halfTrackM, 6)}`,
      unit: "m",
    },
    {
      label: "発生電圧定数",
      formula: `K_e`,
      substitution: `K_e = ${formatFixed(normalized.motor.backEmfConstantVPerRpm, 6)}`,
      unit: "V/rpm",
    },
    {
      label: "トルク定数",
      formula: `K_t`,
      substitution: `K_t = ${formatFixed(normalized.motor.torqueConstantNmPerA, 6)}`,
      unit: "N·m/A",
    },
    {
      label: "端子間抵抗",
      formula: `R`,
      substitution: `R = ${formatFixed(normalized.motor.terminalResistanceOhm, 6)}`,
      unit: "Ω",
    },
  ];
}

function buildLinearSpeedStep(side, context) {
  const term = side.side === "左" ? -context.yawSpeedOffsetMps : context.yawSpeedOffsetMps;

  return {
    label: "左右輪の線速度",
    formula: `v_{wheel} = v \\pm \\omega_z \\cdot \\frac{T}{2}`,
    substitution: `v_{wheel} = ${formatFixed(context.normalized.operatingPoint.speedMps, 6)} ${formatSignedTerm(term, 6)} = ${formatFixed(side.linearSpeedMps, 6)}`,
    unit: "m/s",
  };
}

function buildMotorSpeedStep(side, context) {
  return {
    label: "モータ回転数",
    formula: `n_m = \\frac{v_{wheel}}{r_w} \\cdot G \\cdot \\frac{60}{2\\pi}`,
    substitution: `n_m = \\frac{${formatFixed(side.linearSpeedMps, 6)}}{${formatFixed(context.normalized.vehicle.wheelRadiusM, 6)}} \\cdot ${formatFixed(context.normalized.vehicle.gearRatio, 6)} \\cdot \\frac{60}{2\\pi} = ${formatFixed(side.motorSpeedRpm, 3)}`,
    unit: "rpm",
  };
}

function buildMotorAngularSpeedStep(side, context) {
  return {
    label: "モータ角速度",
    formula: `\\omega_m = \\frac{v_{wheel}}{r_w} \\cdot G`,
    substitution: `\\omega_m = \\frac{${formatFixed(side.linearSpeedMps, 6)}}{${formatFixed(context.normalized.vehicle.wheelRadiusM, 6)}} \\cdot ${formatFixed(context.normalized.vehicle.gearRatio, 6)} = ${formatFixed((side.motorSpeedRpm * 2 * Math.PI) / 60, 6)}`,
    unit: "rad/s",
  };
}

function buildYawForceBiasStep(context) {
  return {
    label: "ヨー由来の左右差荷重",
    formula: `\\Delta F_{yaw} = \\frac{I_z \\alpha_z}{T}`,
    substitution: `\\Delta F_{yaw} = \\frac{${formatFixed(context.normalized.vehicle.yawInertiaKgM2, 9)} \\cdot ${formatFixed(context.normalized.operatingPoint.yawAccelerationRadS2, 6)}}{${formatFixed(context.normalized.vehicle.trackWidthM, 6)}} = ${formatFixed(context.yawForceBiasN, 6)}`,
    unit: "N",
  };
}

function buildWheelForceStep(side, context) {
  const halfForce = context.normalized.vehicle.massKg * context.normalized.operatingPoint.accelerationMps2 * 0.5;
  const yawTerm = side.side === "左" ? -context.yawForceBiasN : context.yawForceBiasN;

  return {
    label: `${side.side}輪の駆動力`,
    formula: `F_{wheel} = \\frac{m a}{2} \\pm \\Delta F_{yaw}`,
    substitution: `F_{wheel} = ${formatFixed(halfForce, 6)} ${formatSignedTerm(yawTerm, 6)} = ${formatFixed(side.wheelForceN, 6)}`,
    unit: "N",
  };
}

function buildWheelTorqueStep(side, context) {
  return {
    label: "ホイールトルク",
    formula: `\\tau_w = F_{wheel} \\cdot r_w`,
    substitution: `\\tau_w = ${formatFixed(side.wheelForceN, 6)} \\cdot ${formatFixed(context.normalized.vehicle.wheelRadiusM, 6)} = ${formatFixed(side.wheelTorqueNm, 6)}`,
    unit: "N·m",
  };
}

function buildMotorTorqueStep(side, context) {
  return {
    label: "モータトルク",
    formula: `\\tau_m = \\frac{\\tau_w}{G}`,
    substitution: `\\tau_m = \\frac{${formatFixed(side.wheelTorqueNm, 6)}}{${formatFixed(context.normalized.vehicle.gearRatio, 6)}} = ${formatFixed(side.motorTorqueNm, 6)}`,
    unit: "N·m",
  };
}

function buildBackEmfStep(side, context) {
  return {
    label: "モータ逆起電力",
    formula: `E = n_m \\cdot K_e`,
    substitution: `E = ${formatFixed(side.motorSpeedRpm, 3)} \\cdot ${formatFixed(context.normalized.motor.backEmfConstantVPerRpm, 6)} = ${formatFixed(side.motorBackEmfV, 6)}`,
    unit: "V",
  };
}

function buildCurrentStep(side, context) {
  return {
    label: "モータ電流",
    formula: `I_m = \\frac{\\tau_m}{K_t}`,
    substitution: `I_m = \\frac{${formatFixed(side.motorTorqueNm, 6)}}{${formatFixed(context.normalized.motor.torqueConstantNmPerA, 6)}} = ${formatFixed(side.motorCurrentA, 6)}`,
    unit: "A",
  };
}

function buildTerminalVoltageStep(side, context) {
  return {
    label: "モータ端子電圧",
    formula: `V_t = E + I_m R`,
    substitution: `V_t = ${formatFixed(side.motorBackEmfV, 6)} + (${formatFixed(side.motorCurrentA, 6)} \\cdot ${formatFixed(context.normalized.motor.terminalResistanceOhm, 6)}) = ${formatFixed(side.motorTerminalVoltageV, 6)}`,
    unit: "V",
  };
}

function buildDutyStep(side, context) {
  return {
    label: "モータ Duty 比",
    formula: `Duty[\\%] = \\frac{V_t}{V_s} \\cdot 100`,
    substitution: `Duty = \\frac{${formatFixed(side.motorTerminalVoltageV, 6)}}{${formatFixed(context.normalized.vehicle.supplyVoltageV, 6)}} \\cdot 100 = ${formatFixed(side.motorDutyPercent, 3)}`,
    unit: "%",
  };
}

function buildMotorOutputStep(side) {
  const motorAngularSpeedRadS = (side.motorSpeedRpm * 2 * Math.PI) / 60;

  return {
    label: "モータ出力",
    formula: `P_m = \\tau_m \\cdot \\omega_m`,
    substitution: `P_m = ${formatFixed(side.motorTorqueNm, 6)} \\cdot ${formatFixed(motorAngularSpeedRadS, 6)} = ${formatFixed(side.motorOutputW, 6)}`,
    unit: "W",
  };
}

function buildMotorLossStep(side, context) {
  return {
    label: "モータ損失",
    formula: `P_{loss} = I_m^2 R`,
    substitution: `P_{loss} = (${formatFixed(side.motorCurrentA, 6)})^2 \\cdot ${formatFixed(context.normalized.motor.terminalResistanceOhm, 6)} = ${formatFixed(side.motorLossW, 6)}`,
    unit: "W",
  };
}

function buildBatteryOutputStep(side) {
  return {
    label: "電池出力",
    formula: `P_b = V_t \\cdot I_m`,
    substitution: `P_b = ${formatFixed(side.motorTerminalVoltageV, 6)} \\cdot ${formatFixed(side.motorCurrentA, 6)} = ${formatFixed(side.batteryOutputW, 6)}`,
    unit: "W",
  };
}

function buildBatteryCurrentStep(side, context) {
  return {
    label: "電池電流",
    formula: `I_b = \\frac{P_b}{V_s}`,
    substitution: `I_b = \\frac{${formatFixed(side.batteryOutputW, 6)}}{${formatFixed(context.normalized.vehicle.supplyVoltageV, 6)}} = ${formatFixed(side.batteryCurrentA, 6)}`,
    unit: "A",
  };
}

function buildMotorCurrentFlow(side, context) {
  return [
    buildYawForceBiasStep(context),
    buildWheelForceStep(side, context),
    buildWheelTorqueStep(side, context),
    buildMotorTorqueStep(side, context),
    buildCurrentStep(side, context),
  ];
}

export function getMetricRow(metricKey) {
  return metricRows.find((metric) => metric.key === metricKey) ?? null;
}

export function buildMetricDetails(result, metricKey) {
  const metric = getMetricRow(metricKey);
  const definition = metricDefinitions[metricKey];

  if (!metric || !definition) {
    return null;
  }

  const context = getContext(result);

  return {
    key: metric.key,
    label: metric.label,
    unit: metric.unit,
    overview: definition.overview,
    sharedSymbols: buildSharedSymbols(context),
    sides: [result.left, result.right].map((side) => ({
      side: side.side,
      value: formatDisplayValue(side[metric.key], metric.digits),
      unit: metric.unit,
      steps: definition.createSteps(side, context),
    })),
  };
}
