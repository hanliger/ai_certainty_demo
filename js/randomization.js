function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); }
  return Math.abs(h >>> 0);
}
export function buildAssignment({ participantId, config, scenarios }) {
  const seed = String(participantId || "anonymous");
  const hashed = hashString(seed);
  const byId = Object.fromEntries(scenarios.map(s => [s.id, s]));
  const condition_by_scenario = {};
  const personaIds = [...new Set(config.scenario_order.map(id => byId[id].persona_id))];
  personaIds.forEach((personaId, pi) => {
    const ids = config.scenario_order.filter(id => byId[id].persona_id === personaId);
    const seq = config.condition_sequences[(hashed + pi) % config.condition_sequences.length];
    ids.forEach((id, si) => { condition_by_scenario[id] = seq[si % seq.length]; });
  });
  return { assignment_mode: config.assignment_mode, assignment_seed: seed, condition_by_scenario, trial_order: config.scenario_order };
}
