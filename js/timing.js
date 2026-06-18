// timing.js — high-resolution trial timing.
//
// Response Time (RT) is defined as the interval between the moment the trial
// decision page has finished rendering (measured in a double rAF, after paint)
// and the FIRST click on an A/B/C product button. Time spent writing the choice
// reason or answering post-trial questions is NOT part of the decision RT.

const round1 = (n) => Math.round(n * 10) / 10;

let trialStartedPerf = null;
let trialStartedIso = null;

// Resolves after the page has actually painted, stamping the trial start.
export function markTrialRendered() {
  return new Promise((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        trialStartedPerf = performance.now();
        trialStartedIso = new Date().toISOString();
        resolve({ perf: round1(trialStartedPerf), iso: trialStartedIso });
      })
    )
  );
}

// Capture the decision click. RT is null only if the timer never started.
export function decisionTiming() {
  const p = performance.now();
  return {
    trial_started_perf: trialStartedPerf === null ? null : round1(trialStartedPerf),
    trial_page_rendered_at_iso: trialStartedIso,
    decision_clicked_perf: round1(p),
    decision_clicked_at_iso: new Date().toISOString(),
    decision_response_time_ms: trialStartedPerf === null ? null : round1(p - trialStartedPerf)
  };
}

// Total time on the trial, from render to "post submitted".
export function totalTrialTimeMs() {
  return trialStartedPerf === null ? null : round1(performance.now() - trialStartedPerf);
}

export const nowPerf = () => round1(performance.now());
export const nowIso = () => new Date().toISOString();
