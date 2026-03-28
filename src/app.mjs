import { calculateMotorOperatingPoint } from "./calculator.mjs";

const form = document.querySelector("#calculator-form");
const resultsBody = document.querySelector("#results-body");
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
      pinionTeeth: readNumber("pinionTeeth"),
      spurTeeth: readNumber("spurTeeth"),
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

function getDutySeverityClass(value) {
  const duty = Math.abs(value);

  if (duty >= 100) {
    return "metric-value metric-value-danger";
  }

  if (duty >= 80) {
    return "metric-value metric-value-warning";
  }

  return "metric-value";
}

function renderResults(result) {
  resultsBody.innerHTML = "";

  metricRows.forEach((metric) => {
    const row = document.createElement("tr");
    const leftClass = metric.key === "motorDutyPercent" ? getDutySeverityClass(result.left[metric.key]) : "";
    const rightClass = metric.key === "motorDutyPercent" ? getDutySeverityClass(result.right[metric.key]) : "";
    row.innerHTML = `
      <td>
        ${metric.label}
        <span class="metric-subtext">[${metric.unit}]</span>
      </td>
      <td><span class="${leftClass}">${formatValue(result.left[metric.key], metric.digits)}</span></td>
      <td><span class="${rightClass}">${formatValue(result.right[metric.key], metric.digits)}</span></td>
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
}

function calculateAndRender() {
  try {
    const result = calculateMotorOperatingPoint(readInput());
    renderResults(result);
    statusMessage.textContent = "";
  } catch (error) {
    resultsBody.innerHTML = "";
    totalsContainer.innerHTML = "";
    statusMessage.textContent = error instanceof Error ? error.message : "入力値を確認してください。";
  }
}

form.addEventListener("input", () => {
  calculateAndRender();
});

calculateAndRender();
