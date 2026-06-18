// validation.js — required-response checks and form value readers.

export const requireValue = (value) =>
  value !== null && value !== undefined && String(value).trim() !== "";

export function getLikertValue(form, name) {
  const checked = form.querySelector(`input[name="${CSS.escape(name)}"]:checked`);
  return checked ? Number(checked.value) : null;
}

export function getSingleChoiceValue(form, name) {
  const checked = form.querySelector(`input[name="${CSS.escape(name)}"]:checked`);
  return checked ? checked.value : null;
}

// True if the participant was assigned at least one AI condition (C or H).
export function sawAnyAiCondition(state) {
  const byScenario = state?.assignment?.condition_by_scenario || {};
  return Object.values(byScenario).some((c) => c === "C" || c === "H");
}
