import { calculateMotorOperatingPoint } from "./calculator.mjs";
import { deleteSavedInput, getSavedInput, listSavedInputs, saveInput } from "./saved-inputs.mjs";

const form = document.querySelector("#calculator-form");
const resultsBody = document.querySelector("#results-body");
const totalsContainer = document.querySelector("#totals");
const calcStatusMessage = document.querySelector("#calc-status-message");
const savedStatusMessage = document.querySelector("#saved-status-message");
const savedInputNameField = document.querySelector("#saved-input-name");
const savedInputSelect = document.querySelector("#saved-input-select");
const saveInputButton = document.querySelector("#save-input-button");
const loadInputButton = document.querySelector("#load-input-button");
const deleteInputButton = document.querySelector("#delete-input-button");

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

const inputFieldNames = [
  "weightG",
  "inertiaGmm2",
  "wheelDiameterMm",
  "pinionTeeth",
  "spurTeeth",
  "trackWidthMm",
  "supplyVoltageV",
  "backEmfConstantMVRpm",
  "torqueConstantMNmA",
  "terminalResistanceOhm",
  "speedMps",
  "accelerationMps2",
  "yawRateDegS",
  "yawAccelerationDegS2",
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

function writeInput(input) {
  const fields = {
    weightG: input?.vehicle?.weightG,
    inertiaGmm2: input?.vehicle?.inertiaGmm2,
    wheelDiameterMm: input?.vehicle?.wheelDiameterMm,
    pinionTeeth: input?.vehicle?.pinionTeeth,
    spurTeeth: input?.vehicle?.spurTeeth,
    trackWidthMm: input?.vehicle?.trackWidthMm,
    supplyVoltageV: input?.vehicle?.supplyVoltageV,
    backEmfConstantMVRpm: input?.motor?.backEmfConstantMVRpm,
    torqueConstantMNmA: input?.motor?.torqueConstantMNmA,
    terminalResistanceOhm: input?.motor?.terminalResistanceOhm,
    speedMps: input?.operatingPoint?.speedMps,
    accelerationMps2: input?.operatingPoint?.accelerationMps2,
    yawRateDegS: input?.operatingPoint?.yawRateDegS,
    yawAccelerationDegS2: input?.operatingPoint?.yawAccelerationDegS2,
  };

  inputFieldNames.forEach((name) => {
    const element = form.elements.namedItem(name);

    if (!(element instanceof HTMLInputElement) || !Object.prototype.hasOwnProperty.call(fields, name)) {
      return;
    }

    element.value = String(fields[name] ?? "");
  });
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

function setSavedStatus(message) {
  savedStatusMessage.textContent = message;
}

function getSelectedSavedInputName() {
  return savedInputSelect.value.trim();
}

function refreshSavedInputOptions(selectedName = "") {
  const savedInputs = listSavedInputs();

  savedInputSelect.innerHTML = "";

  if (savedInputs.length === 0) {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "保存済み条件はありません";
    savedInputSelect.append(emptyOption);
    savedInputSelect.disabled = true;
    loadInputButton.disabled = true;
    deleteInputButton.disabled = true;
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "保存済み条件を選択";
  savedInputSelect.append(placeholder);

  savedInputs.forEach((savedInput) => {
    const option = document.createElement("option");
    option.value = savedInput.name;
    option.textContent = savedInput.name;
    savedInputSelect.append(option);
  });

  savedInputSelect.disabled = false;
  loadInputButton.disabled = false;
  deleteInputButton.disabled = false;

  if (selectedName && savedInputs.some((savedInput) => savedInput.name === selectedName)) {
    savedInputSelect.value = selectedName;
  }
}

function calculateAndRender() {
  try {
    const result = calculateMotorOperatingPoint(readInput());
    renderResults(result);
    calcStatusMessage.textContent = "";
  } catch (error) {
    resultsBody.innerHTML = "";
    totalsContainer.innerHTML = "";
    calcStatusMessage.textContent = error instanceof Error ? error.message : "入力値を確認してください。";
  }
}

form.addEventListener("input", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement) || !inputFieldNames.includes(target.getAttribute("name") ?? "")) {
    return;
  }

  calculateAndRender();
});

savedInputSelect.addEventListener("change", () => {
  savedInputNameField.value = getSelectedSavedInputName();
});

saveInputButton.addEventListener("click", () => {
  try {
    const name = savedInputNameField.value.trim();
    const { replaced, savedInput } = saveInput(name, readInput());
    refreshSavedInputOptions(savedInput.name);
    savedInputNameField.value = savedInput.name;
    setSavedStatus(replaced ? `「${savedInput.name}」を上書き保存しました。` : `「${savedInput.name}」を保存しました。`);
  } catch (error) {
    setSavedStatus(error instanceof Error ? error.message : "保存に失敗しました。");
  }
});

loadInputButton.addEventListener("click", () => {
  try {
    const name = getSelectedSavedInputName();
    const savedInput = getSavedInput(name);

    if (!savedInput) {
      setSavedStatus("呼び出す保存条件を選択してください。");
      return;
    }

    writeInput(savedInput.input);
    savedInputNameField.value = savedInput.name;
    calculateAndRender();
    setSavedStatus(`「${savedInput.name}」を呼び出しました。`);
  } catch (error) {
    setSavedStatus(error instanceof Error ? error.message : "呼び出しに失敗しました。");
  }
});

deleteInputButton.addEventListener("click", () => {
  try {
    const name = getSelectedSavedInputName();

    if (!name) {
      setSavedStatus("削除する保存条件を選択してください。");
      return;
    }

    if (!deleteSavedInput(name)) {
      setSavedStatus("削除対象が見つかりませんでした。");
      refreshSavedInputOptions();
      return;
    }

    refreshSavedInputOptions();

    if (savedInputNameField.value.trim() === name) {
      savedInputNameField.value = "";
    }

    setSavedStatus(`「${name}」を削除しました。`);
  } catch (error) {
    setSavedStatus(error instanceof Error ? error.message : "削除に失敗しました。");
  }
});

refreshSavedInputOptions();
calculateAndRender();
