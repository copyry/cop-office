// BagIdea Office — LLM provider catalog + config (PHASE 1: scaffold/plumbing).
//
// This module is METADATA + CONFIG ONLY. It does NOT call any API, execute a
// prompt, or route an agent run. The office still runs every agent through the
// existing Claude Code runtime, untouched — `resolveActive()` is for DISPLAY and
// for remembering the owner's selection ahead of a later phase that actually
// dispatches to the chosen provider. Keeping it inert now means the config and
// UI can land safely without any risk to how agents currently run.

// The catalog. `runtime: true` marks the provider the office ACTUALLY executes
// through today (Claude Code) — the others are config-only placeholders until a
// later phase wires real dispatch. `envKey` is the reg.apiKeys / process.env
// name that powers a provider; null means "no key needed" (the local CLI).
const PROVIDERS = [
  {
    id: "claude-code",
    label: "Claude Code (current runtime)",
    kind: "agent-runtime",
    envKey: null,
    runtime: true,
    models: [
      { id: "default", label: "Claude Code default (inherits CLI)" },
      { id: "claude-opus-4-8", label: "Opus 4.8" },
      { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
      { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
    ],
    defaultModel: "default",
  },
  {
    id: "anthropic",
    label: "Anthropic API",
    kind: "api",
    envKey: "ANTHROPIC_API_KEY",
    runtime: false,
    models: [
      { id: "claude-opus-4-8", label: "Opus 4.8" },
      { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
      { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
    ],
    defaultModel: "claude-sonnet-4-6",
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "api",
    envKey: "OPENAI_API_KEY",
    runtime: false,
    models: [
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
    ],
    defaultModel: "gpt-4.1",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    kind: "api",
    envKey: "GEMINI_API_KEY",
    runtime: false,
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
    defaultModel: "gemini-2.5-flash",
  },
];

const DEFAULT_PROVIDER = "claude-code";
const byId = (id) => PROVIDERS.find((p) => p.id === id) || null;

// Public catalog — safe to ship to the UI (carries no secrets at all).
function catalog() {
  return PROVIDERS.map((p) => ({
    id: p.id, label: p.label, kind: p.kind, envKey: p.envKey,
    runtime: !!p.runtime, models: p.models, defaultModel: p.defaultModel,
  }));
}

// Coerce whatever sits in registry.json into a well-formed config, filling
// defaults. Shape: { active: <providerId>, models: { <providerId>: <modelId> } }.
// Unknown providers/models fall back to defaults so a hand-edited or stale
// registry can never wedge the office.
function normalizeConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const active = byId(cfg.active) ? cfg.active : DEFAULT_PROVIDER;
  const models = {};
  for (const p of PROVIDERS) {
    const want = cfg.models && cfg.models[p.id];
    models[p.id] = p.models.some((m) => m.id === want) ? want : p.defaultModel;
  }
  return { active, models };
}

// Validate a proposed (provider, model) pair before committing it. modelId is
// optional — omit to set only the active provider.
function validate(providerId, modelId) {
  const p = byId(providerId);
  if (!p) return { ok: false, error: "unknown provider: " + providerId };
  if (modelId != null && !p.models.some((m) => m.id === modelId))
    return { ok: false, error: "unknown model for " + providerId + ": " + modelId };
  return { ok: true };
}

// Resolve the active provider + its chosen model into a concrete descriptor.
// PHASE 1: for display only — nothing dispatches on this yet.
function resolveActive(cfg) {
  const norm = normalizeConfig(cfg);
  const p = byId(norm.active);
  return {
    providerId: norm.active,
    model: norm.models[norm.active],
    kind: p.kind,
    runtime: !!p.runtime,
    label: p.label,
  };
}

// Which providers are READY (their key is present) — booleans only, NEVER the
// key value. claude-code needs no key (it rides the local CLI).
function availability(apiKeys, env) {
  const k = apiKeys || {};
  const e = env || {};
  const out = {};
  for (const p of PROVIDERS) out[p.id] = p.envKey ? !!(k[p.envKey] || e[p.envKey]) : true;
  return out;
}

module.exports = {
  PROVIDERS, DEFAULT_PROVIDER,
  catalog, normalizeConfig, validate, resolveActive, availability,
  get: byId,
};
