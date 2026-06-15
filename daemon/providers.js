// BagIdea Office — LLM provider catalog + config (PHASE 1: scaffold/plumbing).
//
// This module is METADATA + CONFIG ONLY. It does NOT call any API, execute a
// prompt, or route an agent run. The office still runs every agent through the
// existing Claude Code runtime, untouched — these helpers describe providers and
// remember the owner's selection ahead of a later phase that actually dispatches
// to the chosen provider. Keeping it inert now means the config + UI can land
// safely without any risk to how agents currently run.
//
// Config shape stored in registry.json (reg.providers):
//   { active: <providerId>, models: { <builtinId>: <modelId> }, custom: [ {
//       id, label, baseUrl, apiKey, model, enabled } ] }
// `active` may name a built-in OR a custom provider. Custom providers are
// OpenAI-compatible endpoints the owner adds (e.g. LM Studio on another box);
// their order in the list is the intended fallback chain for a later phase.

// ---- built-in catalog -------------------------------------------------------
// `runtime: true` marks the provider the office ACTUALLY executes through today
// (Claude Code). `envKey` is the reg.apiKeys / process.env name that powers a
// provider; null means "no key needed" (the local CLI).
const PROVIDERS = [
  {
    id: "claude-code", label: "Claude Code (current runtime)",
    kind: "agent-runtime", envKey: null, runtime: true,
    models: [
      { id: "default", label: "Claude Code default (inherits CLI)" },
      { id: "claude-opus-4-8", label: "Opus 4.8" },
      { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
      { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
    ],
    defaultModel: "default",
  },
  {
    id: "anthropic", label: "Anthropic API", kind: "api",
    envKey: "ANTHROPIC_API_KEY", runtime: false,
    models: [
      { id: "claude-opus-4-8", label: "Opus 4.8" },
      { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
      { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
    ],
    defaultModel: "claude-sonnet-4-6",
  },
  {
    id: "openai", label: "OpenAI", kind: "api",
    envKey: "OPENAI_API_KEY", runtime: false,
    models: [
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
    ],
    defaultModel: "gpt-4.1",
  },
  {
    id: "gemini", label: "Google Gemini", kind: "api",
    envKey: "GEMINI_API_KEY", runtime: false,
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
    defaultModel: "gemini-2.5-flash",
  },
];

const DEFAULT_PROVIDER = "claude-code";
const MAX_CUSTOM = 20;          // anti-bloat cap on the custom provider list
const byId = (id) => PROVIDERS.find((p) => p.id === id) || null;

// ---- custom provider sanitation --------------------------------------------
// A baseUrl is valid only if it parses as an absolute http(s) URL — anything
// else is rejected (POST) or dropped (normalize) so a bad value can't wedge us.
function validBaseUrl(u) {
  if (typeof u !== "string" || !u.trim()) return false;
  try { const x = new URL(u.trim()); return x.protocol === "http:" || x.protocol === "https:"; }
  catch { return false; }
}

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 32);
}
// Deterministic, collision-free id from a label given the ids already taken.
function makeCustomId(label, existingIds) {
  const taken = new Set(existingIds || []);
  let base = slug(label) || "provider";
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(base + "-" + i)) return base + "-" + i;
  return base + "-" + Date.now();   // pathological fallback (never reached in practice)
}
// Coerce one raw custom entry into a clean record, or null if unusable. `id` is
// the id to assign (caller decides — keep existing on edit, mint on add).
function sanitizeCustomEntry(raw, id) {
  if (!raw || typeof raw !== "object") return null;
  if (!validBaseUrl(raw.baseUrl)) return null;
  return {
    id: String(id || raw.id || "").slice(0, 40),
    label: String(raw.label || raw.id || "custom").slice(0, 60),
    baseUrl: String(raw.baseUrl).trim().slice(0, 300),
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey.slice(0, 400) : "",
    model: String(raw.model || "").slice(0, 80),
    enabled: raw.enabled !== false,
  };
}
// Sanitize the whole custom list: drop bad entries, dedupe ids, cap length.
function sanitizeCustomList(list) {
  const out = [];
  const taken = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    if (out.length >= MAX_CUSTOM) break;
    let id = slug(raw && raw.id) || "";
    if (!id || taken.has(id)) id = makeCustomId((raw && raw.label) || id, taken);
    const e = sanitizeCustomEntry(raw, id);
    if (e) { out.push(e); taken.add(id); }
  }
  return out;
}

const customById = (custom, id) => (Array.isArray(custom) ? custom.find((c) => c.id === id) : null) || null;

// ---- config normalization ---------------------------------------------------
// Coerce whatever sits in registry.json into a well-formed config, filling
// defaults. Unknown providers/models fall back to defaults so a hand-edited or
// stale registry can never wedge the office.
function normalizeConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const custom = sanitizeCustomList(cfg.custom);
  const known = new Set([...PROVIDERS.map((p) => p.id), ...custom.map((c) => c.id)]);
  const active = known.has(cfg.active) ? cfg.active : DEFAULT_PROVIDER;
  const models = {};
  for (const p of PROVIDERS) {
    const want = cfg.models && cfg.models[p.id];
    models[p.id] = p.models.some((m) => m.id === want) ? want : p.defaultModel;
  }
  return { active, models, custom };
}

// Is `id` a provider the office knows about (built-in, custom, or the "use the
// office default" sentinel)? Used to validate per-agent overrides.
function isKnownProvider(id, custom) {
  if (id == null || id === "" || id === "default") return true;
  return !!byId(id) || !!customById(custom, id);
}

// Validate a proposed (provider, model) pair before committing it. For a custom
// provider the model is free-form (the remote endpoint defines its own names).
function validate(providerId, modelId, custom) {
  const p = byId(providerId);
  const c = customById(custom, providerId);
  if (!p && !c) return { ok: false, error: "unknown provider: " + providerId };
  if (p && modelId != null && !p.models.some((m) => m.id === modelId))
    return { ok: false, error: "unknown model for " + providerId + ": " + modelId };
  return { ok: true };
}

// Resolve the active provider + its chosen model into a concrete descriptor.
// PHASE 1: for display only — nothing dispatches on this yet.
function resolveActive(cfg) {
  const norm = normalizeConfig(cfg);
  const p = byId(norm.active);
  if (p) return { providerId: norm.active, model: norm.models[norm.active],
    kind: p.kind, runtime: !!p.runtime, label: p.label, custom: false };
  const c = customById(norm.custom, norm.active);
  if (c) return { providerId: c.id, model: c.model || "", kind: "openai-compatible",
    runtime: false, label: c.label, baseUrl: c.baseUrl, custom: true };
  const d = byId(DEFAULT_PROVIDER);
  return { providerId: DEFAULT_PROVIDER, model: d.defaultModel, kind: d.kind,
    runtime: true, label: d.label, custom: false };
}

// Which providers are READY (key present / custom enabled) — booleans only,
// NEVER a key value. claude-code needs no key (it rides the local CLI).
function availability(apiKeys, env, custom) {
  const k = apiKeys || {}, e = env || {};
  const out = {};
  for (const p of PROVIDERS) out[p.id] = p.envKey ? !!(k[p.envKey] || e[p.envKey]) : true;
  for (const c of Array.isArray(custom) ? custom : [])
    out[c.id] = c.enabled !== false && validBaseUrl(c.baseUrl);
  return out;
}

// Public view of the custom list — apiKey NEVER leaves the daemon; callers get a
// `hasKey` boolean instead of the value.
function publicCustom(custom) {
  return (Array.isArray(custom) ? custom : []).map((c) => ({
    id: c.id, label: c.label, baseUrl: c.baseUrl, model: c.model || "",
    enabled: c.enabled !== false, hasKey: !!c.apiKey,
  }));
}

// Public view of the catalog — safe to ship to the UI (no secrets at all).
function catalog() {
  return PROVIDERS.map((p) => ({
    id: p.id, label: p.label, kind: p.kind, envKey: p.envKey,
    runtime: !!p.runtime, models: p.models, defaultModel: p.defaultModel,
  }));
}

module.exports = {
  PROVIDERS, DEFAULT_PROVIDER, MAX_CUSTOM,
  catalog, normalizeConfig, validate, resolveActive, availability,
  isKnownProvider, validBaseUrl, makeCustomId, sanitizeCustomEntry,
  sanitizeCustomList, publicCustom, get: byId, customById,
};
