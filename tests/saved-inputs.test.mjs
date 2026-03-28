import test from "node:test";
import assert from "node:assert/strict";

import {
  SAVED_INPUTS_STORAGE_KEY,
  deleteSavedInput,
  getSavedInput,
  listSavedInputs,
  saveInput,
} from "../src/saved-inputs.mjs";

function createStorage(initialValues = {}) {
  const data = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

const sampleInput = {
  vehicle: {
    weightG: 30,
    inertiaGmm2: 5000,
    wheelDiameterMm: 13,
    pinionTeeth: 13,
    spurTeeth: 61,
    trackWidthMm: 35,
    supplyVoltageV: 9,
  },
  motor: {
    backEmfConstantMVRpm: 0.218,
    torqueConstantMNmA: 2.08,
    terminalResistanceOhm: 10,
  },
  operatingPoint: {
    speedMps: 7,
    accelerationMps2: 40,
    yawRateDegS: 0,
    yawAccelerationDegS2: 0,
  },
};

test("listSavedInputs returns an empty list when nothing is stored", () => {
  const storage = createStorage();

  assert.deepEqual(listSavedInputs(storage), []);
});

test("saveInput stores a named snapshot and trims the name", () => {
  const storage = createStorage();

  const result = saveInput("  テスト機  ", sampleInput, storage);
  const saved = getSavedInput("テスト機", storage);

  assert.equal(result.replaced, false);
  assert.equal(saved?.name, "テスト機");
  assert.deepEqual(saved?.input, sampleInput);
});

test("saveInput overwrites an existing snapshot with the same name", () => {
  const storage = createStorage();

  saveInput("セットA", sampleInput, storage);
  const updatedInput = {
    ...sampleInput,
    operatingPoint: {
      ...sampleInput.operatingPoint,
      speedMps: 8.5,
    },
  };

  const result = saveInput("セットA", updatedInput, storage);

  assert.equal(result.replaced, true);
  assert.equal(getSavedInput("セットA", storage)?.input.operatingPoint.speedMps, 8.5);
  assert.equal(listSavedInputs(storage).length, 1);
});

test("deleteSavedInput removes a stored snapshot by name", () => {
  const storage = createStorage();

  saveInput("削除対象", sampleInput, storage);

  assert.equal(deleteSavedInput("削除対象", storage), true);
  assert.equal(getSavedInput("削除対象", storage), null);
});

test("listSavedInputs ignores malformed storage payloads", () => {
  const storage = createStorage({
    [SAVED_INPUTS_STORAGE_KEY]: "{not-json",
  });

  assert.deepEqual(listSavedInputs(storage), []);
});

test("saveInput rejects blank names", () => {
  const storage = createStorage();

  assert.throws(() => saveInput("   ", sampleInput, storage), /保存名を入力してください/);
});
