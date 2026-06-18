// app.js — routing and rendering for the AI-certainty purchase-decision experiment.
import { createInitialState, saveState, loadState, clearState } from "./state.js";
import { buildAssignment } from "./randomization.js";
import { markTrialRendered, decisionTiming, totalTrialTimeMs, nowPerf, nowIso } from "./timing.js";
import { getLikertValue, getSingleChoiceValue, requireValue, sawAnyAiCondition } from "./validation.js";
import {
  finalizeAndDownload, downloadJson, downloadCsv, submitToRemote
} from "./export.js";

const app = document.querySelector("#app");
const liveRegion = document.querySelector("#live");
const data = {};
let state = null;

// --- tiny helpers -----------------------------------------------------------
const h = (strings, ...values) => strings.map((s, i) => s + (values[i] ?? "")).join("");
const e = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

async function loadJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} 로드 실패 (HTTP ${res.status})`);
  return res.json();
}

const personaById = (id) => data.personas.find((p) => p.id === id);
const scenarioById = (id) => data.scenarios.find((s) => s.id === id);
const persist = () => { if (state) saveState(data.config.autosave.local_storage_key, state); };
const announce = (msg) => { if (liveRegion) liveRegion.textContent = msg; };

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function totalTrials() { return state.assignment.trial_order.length; }
function scenarioAt(i) { return scenarioById(state.assignment.trial_order[i]); }
function isFirstOfPersona(i) {
  if (i === 0) return true;
  return scenarioAt(i).persona_id !== scenarioAt(i - 1).persona_id;
}
function logEvent(trial, event, extra = {}) {
  trial.event_log = trial.event_log || [];
  trial.event_log.push({ event, iso: nowIso(), t: nowPerf(), ...extra });
}

// --- boot -------------------------------------------------------------------
async function boot() {
  [data.config, data.personas, data.scenarios, data.questions, data.consent, data.instructions] =
    await Promise.all([
      loadJson("data/experiment.config.json"),
      loadJson("data/personas.json"),
      loadJson("data/scenarios.json"),
      loadJson("data/questions.json"),
      loadJson("content/consent.json"),
      loadJson("content/instructions.json")
    ]);
  renderLanding(loadState(data.config.autosave.local_storage_key));
}

// route an in-progress (resumed) state to the right screen
function route() {
  switch (state.current_step) {
    case "consent": return renderConsent();
    case "instructions": return renderInstructions();
    case "persona_intro": return renderPersonaIntro();
    case "trial": return renderTrialDecision();
    case "post": return renderPostTrial();
    case "manipulation": return renderManipulationCheck();
    case "demographics": return renderDemographics();
    case "completion": return renderCompletion();
    default: return renderTrialDecision();
  }
}

// --- A. Landing -------------------------------------------------------------
function renderLanding(saved) {
  app.innerHTML = h`
    <header class="hero">
      <h1>${e(data.config.experiment_title)}</h1>
      <p class="lead">본 실험에서는 <strong>총 ${data.config.scenario_order.length}개의 구매 의사결정</strong>(3개 역할 × 각 3개 시나리오)을 수행하게 됩니다.</p>
    </header>
    <section class="card">
      <p>각 의사결정에서 제품 비교표와 추가 정보를 확인하고, 가장 적절하다고 생각하는 제품을 선택해 주세요. 정답은 없습니다.</p>
      <div class="row">
        <button id="startBtn">실험 시작</button>
        ${saved ? `<button id="resumeBtn" class="secondary">저장된 실험 이어하기</button>` : ""}
      </div>
      ${saved ? `<p class="small">이전에 진행하던 응답(${e(saved.participant_id)})이 저장되어 있습니다.</p>
        <button id="discardBtn" class="link-btn">저장본 삭제하고 새로 시작</button>` : ""}
    </section>`;
  document.querySelector("#startBtn").addEventListener("click", () => renderParticipantId());
  document.querySelector("#resumeBtn")?.addEventListener("click", () => {
    state = saved;
    announce("저장된 실험을 이어서 진행합니다.");
    route();
  });
  document.querySelector("#discardBtn")?.addEventListener("click", () => {
    clearState(data.config.autosave.local_storage_key);
    renderLanding(null);
  });
  announce("실험 시작 화면입니다.");
}

// --- B. Participant ID ------------------------------------------------------
function renderParticipantId() {
  app.innerHTML = h`
    <section class="card stack">
      <h2>실험 대상 ID 입력</h2>
      <label for="participantId"><strong>참가자 ID</strong> (필수)</label>
      <input id="participantId" type="text" autocomplete="off" inputmode="text"
        placeholder="예: S001" aria-describedby="pidHelp" />
      <p id="pidHelp" class="small">영문·숫자·한글·하이픈(-)·언더스코어(_) 사용 가능. 앞뒤 공백은 자동 제거됩니다.</p>
      <p id="pidError" class="error hidden" role="alert"></p>
      <div class="row">
        <button id="toConsentBtn">다음</button>
        <button id="backLandingBtn" class="secondary">이전</button>
      </div>
    </section>`;
  const input = document.querySelector("#participantId");
  input.focus();
  const submit = () => {
    const participantId = input.value.trim();
    if (!requireValue(participantId)) return showError(document.querySelector("#pidError"), "실험 대상 ID를 입력해 주세요.");
    if (!/^[\w가-힣-]+$/u.test(participantId))
      return showError(document.querySelector("#pidError"), "허용되지 않는 문자가 포함되어 있습니다. (영문/숫자/한글/-/_ 만 가능)");
    const assignment = buildAssignment({ participantId, config: data.config, scenarios: data.scenarios });
    state = createInitialState({ participantId, experimentId: data.config.experiment_id, assignment });
    state.current_step = "consent";
    persist();
    renderConsent();
  };
  document.querySelector("#toConsentBtn").addEventListener("click", submit);
  input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") submit(); });
  document.querySelector("#backLandingBtn").addEventListener("click", () => renderLanding(loadState(data.config.autosave.local_storage_key)));
}

// --- C. Consent -------------------------------------------------------------
function renderConsent() {
  app.innerHTML = h`
    <section class="card stack">
      <h2>${e(data.consent.title)}</h2>
      ${data.consent.body.map((p) => `<p>${e(p)}</p>`).join("")}
      <label class="row consent-row">
        <input type="checkbox" id="consentCheck" />
        <span>${e(data.consent.checkbox_label)}</span>
      </label>
      <p id="consentError" class="error hidden" role="alert"></p>
      <div class="row">
        <button id="toInstructionsBtn" disabled>동의하고 계속</button>
      </div>
    </section>`;
  const check = document.querySelector("#consentCheck");
  const btn = document.querySelector("#toInstructionsBtn");
  check.addEventListener("change", () => { btn.disabled = !check.checked; });
  btn.addEventListener("click", () => {
    if (!check.checked) return showError(document.querySelector("#consentError"), "연구 참여 동의가 필요합니다.");
    state.consented_at_iso = new Date().toISOString();
    state.current_step = "instructions";
    persist();
    renderInstructions();
  });
}

// --- D. Instructions --------------------------------------------------------
function renderInstructions() {
  const ins = data.instructions;
  app.innerHTML = h`
    <section class="card stack">
      <h2>${e(ins.title)}</h2>
      <ol class="steps">${ins.steps.map((s) => `<li>${e(s)}</li>`).join("")}</ol>
      <p class="notice">${e(ins.timing_notice)}</p>
      <p class="notice">${e(ins.download_notice)}</p>
      <div class="row"><button id="toTrialsBtn">시작하기</button></div>
    </section>`;
  document.querySelector("#toTrialsBtn").addEventListener("click", () => {
    state.current_trial_index = 0;
    enterTrialIndex();
  });
}

// Decide whether to show a persona intro or go straight to the decision page.
function enterTrialIndex() {
  const scenario = scenarioAt(state.current_trial_index);
  if (isFirstOfPersona(state.current_trial_index) && !state.personas_seen.includes(scenario.persona_id)) {
    state.current_step = "persona_intro";
    persist();
    renderPersonaIntro();
  } else {
    state.current_step = "trial";
    persist();
    renderTrialDecision();
  }
}

// --- E. Persona Intro -------------------------------------------------------
function renderPersonaIntro() {
  const scenario = scenarioAt(state.current_trial_index);
  const persona = personaById(scenario.persona_id);
  const personaNo = ["P1", "P2", "P3"].indexOf(persona.id) + 1;
  app.innerHTML = h`
    <p class="progress" aria-hidden="true">역할 ${personaNo} / 3</p>
    <section class="card stack">
      <span class="tag">페르소나 ${e(persona.id)}</span>
      <h2>${e(persona.title)}</h2>
      <p class="persona-desc">${e(persona.description)}</p>
      <p class="small">이 역할로 ${e(persona.id)}의 3개 구매 시나리오를 진행합니다.</p>
      <div class="row"><button id="confirmPersonaBtn">이 역할로 시작</button></div>
    </section>`;
  announce(`역할 ${personaNo}: ${persona.title}`);
  document.querySelector("#confirmPersonaBtn").addEventListener("click", () => {
    if (!state.personas_seen.includes(persona.id)) state.personas_seen.push(persona.id);
    state.current_step = "trial";
    persist();
    renderTrialDecision();
  });
}

// --- F. Trial Decision Page -------------------------------------------------
function renderComparisonTable(scenario) {
  return h`<div class="table-wrap" tabindex="0" role="region" aria-label="후보 제품 비교표">
    <table>
      <thead><tr><th scope="col">항목</th>${scenario.options.map((o) => `<th scope="col">${e(o.display_label)}</th>`).join("")}</tr></thead>
      <tbody>${scenario.comparison_table.map((row) =>
        `<tr><th scope="row">${e(row.label)}</th>${scenario.options.map((o) => `<td>${e(row.values[o.code] ?? "-")}</td>`).join("")}</tr>`
      ).join("")}</tbody>
    </table>
  </div>`;
}

function renderAiBox(ai) {
  if (ai.ai_shown && ai.text) {
    return h`<div class="ai-box" role="note"><span class="ai-tag">AI Assistant</span><p>${e(ai.text)}</p></div>`;
  }
  return h`<p class="ai-none">AI Assistant 의견은 제시되지 않았습니다.</p>`;
}

function renderTrialDecision() {
  const trialIndex = state.current_trial_index;
  const scenario = scenarioAt(trialIndex);
  const persona = personaById(scenario.persona_id);
  const condition = state.assignment.condition_by_scenario[scenario.id];
  const ai = scenario.ai_messages[condition];

  // Resume support: if a draft already exists for this trial, keep it; else start fresh.
  let draft = state.pending_trial && state.pending_trial.scenario_id === scenario.id ? state.pending_trial : null;
  const alreadyChosen = !!(draft && draft.selected_option);

  app.innerHTML = h`
    <p class="progress" aria-hidden="true">Trial ${trialIndex + 1} / ${totalTrials()}</p>
    <section class="card soft">
      <span class="tag">페르소나 ${e(persona.id)} · ${e(persona.title)}</span>
    </section>
    <section class="card">
      <h2>${e(scenario.title)}</h2>
      <h3>배경 상황</h3>
      <ul class="bg-list">${scenario.background.map((x) => `<li>${e(x)}</li>`).join("")}</ul>
      <h3>후보 제품 비교표</h3>
      ${renderComparisonTable(scenario)}
      <h3>AI Assistant 의견</h3>
      ${renderAiBox(ai)}
    </section>
    <section class="card stack">
      <h3>구매 결정</h3>
      <p><strong>${e(scenario.choice_question)}</strong></p>
      <div class="choice-grid" role="group" aria-label="제품 선택">
        ${scenario.options.map((opt) =>
          `<button type="button" class="choice${alreadyChosen && draft.selected_option === opt.code ? " selected" : ""}" data-option="${e(opt.code)}"${alreadyChosen ? " disabled" : ""}>
            <span class="choice-code">${e(opt.code)}</span>
            <span class="choice-label">${e(opt.display_label)}</span>
          </button>`
        ).join("")}
      </div>
      <p id="choiceLockNotice" class="small lock-notice ${alreadyChosen ? "" : "hidden"}">제품 선택이 완료되었습니다. 응답 시간은 최초 선택 시점을 기준으로 기록됩니다.</p>
      <label for="choiceReason">${e(scenario.reason_question)}</label>
      <textarea id="choiceReason" placeholder="선택 사항">${draft?.choice_reason ? e(draft.choice_reason) : ""}</textarea>
      <p id="trialError" class="error hidden" role="alert"></p>
      <div class="row"><button id="toPostBtn"${alreadyChosen ? "" : " disabled"}>사후 문항으로 이동</button></div>
    </section>`;

  // Create the draft synchronously so a fast first click is never lost; the RT
  // clock and the trial_rendered event are stamped after paint (double rAF).
  if (!draft) {
    draft = {
      trial_index: trialIndex + 1,
      persona_id: scenario.persona_id,
      scenario_id: scenario.id,
      condition,
      condition_label: ai.condition_label,
      stimulus_id: `${scenario.id}_${condition}`,
      ai_shown: ai.ai_shown,
      ai_recommended_option: ai.recommended_option ?? null,
      selected_option: null,
      selected_product_label: null,
      choice_reason: null,
      trial_page_rendered_at_iso: null,
      decision_clicked_at_iso: null,
      decision_response_time_ms: null,
      post_started_at_iso: null,
      trial_completed_at_iso: null,
      total_trial_time_ms: null,
      post_answers: {},
      event_log: []
    };
    state.pending_trial = draft;
  }
  if (!alreadyChosen) {
    markTrialRendered().then((t) => {
      if (state.pending_trial && state.pending_trial.scenario_id === scenario.id && !state.pending_trial.selected_option) {
        state.pending_trial.trial_page_rendered_at_iso = t.iso;
        if (!state.pending_trial.event_log.some((ev) => ev.event === "trial_rendered")) {
          logEvent(state.pending_trial, "trial_rendered");
        }
        persist();
      }
    });
  }

  announce(`Trial ${trialIndex + 1} / ${totalTrials()}: ${scenario.title}`);

  document.querySelectorAll("button.choice").forEach((btn) =>
    btn.addEventListener("click", () => onChoiceClick(btn, scenario))
  );
  document.querySelector("#toPostBtn").addEventListener("click", () => {
    if (!state.pending_trial || !state.pending_trial.selected_option)
      return showError(document.querySelector("#trialError"), "먼저 제품을 선택해 주세요.");
    state.pending_trial.choice_reason = document.querySelector("#choiceReason").value.trim() || null;
    state.current_step = "post";
    persist();
    renderPostTrial();
  });
}

function onChoiceClick(btn, scenario) {
  const draft = state.pending_trial;
  if (!draft || draft.selected_option) return; // ignore repeat clicks; RT not updated
  const timing = decisionTiming();
  const selected = scenario.options.find((o) => o.code === btn.dataset.option);
  draft.selected_option = selected.code;
  draft.selected_product_label = selected.display_label;
  draft.trial_page_rendered_at_iso = timing.trial_page_rendered_at_iso || draft.trial_page_rendered_at_iso;
  draft.decision_clicked_at_iso = timing.decision_clicked_at_iso;
  draft.decision_response_time_ms = timing.decision_response_time_ms;
  logEvent(draft, "choice_click", { option: selected.code });
  persist();

  document.querySelectorAll("button.choice").forEach((b) => {
    b.disabled = true;
    if (b === btn) b.classList.add("selected");
  });
  document.querySelector("#choiceLockNotice").classList.remove("hidden");
  document.querySelector("#toPostBtn").disabled = false;
  announce(`${selected.display_label} 선택됨. 응답 시간이 기록되었습니다.`);
}

// --- G. Post-trial questions ------------------------------------------------
function likertAnchors(q) {
  // anchor labels for both ends of the scale
  const low = q.scale?.["1"] ?? "";
  const high = q.scale?.["5"] ?? "";
  return { low, high };
}

function renderLikertQuestion(q, idx) {
  const { low, high } = likertAnchors(q);
  return h`<fieldset class="likert" role="radiogroup" aria-labelledby="lq_${idx}">
    <legend id="lq_${idx}" class="likert-text">${e(q.text)}</legend>
    <div class="likert-scale">
      <span class="anchor anchor-low">${e(low)}</span>
      <div class="likert-options">
        ${[1, 2, 3, 4, 5].map((v) =>
          `<label class="likert-opt"><input type="radio" name="${e(q.name)}" value="${v}" aria-label="${v}점${v === 1 && low ? " (" + e(low) + ")" : v === 5 && high ? " (" + e(high) + ")" : ""}" /><span>${v}</span></label>`
        ).join("")}
      </div>
      <span class="anchor anchor-high">${e(high)}</span>
    </div>
  </fieldset>`;
}

function renderPostTrial() {
  const draft = state.pending_trial;
  if (!draft || !draft.selected_option) { // safety: nothing chosen, go back
    state.current_step = "trial";
    return renderTrialDecision();
  }
  if (!draft.post_started_at_iso) {
    draft.post_started_at_iso = nowIso();
    logEvent(draft, "post_started");
    persist();
  }
  const isN = draft.condition === "N";
  const visible = data.questions.post_trial.filter((q) => q.show_when === "always" || !isN);
  app.innerHTML = h`
    <p class="progress" aria-hidden="true">Trial ${draft.trial_index} / ${totalTrials()} · 사후 문항</p>
    <form id="postForm" class="card stack" novalidate>
      <h2>사후 평가 문항</h2>
      <p class="small">선택하신 제품: <strong>${e(draft.selected_product_label)}</strong></p>
      ${visible.map((q, i) => renderLikertQuestion(q, i)).join("")}
      <p id="postError" class="error hidden" role="alert"></p>
      <div class="row"><button type="submit">다음</button></div>
    </form>`;
  announce(`Trial ${draft.trial_index} 사후 문항입니다.`);

  document.querySelector("#postForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const answers = {};
    for (const q of data.questions.post_trial) {
      const hidden = q.show_when !== "always" && isN;
      if (hidden) { answers[q.name] = null; continue; }
      const v = getLikertValue(form, q.name);
      if (v === null) return showError(document.querySelector("#postError"), "표시된 모든 문항에 응답해 주세요.");
      answers[q.name] = v;
    }
    draft.post_answers = answers;
    draft.total_trial_time_ms = totalTrialTimeMs();
    draft.trial_completed_at_iso = nowIso();
    logEvent(draft, "trial_completed");

    state.trials.push(draft);
    state.pending_trial = null;
    state.current_trial_index += 1;

    if (state.current_trial_index >= totalTrials()) {
      state.current_step = sawAnyAiCondition(state) ? "manipulation" : "demographics";
      persist();
      return state.current_step === "manipulation" ? renderManipulationCheck() : renderDemographics();
    }
    enterTrialIndex();
  });
}

// --- H. Manipulation check --------------------------------------------------
function renderManipulationCheck() {
  // Neutral-only mode: no AI ever shown → skip with null values.
  if (!sawAnyAiCondition(state)) {
    state.manipulation_check = { perceived_ai_certainty: null, conclusion_clarity: null };
    state.current_step = "demographics";
    persist();
    return renderDemographics();
  }
  app.innerHTML = h`
    <form id="mcForm" class="card stack" novalidate>
      <h2>조작 점검 문항</h2>
      <p class="small">실험 전반에서 보신 AI Assistant 답변을 떠올리며 응답해 주세요.</p>
      ${data.questions.manipulation_check.map((q, i) => renderLikertQuestion(q, i)).join("")}
      <p id="mcError" class="error hidden" role="alert"></p>
      <div class="row"><button type="submit">인구통계 문항으로 이동</button></div>
    </form>`;
  document.querySelector("#mcForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const answers = {};
    for (const q of data.questions.manipulation_check) {
      const v = getLikertValue(ev.currentTarget, q.name);
      if (v === null) return showError(document.querySelector("#mcError"), "모든 문항에 응답해 주세요.");
      answers[q.name] = v;
    }
    state.manipulation_check = answers;
    state.current_step = "demographics";
    persist();
    renderDemographics();
  });
}

// --- I. Demographics --------------------------------------------------------
function renderDemographicQuestion(q) {
  const isGender = q.type === "single_choice_with_other";
  return h`<fieldset class="card soft demo-q" role="radiogroup" aria-labelledby="demo_${e(q.name)}">
    <legend id="demo_${e(q.name)}"><strong>${e(q.text)}</strong></legend>
    <div class="demo-options">
      ${q.options.map((opt, i) =>
        `<label class="row opt"><input type="radio" name="${e(q.name)}" value="${e(opt)}" data-other="${isGender && opt === q.other_option ? "1" : "0"}" /> <span>${e(opt)}</span></label>`
      ).join("")}
    </div>
    ${isGender ? `<input id="gender_other" class="other-input" type="text" placeholder="직접 입력" disabled />` : ""}
  </fieldset>`;
}

function renderDemographics() {
  app.innerHTML = h`
    <form id="demoForm" class="card stack" novalidate>
      <h2>인구통계학적 정보 및 사전 경험</h2>
      <p class="small">해당하는 항목을 선택해 주세요. 일부 문항은 "응답하지 않음"을 선택할 수 있습니다.</p>
      ${data.questions.demographics.map(renderDemographicQuestion).join("")}
      <p id="demoError" class="error hidden" role="alert"></p>
      <div class="row"><button type="submit">실험 완료</button></div>
    </form>`;

  // gender "other" text input toggle
  const otherInput = document.querySelector("#gender_other");
  document.querySelectorAll('input[name="gender"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const isOther = radio.dataset.other === "1" && radio.checked;
      if (otherInput) {
        otherInput.disabled = !isOther;
        if (isOther) otherInput.focus(); else otherInput.value = "";
      }
    });
  });

  document.querySelector("#demoForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const answers = {};
    for (const q of data.questions.demographics) {
      const v = getSingleChoiceValue(form, q.name);
      if (!v) return showError(document.querySelector("#demoError"), "모든 문항에 응답해 주세요.");
      answers[q.name] = v;
    }
    const genderQ = data.questions.demographics.find((q) => q.type === "single_choice_with_other");
    if (genderQ && answers.gender === genderQ.other_option) {
      const otherVal = otherInput?.value.trim();
      if (!requireValue(otherVal)) return showError(document.querySelector("#demoError"), "성별을 직접 입력해 주세요.");
      answers.gender_other = otherVal;
    } else {
      answers.gender_other = null;
    }
    state.demographics = answers;
    state.completed_at_iso = new Date().toISOString();
    state.current_step = "completion";
    persist();
    renderCompletion();
  });
}

// --- J. Export / Submit -----------------------------------------------------
function renderCompletion(info = {}) {
  const remote = data.config.remote;
  const hasRemote = !!(remote && remote.submit_url);
  app.innerHTML = h`
    <section class="card stack">
      <h1>실험이 완료되었습니다 🎉</h1>
      <p>참여해 주셔서 감사합니다. 아래에서 응답 결과를 저장해 주세요.</p>
      <p class="notice">${hasRemote
        ? "원격 서버로 제출하거나, JSON / CSV 파일을 직접 다운로드할 수 있습니다."
        : "JSON 원자료 파일과 CSV 분석용 파일을 다운로드하여 연구자에게 제출해 주세요."}</p>
      <div class="row">
        ${hasRemote ? `<button id="submitRemoteBtn">서버로 제출</button>` : ""}
        <button id="downloadBothBtn"${hasRemote ? ' class="secondary"' : ""}>JSON + CSV 다운로드</button>
      </div>
      <div class="row">
        <button id="jsonOnlyBtn" class="secondary">JSON만 다운로드</button>
        <button id="csvOnlyBtn" class="secondary">CSV만 다운로드</button>
      </div>
      <p id="completionStatus" class="${info.message ? "" : "hidden"} ${info.error ? "error" : "success-msg"}" role="status">${e(info.message || "")}</p>
      <hr />
      <button id="clearBtn" class="link-btn">완료 후 저장 데이터 삭제 (localStorage 비우기)</button>
    </section>`;

  document.querySelector("#downloadBothBtn").addEventListener("click", () => {
    finalizeAndDownload(state, data.config);
    persist();
    renderCompletion({ message: "JSON과 CSV 파일 다운로드를 요청했습니다.", error: false });
  });
  document.querySelector("#jsonOnlyBtn").addEventListener("click", () => {
    downloadJson(state, data.config); persist();
    renderCompletion({ message: "JSON 파일 다운로드를 요청했습니다.", error: false });
  });
  document.querySelector("#csvOnlyBtn").addEventListener("click", () => {
    downloadCsv(state, data.config);
    renderCompletion({ message: "CSV 파일 다운로드를 요청했습니다.", error: false });
  });
  document.querySelector("#submitRemoteBtn")?.addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true; btn.textContent = "제출 중…";
    try {
      await submitToRemote(state, remote);
      persist();
      renderCompletion({ message: "서버 제출이 완료되었습니다.", error: false });
    } catch (err) {
      // fallback: keep file download available
      finalizeAndDownload(state, data.config);
      persist();
      renderCompletion({ message: `서버 제출에 실패하여 파일 다운로드로 전환했습니다. (${err.message})`, error: true });
    }
  });
  document.querySelector("#clearBtn").addEventListener("click", () => {
    clearState(data.config.autosave.local_storage_key);
    renderCompletion({ message: "저장된 응답 데이터를 삭제했습니다.", error: false });
  });
  announce("실험이 완료되었습니다. 결과를 저장해 주세요.");
}

// --- error boundary ---------------------------------------------------------
boot().catch((err) => {
  app.innerHTML = h`
    <section class="card">
      <h1>로드 오류</h1>
      <p class="error">${e(err.message)}</p>
      <p>로컬에서 열 때는 파일을 직접 여는 대신 정적 서버가 필요합니다.<br />
        터미널에서 <code>python3 -m http.server 8000</code> 실행 후
        <code>http://localhost:8000</code>으로 접속해 주세요.</p>
      <button onclick="location.reload()">다시 시도</button>
    </section>`;
});
