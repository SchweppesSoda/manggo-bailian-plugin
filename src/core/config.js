export const ACCESS_MODE = Object.freeze({
  PAYG: "pay_as_you_go",
  CODING: "coding_plan",
  TOKEN: "token_plan",
});

export const DEFAULTS = Object.freeze({
  accessMode: ACCESS_MODE.PAYG,
  region: "china",
  model: "qwen3.7-plus",
});

const VALID_ACCESS_MODES = Object.freeze({
  pay_as_you_go: true,
  coding_plan: true,
  token_plan: true,
});
const VALID_REGIONS = Object.freeze({ china: true, singapore: true });

export const SHARED_PAYG_ENDPOINTS = Object.freeze({
  china: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  singapore: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

export const PLAN_ENDPOINTS = Object.freeze({
  [ACCESS_MODE.CODING]: "https://coding.dashscope.aliyuncs.com/v1",
  [ACCESS_MODE.TOKEN]: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
});

export function nonEmptyText(input, fallback = "") {
  if (input === undefined || input === null) return fallback;
  const candidate = String(input).trim();
  return candidate.length > 0 ? candidate : fallback;
}

export function normalizedBoolean(input, fallback = false) {
  if (input === true || input === false) return input;
  if (typeof input !== "string") return fallback;
  const values = {
    true: true,
    "1": true,
    yes: true,
    on: true,
    false: false,
    "0": false,
    no: false,
    off: false,
  };
  const key = input.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback;
}

export function boundedInteger(input, fallback, minimum = 1, maximum = 131072) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)));
}

export function selectedValue(input, fallback, allowed, label) {
  const selected = nonEmptyText(input, fallback).toLowerCase();
  if (!allowed[selected]) throw new Error(`Unsupported ${label}: ${input}.`);
  return selected;
}

function hasProtocol(input) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
}

function validAuthority(authority) {
  // HTTPS endpoints use ordinary DNS names or bracketed IPv6 literals.  Keep
  // this deliberately narrow so a malformed port cannot sneak past the
  // no-URL-constructor implementation used by Bob.
  if (/^\[[0-9a-f:.]+\](?::\d+)?$/i.test(authority)) return true;
  return /^[a-z0-9][a-z0-9.-]*(?::\d+)?$/i.test(authority);
}

/**
 * Validate an endpoint without relying on the web URL constructor.  Bob's
 * JavaScriptCore host does not promise that browser URL APIs are available.
 */
export function secureBaseUrl(input) {
  const raw = nonEmptyText(input);
  if (!raw) throw new Error("Base URL must be a valid HTTPS URL.");
  if (!/^https:\/\//i.test(raw)) {
    if (hasProtocol(raw)) throw new Error("Base URL must use HTTPS.");
    throw new Error("Base URL must be a valid HTTPS URL.");
  }
  if (/\s/.test(raw)) throw new Error("Base URL must be a valid HTTPS URL.");

  const afterScheme = raw.slice("https://".length);
  const firstPath = afterScheme.search(/[/?#]/);
  const authority = firstPath === -1 ? afterScheme : afterScheme.slice(0, firstPath);
  if (!authority) throw new Error("Base URL must be a valid HTTPS URL.");
  if (authority.indexOf("@") !== -1) throw new Error("Base URL must not contain credentials.");
  if (!validAuthority(authority)) throw new Error("Base URL must be a valid HTTPS URL.");
  if (raw.indexOf("?") !== -1 || raw.indexOf("#") !== -1) {
    throw new Error("Base URL must not contain a query or fragment.");
  }

  return raw.replace(/\/+$/, "");
}

export function automaticBaseUrl(config = {}) {
  const custom = nonEmptyText(config.customBaseUrl);
  if (custom) return secureBaseUrl(custom);

  const mode = selectedValue(config.accessMode, DEFAULTS.accessMode, VALID_ACCESS_MODES, "billing mode");
  const region = selectedValue(config.region, DEFAULTS.region, VALID_REGIONS, "region");
  if (mode === ACCESS_MODE.CODING || mode === ACCESS_MODE.TOKEN) {
    if (region !== "china") {
      throw new Error("Coding Plan and Token Plan currently require the China (Beijing) region.");
    }
    return PLAN_ENDPOINTS[mode];
  }

  const workspaceId = nonEmptyText(config.workspaceId);
  if (!workspaceId) return SHARED_PAYG_ENDPOINTS[region];
  if (!/^[a-z0-9-]+$/i.test(workspaceId)) {
    throw new Error("Workspace ID may contain only letters, numbers, and hyphens.");
  }
  const deploymentRegion = region === "china" ? "cn-beijing" : "ap-southeast-1";
  return `https://${workspaceId}.${deploymentRegion}.maas.aliyuncs.com/compatible-mode/v1`;
}

export function chatEndpoint(config = {}) {
  const base = automaticBaseUrl(config);
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}
