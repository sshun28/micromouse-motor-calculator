import { calculateMotorOperatingPoint } from "./calculator.mjs";

const form = document.querySelector("#calculator-form");
const resultsBody = document.querySelector("#results-body");
const warningsContainer = document.querySelector("#warnings");
const totalsContainer = document.querySelector("#totals");
const statusMessage = document.querySelector("#status-message");

const metricRows = [
  { label: "モータ回転数", unit: "rpm", key: "motorSpeedRpm", digits: 1 },
  { label: "モータ逆起電力", unit: "V", key: "motorBackEmfV", digits: 3 },
  { label: "モータ電流", unit: "A", key: "motorCurrentA", digits: 3 },
  { label: "モータ Duty 比", unit: "%", key: "motorDutyPercent", digits: 1 },
  { label: "モータ出力", unit: "W", key: "motorOutputW", digits: 3 },
  { label: "モータ損失", unit: "W", key: "motorLossW", digits: 3 },
  { label: "電池電流", unit: "A", key: "batteryCurrentA", digits: 3 },
  { label: "電池出力", unit: "W", key: "batteryOutputW", digits: 3 },
];

const totalCards = [
  { label: "合計モータ出力", unit: "W", key: "motorOutputW", digits: 3 },
  { label: "合計モータ損失", unit: "W", key: "motorLossW", digits: 3 },
  { label: "合計電池電流", unit: "A", key: "batteryCurrentA", digits: 3 },
  { label: "合計電池出力", unit: "W", key: "batteryOutputW", digits: 3 },
];

function readNumber(name) {
  return Number(form.elements.namedItem(name).value);
}

function readInput() {
  return {
    vehicle: {
      weightG: readNumber("weightG"),
      inertiaGmm2: readNumber("inertiaGmm2"),
      wheelDiameterMm: readNumber("wheelDiameterMm"),
      gearRatioNumerator: readNumber("gearRatioNumerator"),
      gearRatioDenominator: readNumber("gearRatioDenominator"),
      trackWidthMm: readNumber("trackWidthMm"),
      supplyVoltageV: readNumber("supplyVoltageV"),
    },
    motor: {
      backEmfConstantMVRpm: readNumber("backEmfConstantMVRpm"),
      torqueConstantMNmA: readNumber("torqueConstantMNmA"),
      terminalResistanceOhm: readNumber("terminalResistanceOhm"),
    },
    operatingPoint: {
      speedMps: readNumber("speedMps"),
      accelerationMps2: readNumber("accelerationMps2"),
      yawRateDegS: readNumber("yawRateDegS"),
      yawAccelerationDegS2: readNumber("yawAccelerationDegS2"),
    },
  };
}

function formatValue(value, digits) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function renderWarnings(warnings) {
  warningsContainer.innerHTML = "";

  if (warnings.length === 0) {
    const info = document.createElement("div");
    info.className = "warning-card";
    info.textContent = "入力条件で計算可能です。Duty 比や回生方向は必要に応じて確認してください。";
    warningsContainer.append(info);
    return;
  }

  warnings.forEach((warning) => {
    const card = document.createElement("div");
    card.className = "warning-card";
    card.textContent = warning;
    warningsContainer.append(card);
  });
}

function renderResults(result) {
  resultsBody.innerHTML = "";

  metricRows.forEach((metric) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        ${metric.label}
        <span class="metric-subtext">[${metric.unit}]</span>
      </td>
      <td>${formatValue(result.left[metric.key], metric.digits)}</td>
      <td>${formatValue(result.right[metric.key], metric.digits)}</td>
    `;
    resultsBody.append(row);
  });

  totalsContainer.innerHTML = "";
  totalCards.forEach((card) => {
    const element = document.createElement("article");
    element.className = "total-card";
    element.innerHTML = `
      <h3>${card.label}</h3>
      <p>${formatValue(result.totals[card.key], card.digits)} ${card.unit}</p>
    `;
    totalsContainer.append(element);
  });

  renderWarnings(result.warnings);
}

function calculateAndRender() {
  try {
    const result = calculateMotorOperatingPoint(readInput());
    renderResults(result);
    statusMessage.textContent = `計算完了: 減速比 ${result.normalized.vehicle.gearRatioNumerator}:${result.normalized.vehicle.gearRatioDenominator}`;
  } catch (error) {
    resultsBody.innerHTML = "";
    totalsContainer.innerHTML = "";
    warningsContainer.innerHTML = "";
    statusMessage.textContent = error instanceof Error ? error.message : "入力値を確認してください。";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateAndRender();
});

form.addEventListener("input", () => {
  calculateAndRender();
});

calculateAndRender();
