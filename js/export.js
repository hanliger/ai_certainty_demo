// export.js — JSON / CSV download + optional remote POST submit.

export function sanitizeFilenamePart(value) {
  return String(value || "unknown").trim().replace(/[^a-zA-Z0-9가-힣_-]/g, "_").slice(0, 80);
}

export function makeTimestampForFilename(date = new Date()) {
  return date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// trial-level long format: one row per trial. Demographics and manipulation-check
// values are repeated on every row of a participant for analysis convenience.
export function convertExperimentStateToCsv(state) {
  const headers = [
    "participant_id", "session_id", "experiment_id",
    "trial_index", "persona_id", "scenario_id", "condition", "stimulus_id",
    "selected_option", "selected_product_label", "decision_response_time_ms", "choice_reason",
    "decision_confidence", "trust_ai", "helpfulness_ai", "expertise_ai", "objectivity_ai",
    "perceived_uncertainty", "ai_influence",
    "trial_page_rendered_at_iso", "decision_clicked_at_iso", "total_trial_time_ms",
    "post_started_at_iso", "trial_completed_at_iso",
    "perceived_ai_certainty", "conclusion_clarity",
    "age_group", "gender", "gender_other", "education", "ai_use_frequency",
    "purchase_decision_experience", "medical_device_knowledge", "robotics_knowledge", "cafe_equipment_knowledge",
    "started_at_iso", "completed_at_iso"
  ];
  const rows = [headers];
  const mc = state.manipulation_check || {};
  const demo = state.demographics || {};
  for (const trial of state.trials || []) {
    const post = trial.post_answers || {};
    rows.push([
      state.participant_id, state.session_id, state.experiment_id,
      trial.trial_index, trial.persona_id, trial.scenario_id, trial.condition, trial.stimulus_id,
      trial.selected_option, trial.selected_product_label, trial.decision_response_time_ms, trial.choice_reason,
      post.decision_confidence, post.trust_ai, post.helpfulness_ai, post.expertise_ai, post.objectivity_ai,
      post.perceived_uncertainty, post.ai_influence,
      trial.trial_page_rendered_at_iso, trial.decision_clicked_at_iso, trial.total_trial_time_ms,
      trial.post_started_at_iso, trial.trial_completed_at_iso,
      mc.perceived_ai_certainty, mc.conclusion_clarity,
      demo.age_group, demo.gender, demo.gender_other, demo.education, demo.ai_use_frequency,
      demo.purchase_decision_experience, demo.medical_device_knowledge, demo.robotics_knowledge, demo.cafe_equipment_knowledge,
      state.started_at_iso, state.completed_at_iso
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function exportBaseName(state, config) {
  const prefix = sanitizeFilenamePart(config.download?.filename_prefix || "AIcertainty");
  return `${prefix}_${sanitizeFilenamePart(state.participant_id)}_${sanitizeFilenamePart(String(state.session_id).slice(0, 8))}_${makeTimestampForFilename(new Date())}`;
}

export function downloadJson(state, config) {
  const base = exportBaseName(state, config);
  const payload = { ...state, exported_at_iso: new Date().toISOString() };
  state.exported_at_iso = payload.exported_at_iso;
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }), `${base}.json`);
  return `${base}.json`;
}

export function downloadCsv(state, config) {
  const base = exportBaseName(state, config);
  // Prepend BOM so Excel reads UTF-8 Korean correctly.
  downloadBlob(new Blob(["﻿" + convertExperimentStateToCsv(state)], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
  return `${base}.csv`;
}

export function finalizeAndDownload(state, config) {
  const now = new Date();
  state.completed_at_iso = state.completed_at_iso || now.toISOString();
  state.exported_at_iso = now.toISOString();
  state.download_triggered_at_iso = now.toISOString();
  const json_filename = downloadJson(state, config);
  let csv_filename = null;
  setTimeout(() => { csv_filename = downloadCsv(state, config); }, 350);
  return { json_filename, csv_filename: `${exportBaseName(state, config)}.csv` };
}

// Optional remote submit. Returns the Response on success, throws on failure so
// the caller can fall back to file download.
export async function submitToRemote(state, remote) {
  if (!remote || !remote.submit_url) throw new Error("원격 저장 endpoint가 설정되어 있지 않습니다.");
  const payload = { ...state, exported_at_iso: new Date().toISOString() };
  const res = await fetch(remote.submit_url, {
    method: remote.method || "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`원격 저장 실패: HTTP ${res.status}`);
  state.remote_submitted_at_iso = payload.exported_at_iso;
  state.exported_at_iso = payload.exported_at_iso;
  return res;
}
