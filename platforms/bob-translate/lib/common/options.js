/*
 * Bob-facing configuration adapter.
 *
 * This module intentionally uses only JavaScriptCore-friendly language
 * features.  It returns ordinary data so a future bundled src/core adapter can
 * replace the request builder without touching Bob's $option surface.
 */

var ACCESS_MODE = {
  PAYG: "pay_as_you_go",
  CODING: "coding_plan",
  TOKEN: "token_plan"
};

var DEFAULTS = {
  accessMode: ACCESS_MODE.PAYG,
  region: "china",
  modelPreset: "qwen3.7-plus",
  enableThinking: "off",
  reasoningEffort: "auto",
  maxTokens: 4096
};

var PAYG_ENDPOINTS = {
  china: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  singapore: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
};

var PLAN_ENDPOINTS = {};
PLAN_ENDPOINTS[ACCESS_MODE.CODING] = "https://coding.dashscope.aliyuncs.com/v1";
PLAN_ENDPOINTS[ACCESS_MODE.TOKEN] = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";

function optionValue(options, key, fallback) {
  if (!options || options[key] === undefined || options[key] === null) return fallback;
  return options[key];
}

function nonEmptyText(input, fallback) {
  if (input === undefined || input === null) return fallback || "";
  var candidate = String(input).trim();
  return candidate ? candidate : (fallback || "");
}

function selectedValue(input, fallback, allowed, label) {
  var value = nonEmptyText(input, fallback).toLowerCase();
  if (allowed.indexOf(value) < 0) {
    throw new Error("Unsupported " + label + ": " + String(input) + ".");
  }
  return value;
}

function boundedInteger(input, fallback, minimum, maximum) {
  var raw = nonEmptyText(input, String(fallback));
  var number = Number(raw);
  if (!isFinite(number) || Math.floor(number) !== number) return fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

function secureBaseUrl(input) {
  var url = nonEmptyText(input);
  if (!/^https:\/\/[^\s/?#]+(?:[/?#]|$)/i.test(url)) {
    throw new Error("Custom Base URL must be a valid HTTPS URL.");
  }
  var authority = url.slice("https://".length).split(/[/?#]/)[0];
  if (!authority || authority.indexOf("@") >= 0) {
    throw new Error("Custom Base URL must not contain credentials.");
  }
  if (/[?#]/.test(url)) {
    throw new Error("Custom Base URL must not contain a query or fragment.");
  }
  return url.replace(/\/+$/, "");
}

function normalizeConfig(options) {
  var accessMode = selectedValue(
    optionValue(options, "accessMode", DEFAULTS.accessMode),
    DEFAULTS.accessMode,
    [ACCESS_MODE.PAYG, ACCESS_MODE.CODING, ACCESS_MODE.TOKEN],
    "billing mode"
  );
  var region = selectedValue(
    optionValue(options, "region", DEFAULTS.region),
    DEFAULTS.region,
    ["china", "singapore"],
    "region"
  );
  var model = nonEmptyText(optionValue(options, "customModel"))
    || nonEmptyText(optionValue(options, "modelPreset", DEFAULTS.modelPreset), DEFAULTS.modelPreset);
  var thinking = selectedValue(
    optionValue(options, "enableThinking", DEFAULTS.enableThinking),
    DEFAULTS.enableThinking,
    ["on", "off"],
    "Enable thinking"
  );
  var reasoningEffort = selectedValue(
    optionValue(options, "reasoningEffort", DEFAULTS.reasoningEffort),
    DEFAULTS.reasoningEffort,
    ["auto", "low", "medium", "high"],
    "Reasoning effort"
  );

  return {
    apiKey: nonEmptyText(optionValue(options, "apiKey")),
    accessMode: accessMode,
    region: region,
    workspaceId: nonEmptyText(optionValue(options, "workspaceId")),
    customBaseUrl: nonEmptyText(optionValue(options, "customBaseUrl")),
    model: model,
    enableThinking: thinking === "on",
    reasoningEffort: reasoningEffort,
    maxTokens: boundedInteger(optionValue(options, "maxTokens", DEFAULTS.maxTokens), DEFAULTS.maxTokens, 1, 131072)
  };
}

function automaticBaseUrl(config) {
  if (config.customBaseUrl) {
    if (config.accessMode === ACCESS_MODE.CODING || config.accessMode === ACCESS_MODE.TOKEN) {
      throw new Error("Coding Plan and Token Plan must use their official Base URLs; remove the Custom Base URL.");
    }
    return secureBaseUrl(config.customBaseUrl);
  }

  if (config.accessMode === ACCESS_MODE.CODING || config.accessMode === ACCESS_MODE.TOKEN) {
    if (config.region !== "china") {
      throw new Error("Coding Plan and Token Plan currently require the China (Beijing) region.");
    }
    return PLAN_ENDPOINTS[config.accessMode];
  }

  if (!config.workspaceId) return PAYG_ENDPOINTS[config.region];
  if (!/^[a-z0-9-]+$/i.test(config.workspaceId)) {
    throw new Error("Workspace ID may contain only letters, numbers, and hyphens.");
  }
  var deploymentRegion = config.region === "china" ? "cn-beijing" : "ap-southeast-1";
  return "https://" + config.workspaceId + "." + deploymentRegion + ".maas.aliyuncs.com/compatible-mode/v1";
}

function chatEndpoint(config) {
  var base = automaticBaseUrl(config);
  return /\/chat\/completions$/i.test(base) ? base : base + "/chat/completions";
}

function thinkingFamily(model) {
  var id = nonEmptyText(model).toLowerCase();
  if (id === "qwen3.8-max" || id === "qwen3.8-max-preview") return "qwen38";
  if (id === "minimax-m2.5") return "always";
  if (
    id === "qwen3-coder-next" ||
    id === "qwen3-coder-plus" ||
    id.indexOf("qwen-mt-") === 0 ||
    id === "qwen3.5-ocr"
  ) return "unsupported";
  if (
    /^qwen3\.(5|6|7)-/.test(id) ||
    /^qwen3-max-/.test(id) ||
    id === "kimi-k2.5" ||
    /^glm-(4\.7|5)$/.test(id)
  ) return "budget";
  return "unknown";
}

function maximumThinkingTokens(model) {
  var id = nonEmptyText(model).toLowerCase();
  if (/^qwen3\.7-/.test(id)) return 262144;
  if (/^qwen3\.(5|6)-/.test(id) || /^qwen3-max-/.test(id) || id === "kimi-k2.5") return 81920;
  if (/^glm-(4\.7|5)$/.test(id)) return 32768;
  return 0;
}

function thinkingFields(config) {
  var family = thinkingFamily(config.model);
  var effort = config.reasoningEffort;
  if (family === "unknown") {
    if (config.enableThinking) throw new Error("Model " + config.model + " is not in the plugin's thinking compatibility table.");
    return {};
  }
  if (family === "unsupported") {
    if (config.enableThinking) throw new Error("Model " + config.model + " is not configured for selectable thinking mode.");
    return {};
  }
  if (family === "always") {
    if (!config.enableThinking) throw new Error("Model " + config.model + " is always-thinking; turn on Enable thinking to use it.");
    if (effort !== "auto") throw new Error("Model " + config.model + " does not support configurable Reasoning effort in this plugin.");
    return {};
  }
  if (family === "qwen38") {
    if (!config.enableThinking) return { reasoning_effort: "none" };
    if (effort === "auto") return {};
    return { reasoning_effort: effort === "high" ? "xhigh" : effort };
  }

  var fields = { enable_thinking: config.enableThinking };
  if (!config.enableThinking || effort === "auto") return fields;
  var maximum = maximumThinkingTokens(config.model);
  if (!maximum) throw new Error("Model " + config.model + " does not support configurable Reasoning effort in this plugin.");
  if (effort === "low") fields.thinking_budget = Math.min(4096, maximum);
  if (effort === "medium") fields.thinking_budget = Math.min(16384, maximum);
  if (effort === "high") fields.thinking_budget = maximum;
  return fields;
}

function redactSensitiveText(input, apiKey) {
  var message = nonEmptyText(input, "Unknown service error");
  if (apiKey) message = message.split(apiKey).join("[REDACTED]");
  return message.length > 800 ? message.slice(0, 800) + "…" : message;
}

module.exports = {
  ACCESS_MODE: ACCESS_MODE,
  automaticBaseUrl: automaticBaseUrl,
  boundedInteger: boundedInteger,
  chatEndpoint: chatEndpoint,
  nonEmptyText: nonEmptyText,
  normalizeConfig: normalizeConfig,
  optionValue: optionValue,
  redactSensitiveText: redactSensitiveText,
  secureBaseUrl: secureBaseUrl,
  thinkingFields: thinkingFields
};
