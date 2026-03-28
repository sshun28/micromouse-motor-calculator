export const SAVED_INPUTS_STORAGE_KEY = "micromouse-motor-calculator.saved-inputs";

function cloneInput(input) {
  return JSON.parse(JSON.stringify(input));
}

function normalizePresetRecord(record) {
  const name = typeof record?.name === "string" ? record.name.trim() : "";

  if (!name || typeof record?.input !== "object" || record.input === null) {
    return null;
  }

  return {
    name,
    input: cloneInput(record.input),
    savedAt: typeof record.savedAt === "string" ? record.savedAt : new Date(0).toISOString(),
  };
}

function readRawSavedInputs(storage) {
  const raw = storage.getItem(SAVED_INPUTS_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizePresetRecord).filter(Boolean);
  } catch {
    return [];
  }
}

function writeRawSavedInputs(storage, savedInputs) {
  storage.setItem(SAVED_INPUTS_STORAGE_KEY, JSON.stringify(savedInputs));
}

export function listSavedInputs(storage = globalThis.localStorage) {
  return readRawSavedInputs(storage).sort((left, right) => left.name.localeCompare(right.name, "ja"));
}

export function getSavedInput(name, storage = globalThis.localStorage) {
  const trimmedName = String(name ?? "").trim();

  if (!trimmedName) {
    return null;
  }

  return listSavedInputs(storage).find((savedInput) => savedInput.name === trimmedName) ?? null;
}

export function saveInput(name, input, storage = globalThis.localStorage) {
  const trimmedName = String(name ?? "").trim();

  if (!trimmedName) {
    throw new Error("保存名を入力してください。");
  }

  const savedInputs = listSavedInputs(storage);
  const nextRecord = {
    name: trimmedName,
    input: cloneInput(input),
    savedAt: new Date().toISOString(),
  };
  const existingIndex = savedInputs.findIndex((savedInput) => savedInput.name === trimmedName);
  const replaced = existingIndex >= 0;

  if (replaced) {
    savedInputs.splice(existingIndex, 1, nextRecord);
  } else {
    savedInputs.push(nextRecord);
  }

  writeRawSavedInputs(storage, savedInputs);

  return {
    replaced,
    savedInput: nextRecord,
  };
}

export function deleteSavedInput(name, storage = globalThis.localStorage) {
  const trimmedName = String(name ?? "").trim();

  if (!trimmedName) {
    return false;
  }

  const savedInputs = listSavedInputs(storage);
  const nextSavedInputs = savedInputs.filter((savedInput) => savedInput.name !== trimmedName);

  if (nextSavedInputs.length === savedInputs.length) {
    return false;
  }

  writeRawSavedInputs(storage, nextSavedInputs);
  return true;
}
