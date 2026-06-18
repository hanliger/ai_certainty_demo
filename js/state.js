// state.js — state creation, localStorage autosave/restore.
// No global mutable state lives here; the caller owns the state object.

export function createSessionId() {
  return crypto?.randomUUID
    ? crypto.randomUUID()
    : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createInitialState({ participantId, experimentId, assignment }) {
  return {
    experiment_id: experimentId,
    participant_id: participantId,
    session_id: createSessionId(),
    started_at_iso: new Date().toISOString(),
    consented_at_iso: null,
    completed_at_iso: null,
    exported_at_iso: null,
    download_triggered_at_iso: null,
    remote_submitted_at_iso: null,
    user_agent: navigator.userAgent,
    assignment,
    trials: [],
    manipulation_check: {},
    demographics: {},
    // Routing / resume bookkeeping.
    current_step: "consent",
    current_trial_index: 0,
    personas_seen: [],
    // The in-progress trial draft, persisted so a refresh mid-trial can resume.
    pending_trial: null
  };
}

export const saveState = (key, state) => {
  try { localStorage.setItem(key, JSON.stringify(state)); }
  catch (err) { console.warn("autosave 실패:", err); }
};

export function loadState(key) {
  try { return JSON.parse(localStorage.getItem(key)); }
  catch { return null; }
}

export const clearState = (key) => {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
};
