// Generated from src/core by npm run build. Do not edit directly.
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/core/index.js
var index_exports = {};
__export(index_exports, {
  ACCESS_MODE: () => ACCESS_MODE,
  DEFAULTS: () => DEFAULTS,
  LANGUAGE_MAPPINGS: () => LANGUAGE_MAPPINGS,
  MAX_IMAGE_DATA_URL_CHARS: () => MAX_IMAGE_DATA_URL_CHARS,
  OCR_INSTRUCTION: () => OCR_INSTRUCTION,
  PLAN_ENDPOINTS: () => PLAN_ENDPOINTS,
  SHARED_PAYG_ENDPOINTS: () => SHARED_PAYG_ENDPOINTS,
  TRANSLATION_INSTRUCTION: () => TRANSLATION_INSTRUCTION,
  applySseEvent: () => applySseEvent,
  automaticBaseUrl: () => automaticBaseUrl,
  bobLanguageCode: () => bobLanguageCode,
  boundedInteger: () => boundedInteger,
  chatEndpoint: () => chatEndpoint,
  contentText: () => contentText,
  createOcrCall: () => createOcrCall,
  createSseState: () => createSseState,
  createTranslationCall: () => createTranslationCall,
  effortLevel: () => effortLevel,
  eventData: () => eventData,
  formatHttpError: () => formatHttpError,
  imageUrl: () => imageUrl,
  languageDisplayName: () => languageDisplayName,
  languageName: () => languageName,
  maximumThinkingTokens: () => maximumThinkingTokens,
  nonEmptyText: () => nonEmptyText,
  normalizedBoolean: () => normalizedBoolean,
  ocrRequest: () => ocrRequest,
  parseJsonCompletion: () => parseJsonCompletion,
  parseSseEvent: () => parseSseEvent,
  redactSensitiveText: () => redactSensitiveText,
  requestBase: () => requestBase,
  secureBaseUrl: () => secureBaseUrl,
  selectedValue: () => selectedValue,
  serviceErrorDetail: () => serviceErrorDetail,
  thinkingFamily: () => thinkingFamily,
  thinkingFields: () => thinkingFields,
  translationRequest: () => translationRequest,
  validateConfig: () => validateConfig
});
module.exports = __toCommonJS(index_exports);

// src/core/config.js
var ACCESS_MODE = Object.freeze({
  PAYG: "pay_as_you_go",
  CODING: "coding_plan",
  TOKEN: "token_plan"
});
var DEFAULTS = Object.freeze({
  accessMode: ACCESS_MODE.PAYG,
  region: "china",
  model: "qwen3.7-plus"
});
var VALID_ACCESS_MODES = Object.freeze({
  pay_as_you_go: true,
  coding_plan: true,
  token_plan: true
});
var VALID_REGIONS = Object.freeze({ china: true, singapore: true });
var SHARED_PAYG_ENDPOINTS = Object.freeze({
  china: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  singapore: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
});
var PLAN_ENDPOINTS = Object.freeze({
  [ACCESS_MODE.CODING]: "https://coding.dashscope.aliyuncs.com/v1",
  [ACCESS_MODE.TOKEN]: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
});
function nonEmptyText(input, fallback = "") {
  if (input === void 0 || input === null) return fallback;
  const candidate = String(input).trim();
  return candidate.length > 0 ? candidate : fallback;
}
function normalizedBoolean(input, fallback = false) {
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
    off: false
  };
  const key = input.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback;
}
function boundedInteger(input, fallback, minimum = 1, maximum = 131072) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)));
}
function selectedValue(input, fallback, allowed, label) {
  const selected = nonEmptyText(input, fallback).toLowerCase();
  if (!allowed[selected]) throw new Error(`Unsupported ${label}: ${input}.`);
  return selected;
}
function hasProtocol(input) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
}
function validAuthority(authority) {
  if (/^\[[0-9a-f:.]+\](?::\d+)?$/i.test(authority)) return true;
  return /^[a-z0-9][a-z0-9.-]*(?::\d+)?$/i.test(authority);
}
function secureBaseUrl(input) {
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
function automaticBaseUrl(config = {}) {
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
function chatEndpoint(config = {}) {
  const base = automaticBaseUrl(config);
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

// src/core/languages.js
var LANGUAGE_ENTRIES = [
  { name: "English", bob: "en", aliases: ["en", "en_us", "en-us", "english"] },
  { name: "Simplified Chinese", bob: "zh-Hans", aliases: ["zh", "zh_cn", "zh-cn", "zh-hans", "simplified chinese", "chinese"] },
  { name: "Traditional Chinese", bob: "zh-Hant", aliases: ["zh_tw", "zh-tw", "zh-hant", "traditional chinese"] },
  { name: "Cantonese", bob: "yue", aliases: ["yue", "cantonese"] },
  { name: "Japanese", bob: "ja", aliases: ["ja", "ja_jp", "ja-jp", "japanese"] },
  { name: "Korean", bob: "ko", aliases: ["ko", "ko_kr", "ko-kr", "korean"] },
  { name: "French", bob: "fr", aliases: ["fr", "fr_fr", "fr-fr", "french"] },
  { name: "German", bob: "de", aliases: ["de", "de_de", "de-de", "german"] },
  { name: "Spanish", bob: "es", aliases: ["es", "es_es", "es-es", "spanish"] },
  { name: "Italian", bob: "it", aliases: ["it", "it_it", "it-it", "italian"] },
  { name: "Russian", bob: "ru", aliases: ["ru", "ru_ru", "ru-ru", "russian"] },
  { name: "Portuguese", bob: "pt", aliases: ["pt", "portuguese"] },
  { name: "Portuguese (Portugal)", bob: "pt-pt", aliases: ["pt-pt", "pt_pt", "portuguese (portugal)"] },
  { name: "Portuguese (Brazil)", bob: "pt-br", aliases: ["pt-br", "pt_br", "portuguese (brazil)"] },
  { name: "Dutch", bob: "nl", aliases: ["nl", "dutch"] },
  { name: "Polish", bob: "pl", aliases: ["pl", "polish"] },
  { name: "Arabic", bob: "ar", aliases: ["ar", "arabic"] },
  { name: "Turkish", bob: "tr", aliases: ["tr", "turkish"] },
  { name: "Vietnamese", bob: "vi", aliases: ["vi", "vi_vn", "vi-vn", "vietnamese"] },
  { name: "Thai", bob: "th", aliases: ["th", "thai"] },
  { name: "Indonesian", bob: "id", aliases: ["id", "indonesian"] },
  { name: "Malay", bob: "ms", aliases: ["ms", "malay"] },
  { name: "Hindi", bob: "hi", aliases: ["hi", "hindi"] },
  { name: "Bengali", bob: "bn", aliases: ["bn", "bengali"] },
  { name: "Ukrainian", bob: "uk", aliases: ["uk", "uk_ua", "uk-ua", "ukrainian"] },
  { name: "Czech", bob: "cs", aliases: ["cs", "czech"] },
  { name: "Swedish", bob: "sv", aliases: ["sv", "swedish"] },
  { name: "Danish", bob: "da", aliases: ["da", "danish"] },
  { name: "Norwegian", bob: "no", aliases: ["no", "norwegian"] },
  { name: "Finnish", bob: "fi", aliases: ["fi", "finnish"] },
  { name: "Greek", bob: "el", aliases: ["el", "greek"] },
  { name: "Hebrew", bob: "he", aliases: ["he", "hebrew"] },
  { name: "Romanian", bob: "ro", aliases: ["ro", "romanian"] },
  { name: "Hungarian", bob: "hu", aliases: ["hu", "hungarian"] },
  { name: "Bulgarian", bob: "bg", aliases: ["bg", "bulgarian"] },
  { name: "Slovak", bob: "sk", aliases: ["sk", "slovak"] },
  { name: "Slovenian", bob: "sl", aliases: ["sl", "slovenian"] },
  { name: "Catalan", bob: "ca", aliases: ["ca", "catalan"] },
  { name: "Persian", bob: "fa", aliases: ["fa", "persian"] },
  { name: "Urdu", bob: "ur", aliases: ["ur", "urdu"] }
];
var BY_ALIAS = /* @__PURE__ */ Object.create(null);
var BY_BOB = /* @__PURE__ */ Object.create(null);
for (let index = 0; index < LANGUAGE_ENTRIES.length; index += 1) {
  const entry = LANGUAGE_ENTRIES[index];
  BY_BOB[entry.bob.toLowerCase()] = entry;
  for (let aliasIndex = 0; aliasIndex < entry.aliases.length; aliasIndex += 1) {
    BY_ALIAS[entry.aliases[aliasIndex]] = entry;
  }
}
function lookup(input) {
  const raw = nonEmptyText(input);
  if (!raw || raw.toLowerCase() === "auto") return void 0;
  return BY_ALIAS[raw.toLowerCase().replace(/_/g, "-").replace(/-/g, "-")] || BY_ALIAS[raw.toLowerCase()] || BY_BOB[raw.toLowerCase()];
}
function languageDisplayName(input, fallback = "") {
  const raw = nonEmptyText(input, fallback);
  if (!raw || raw.toLowerCase() === "auto") return raw;
  const entry = lookup(raw);
  return entry ? entry.name : raw;
}
function languageName(requested, detected) {
  const explicit = languageDisplayName(requested);
  if (explicit && explicit.toLowerCase() !== "auto") return explicit;
  const fallback = languageDisplayName(detected);
  return fallback && fallback.toLowerCase() !== "auto" ? fallback : "Auto detect";
}
function bobLanguageCode(input, fallback = "auto") {
  const raw = nonEmptyText(input, fallback);
  if (!raw || raw.toLowerCase() === "auto") return "auto";
  const entry = lookup(raw);
  return entry ? entry.bob : raw;
}
var LANGUAGE_MAPPINGS = Object.freeze(LANGUAGE_ENTRIES.map((entry) => Object.freeze({
  name: entry.name,
  bob: entry.bob
})));

// src/core/models.js
var VALID_EFFORTS = Object.freeze({ auto: true, low: true, medium: true, high: true });
function thinkingFamily(model) {
  const id = nonEmptyText(model).toLowerCase();
  if (id === "qwen3.8-max" || id === "qwen3.8-max-preview") return "qwen38";
  if (id === "minimax-m2.5") return "always";
  if (id === "qwen3-coder-next" || id === "qwen3-coder-plus" || id.indexOf("qwen-mt-") === 0 || id === "qwen3.5-ocr") return "unsupported";
  if (/^qwen3\.(5|6|7)-/.test(id) || /^qwen3-max-/.test(id) || id === "kimi-k2.5" || /^glm-(4\.7|5)$/.test(id)) return "budget";
  return "unknown";
}
function maximumThinkingTokens(model) {
  const id = nonEmptyText(model).toLowerCase();
  if (/^qwen3\.7-/.test(id)) return 262144;
  if (/^qwen3\.(5|6)-/.test(id) || /^qwen3-max-/.test(id) || id === "kimi-k2.5") return 81920;
  if (/^glm-(4\.7|5)$/.test(id)) return 32768;
  return void 0;
}
function effortLevel(input) {
  return selectedValue(input, "auto", VALID_EFFORTS, "Reasoning effort");
}
function thinkingFields(model, enabled, effort) {
  const family = thinkingFamily(model);
  const level = effortLevel(effort);
  const isEnabled = normalizedBoolean(enabled, false);
  if (family === "unknown") {
    if (isEnabled) throw new Error(`Model ${model} is not in the plugin's thinking compatibility table.`);
    return {};
  }
  if (family === "unsupported") {
    if (isEnabled) throw new Error(`Model ${model} is not configured for selectable thinking mode.`);
    return {};
  }
  if (family === "always") {
    if (!isEnabled) throw new Error(`Model ${model} is always-thinking; turn on Enable thinking to use it.`);
    if (level !== "auto") throw new Error(`Model ${model} does not support configurable Reasoning effort in this plugin.`);
    return {};
  }
  if (family === "qwen38") {
    if (!isEnabled) return { reasoning_effort: "none" };
    if (level === "auto") return {};
    return { reasoning_effort: level === "high" ? "xhigh" : level };
  }
  const fields = { enable_thinking: isEnabled };
  if (!isEnabled || level === "auto") return fields;
  const maximum = maximumThinkingTokens(model);
  if (!maximum) throw new Error(`Model ${model} does not support configurable Reasoning effort in this plugin.`);
  if (level === "low") fields.thinking_budget = Math.min(4096, maximum);
  if (level === "medium") fields.thinking_budget = Math.min(16384, maximum);
  if (level === "high") fields.thinking_budget = maximum;
  return fields;
}

// src/core/requests.js
var TRANSLATION_INSTRUCTION = [
  "You are a professional translation engine.",
  "Translate faithfully and naturally, preserving paragraphs, line breaks, lists, punctuation, names, numbers, and technical terms.",
  "Return only the translated text without explanations, labels, quotes, or Markdown fences."
].join(" ");
var OCR_INSTRUCTION = [
  "You are a precise OCR transcription engine.",
  "Transcribe every visible character without translating, summarizing, correcting, or inventing content.",
  "Preserve reading order, paragraphs, lists, and line breaks. Return only the recognized text."
].join(" ");
var MAX_IMAGE_DATA_URL_CHARS = 20 * 1024 * 1024;
function requestBase(config = {}, maxTokens) {
  const model = nonEmptyText(config.model, DEFAULTS.model);
  return __spreadValues({
    model,
    messages: [],
    temperature: 0.1,
    max_tokens: boundedInteger(config.maxTokens, maxTokens),
    stream: normalizedBoolean(config.stream, true)
  }, thinkingFields(model, normalizedBoolean(config.enableThinking, false), config.reasoningEffort));
}
function translationRequest(text, from, to, config = {}, detected) {
  const request = requestBase(config, 4096);
  const source = languageName(from, detected);
  const target = languageDisplayTarget(to);
  if (request.model.toLowerCase().indexOf("qwen-mt-") === 0) {
    request.messages = [{ role: "user", content: String(text) }];
    request.translation_options = {
      source_lang: source === "Auto detect" ? "auto" : source,
      target_lang: target
    };
    if (request.model.toLowerCase() === "qwen-mt-plus" || request.model.toLowerCase() === "qwen-mt-turbo") {
      request.stream = false;
    }
    return request;
  }
  request.messages = [
    { role: "system", content: nonEmptyText(config.systemPrompt, TRANSLATION_INSTRUCTION) },
    {
      role: "user",
      content: [
        `Source language: ${source}`,
        `Target language: ${target}`,
        "Translate the text below. Return only the translation.",
        "",
        String(text)
      ].join("\n")
    }
  ];
  return request;
}
function languageDisplayTarget(input) {
  const name = languageName(input);
  return name === "Auto detect" ? "English" : name;
}
function imageUrl(input) {
  const raw = nonEmptyText(input);
  if (!raw) throw new Error("Image content is required.");
  const url = /^data:image\//i.test(raw) ? raw : `data:image/png;base64,${raw.replace(/\s+/g, "")}`;
  if (url.length > MAX_IMAGE_DATA_URL_CHARS) throw new Error("Image data exceeds the 20 MB Data URL limit.");
  return url;
}
function ocrRequest(base64, language, config = {}) {
  const request = requestBase(config, 8192);
  const expectedLanguage = languageName(language);
  const userMessage = {
    role: "user",
    content: [
      { type: "image_url", image_url: { url: imageUrl(base64) } },
      {
        type: "text",
        text: [
          `Expected language: ${expectedLanguage}.`,
          "Extract all visible text. Preserve reading order and line breaks.",
          "Do not translate or explain. If no text is visible, return an empty string."
        ].join("\n")
      }
    ]
  };
  request.messages = request.model.toLowerCase() === "qwen3.5-ocr" ? [userMessage] : [
    { role: "system", content: nonEmptyText(config.systemPrompt, OCR_INSTRUCTION) },
    userMessage
  ];
  return request;
}
function createTranslationCall(text, from, to, config = {}, detected) {
  return {
    url: chatEndpoint(config),
    body: translationRequest(text, from, to, config, detected)
  };
}
function createOcrCall(base64, language, config = {}) {
  return {
    url: chatEndpoint(config),
    body: ocrRequest(base64, language, config)
  };
}
function validateConfig(config = {}) {
  const request = requestBase(config, 4096);
  return { endpoint: chatEndpoint(config), model: request.model };
}

// src/core/errors.js
var STATUS_HINTS = Object.freeze({
  400: "Check the model and request settings.",
  401: "Check that the API Key, billing mode, region, and Base URL belong together.",
  403: "The selected model or client scenario may not be permitted.",
  429: "Usage or rate limit reached; retry later."
});
function redactSensitiveText(input, sensitiveValues) {
  let message = nonEmptyText(input, "Unknown service error");
  const values = Array.isArray(sensitiveValues) ? sensitiveValues : [sensitiveValues];
  for (let index = 0; index < values.length; index += 1) {
    const value = nonEmptyText(values[index]);
    if (value) message = message.split(value).join("[REDACTED]");
  }
  return message.length <= 800 ? message : `${message.slice(0, 800)}\u2026`;
}
function serviceErrorDetail(rawBody) {
  const raw = nonEmptyText(rawBody);
  if (!raw) return raw;
  try {
    const decoded = JSON.parse(raw);
    return decoded && decoded.error && decoded.error.message ? decoded.error.message : decoded && decoded.message ? decoded.message : raw;
  } catch (_) {
    return raw;
  }
}
function formatHttpError(status, rawBody, sensitiveValues) {
  const hint = STATUS_HINTS[Number(status)] || "Model Studio request failed.";
  const detail = redactSensitiveText(serviceErrorDetail(rawBody), sensitiveValues);
  return `${hint} ${detail}`.trim();
}

// src/core/responses.js
function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let result = "";
  for (let index = 0; index < content.length; index += 1) {
    const part = content[index];
    if (typeof part === "string") result += part;
    else if (part && typeof part.text === "string") result += part.text;
  }
  return result;
}
function parseJsonCompletion(payload, allowEmpty = false) {
  let body;
  try {
    body = typeof payload === "string" ? JSON.parse(payload) : payload;
  } catch (_) {
    throw new Error("Model Studio returned an invalid JSON response.");
  }
  const choice = body && body.choices && body.choices[0];
  if (!choice) throw new Error("Model Studio response did not include a completion choice.");
  if (choice.finish_reason === "length") {
    throw new Error("Model Studio output was truncated; increase Max tokens or reduce the input.");
  }
  const result = contentText(choice.message && choice.message.content);
  if (!allowEmpty && !result.trim()) {
    throw new Error("Model Studio response did not include result text.");
  }
  return result;
}
function eventData(block) {
  return String(block).split("\n").filter((line) => line.indexOf("data:") === 0).map((line) => line.slice(5).replace(/^\s+/, "")).join("\n").trim();
}
function parseSseEvent(block) {
  const data = eventData(block);
  if (!data || data === "[DONE]") {
    return { addition: "", done: data === "[DONE]", truncated: false };
  }
  let decoded;
  try {
    decoded = JSON.parse(data);
  } catch (_) {
    throw new Error("Model Studio returned an invalid streaming event.");
  }
  const choice = decoded && decoded.choices && decoded.choices[0];
  if (!choice) return { addition: "", done: false, truncated: false };
  return {
    addition: contentText(choice.delta && choice.delta.content),
    done: false,
    truncated: choice.finish_reason === "length"
  };
}
function createSseState() {
  return { result: "", truncated: false };
}
function applySseEvent(block, state = createSseState()) {
  const event = parseSseEvent(block);
  return {
    addition: event.addition,
    done: event.done,
    state: {
      result: state.result + event.addition,
      truncated: Boolean(state.truncated || event.truncated)
    }
  };
}
