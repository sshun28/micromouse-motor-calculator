import { calculateMotorOperatingPoint } from "./calculator.mjs";
import { buildMetricDetails, metricRows } from "./calculation-details.mjs";
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
const formulaDialog = document.querySelector("#formula-dialog");
const formulaDialogTitle = document.querySelector("#formula-dialog-title");
const formulaDialogOverview = document.querySelector("#formula-dialog-overview");
const formulaDialogShared = document.querySelector("#formula-dialog-shared");
const formulaDialogSides = document.querySelector("#formula-dialog-sides");
const formulaDialogCloseButton = document.querySelector("#formula-dialog-close");

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
let latestResult = null;
let activeMetricKey = "";

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

function renderFormula(expression, { displayMode = true } = {}) {
  const element = document.createElement("div");
  element.className = `formula-expression${displayMode ? " formula-expression-display" : ""}`;

  if (globalThis.katex?.renderToString) {
    element.innerHTML = globalThis.katex.renderToString(expression, {
      displayMode,
      throwOnError: false,
    });
    return element;
  }

  element.classList.add("formula-expression-fallback");
  element.textContent = expression;
  return element;
}

function createUnitBadge(unit) {
  const badge = document.createElement("span");
  badge.className = "formula-unit";
  badge.textContent = unit;
  return badge;
}

function renderFormulaDialog(metricKey) {
  if (!(formulaDialog instanceof HTMLDialogElement) || !latestResult) {
    return;
  }

  const details = buildMetricDetails(latestResult, metricKey);

  if (!details) {
    return;
  }

  formulaDialogTitle.textContent = `${details.label} の計算の流れ`;
  formulaDialogOverview.textContent = details.overview;

  formulaDialogShared.innerHTML = "";
  details.sharedSymbols.forEach((symbol) => {
    const item = document.createElement("article");
    item.className = "shared-symbol-card";

    const heading = document.createElement("div");
    heading.className = "shared-symbol-heading";

    const label = document.createElement("strong");
    label.textContent = symbol.label;
    heading.append(label, createUnitBadge(symbol.unit));

    item.append(heading, renderFormula(symbol.formula), renderFormula(symbol.substitution));
    formulaDialogShared.append(item);
  });

  formulaDialogSides.innerHTML = "";
  details.sides.forEach((side) => {
    const section = document.createElement("section");
    section.className = "formula-side";

    const header = document.createElement("div");
    header.className = "formula-side-header";

    const heading = document.createElement("h4");
    heading.textContent = `${side.side}モータ`;

    const value = document.createElement("p");
    value.className = "formula-side-value";
    value.textContent = `${side.value} ${side.unit}`;

    header.append(heading, value);

    const list = document.createElement("ol");
    list.className = "formula-steps";

    side.steps.forEach((step) => {
      const item = document.createElement("li");
      item.className = "formula-step";

      const stepHeader = document.createElement("div");
      stepHeader.className = "formula-step-header";

      const label = document.createElement("strong");
      label.textContent = step.label;
      stepHeader.append(label, createUnitBadge(step.unit));

      item.append(stepHeader, renderFormula(step.formula), renderFormula(step.substitution));
      list.append(item);
    });

    section.append(header, list);
    formulaDialogSides.append(section);
  });

  activeMetricKey = metricKey;

  if (!formulaDialog.open) {
    if (typeof formulaDialog.showModal === "function") {
      formulaDialog.showModal();
    } else {
      formulaDialog.setAttribute("open", "open");
    }
  }
}

function renderResults(result) {
  resultsBody.innerHTML = "";
  latestResult = result;

  metricRows.forEach((metric) => {
    const row = document.createElement("tr");
    const leftClass = metric.key === "motorDutyPercent" ? getDutySeverityClass(result.left[metric.key]) : "";
    const rightClass = metric.key === "motorDutyPercent" ? getDutySeverityClass(result.right[metric.key]) : "";
    row.innerHTML = `
      <td>
        <div class="metric-label-row">
          <div>
            ${metric.label}
            <span class="metric-subtext">[${metric.unit}]</span>
          </div>
          <button
            class="metric-help-button"
            type="button"
            data-metric-key="${metric.key}"
            aria-label="${metric.label}の計算の流れを表示"
            title="${metric.label}の計算の流れを表示"
          >
            ?
          </button>
        </div>
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
    if (activeMetricKey && formulaDialog instanceof HTMLDialogElement && formulaDialog.open) {
      renderFormulaDialog(activeMetricKey);
    }
    calcStatusMessage.textContent = "";
  } catch (error) {
    latestResult = null;
    activeMetricKey = "";
    resultsBody.innerHTML = "";
    totalsContainer.innerHTML = "";
    if (formulaDialog instanceof HTMLDialogElement && formulaDialog.open) {
      formulaDialog.close();
    }
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

resultsBody.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest(".metric-help-button");

  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  renderFormulaDialog(button.dataset.metricKey ?? "");
});

formulaDialogCloseButton?.addEventListener("click", () => {
  if (formulaDialog instanceof HTMLDialogElement && formulaDialog.open) {
    activeMetricKey = "";
    formulaDialog.close();
  }
});

formulaDialog?.addEventListener("click", (event) => {
  if (event.target === formulaDialog && formulaDialog instanceof HTMLDialogElement && formulaDialog.open) {
    activeMetricKey = "";
    formulaDialog.close();
  }
});

refreshSavedInputOptions();
calculateAndRender();
