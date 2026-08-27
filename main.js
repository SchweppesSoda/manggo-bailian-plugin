const ACCESS_MODE = Object.freeze({
  PAYG: "pay_as_you_go",
  CODING: "coding_plan",
  TOKEN: "token_plan",
});
const DEFAULTS = Object.freeze({
  accessMode: ACCESS_MODE.PAYG,
  region: "china",
  model: "qwen3.7-plus",
});
const VALID_ACCESS_MODES = new Set(Object.values(ACCESS_MODE));
const VALID_REGIONS = new Set(["china", "singapore"]);
const VALID_EFFORTS = new Set(["auto", "low", "medium", "high"]);
const SHARED_PAYG_ENDPOINTS = Object.freeze({
  china: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  singapore: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});
const PLAN_ENDPOINTS = Object.freeze({
  [ACCESS_MODE.CODING]: "https://coding.dashscope.aliyuncs.com/v1",
  [ACCESS_MODE.TOKEN]: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
});
const TRANSLATION_INSTRUCTION = [
  "You are a professional translation engine.",
  "Translate faithfully and naturally, preserving paragraphs, line breaks, lists, punctuation, names, numbers, and technical terms.",
  "Return only the translated text without explanations, labels, quotes, or Markdown fences.",
].join(" ");
const OCR_INSTRUCTION = [
  "You are a precise OCR transcription engine.",
  "Transcribe every visible character without translating, summarizing, correcting, or inventing content.",
  "Preserve reading order, paragraphs, lists, and line breaks. Return only the recognized text.",
].join(" ");
const MAX_IMAGE_DATA_URL_CHARS = 20 * 1024 * 1024;

function nonEmptyText(input, fallback = "") {
  if (input === undefined || input === null) return fallback;
  const candidate = `${input}`.trim();
  return candidate.length > 0 ? candidate : fallback;
}

function normalizedBoolean(input, fallback = false) {
  if (input === true || input === false) return input;
  if (typeof input !== "string") return fallback;
  const values = { true: true, "1": true, yes: true, on: true, false: false, "0": false, no: false, off: false };
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
  if (!allowed.has(selected)) throw new Error(`Unsupported ${label}: ${input}.`);
  return selected;
}

function secureBaseUrl(input) {
  let parsed;
  try {
    parsed = new URL(nonEmptyText(input));
  } catch (_) {
    throw new Error("Base URL must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("Base URL must use HTTPS.");
  if (parsed.username || parsed.password) throw new Error("Base URL must not contain credentials.");
  if (parsed.search || parsed.hash) throw new Error("Base URL must not contain a query or fragment.");
  return parsed.toString().replace(/\/+$/, "");
}

function automaticBaseUrl(config) {
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

function chatEndpoint(config) {
  const base = automaticBaseUrl(config);
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

function thinkingFamily(model) {
  const id = nonEmptyText(model).toLowerCase();
  if (id === "qwen3.8-max" || id === "qwen3.8-max-preview") return "qwen38";
  if (id === "minimax-m2.5") return "always";
  if (
    id === "qwen3-coder-next"
    || id === "qwen3-coder-plus"
    || id.startsWith("qwen-mt-")
    || id === "qwen3.5-ocr"
  ) return "unsupported";
  if (
    /^qwen3\.(5|6|7)-/.test(id)
    || /^qwen3-max-/.test(id)
    || id === "kimi-k2.5"
    || /^glm-(4\.7|5)$/.test(id)
  ) return "budget";
  return "unknown";
}

function maximumThinkingTokens(model) {
  const id = nonEmptyText(model).toLowerCase();
  if (/^qwen3\.7-/.test(id)) return 262144;
  if (/^qwen3\.(5|6)-/.test(id) || /^qwen3-max-/.test(id) || id === "kimi-k2.5") return 81920;
  if (/^glm-(4\.7|5)$/.test(id)) return 32768;
  return undefined;
}

function effortLevel(input) {
  return selectedValue(input, "auto", VALID_EFFORTS, "Reasoning effort");
}

function thinkingFields(model, enabled, effort) {
  const family = thinkingFamily(model);
  const level = effortLevel(effort);

  if (family === "unknown") {
    if (enabled) throw new Error(`Model ${model} is not in the plugin's thinking compatibility table.`);
    return {};
  }
  if (family === "unsupported") {
    if (enabled) throw new Error(`Model ${model} is not configured for selectable thinking mode.`);
    return {};
  }
  if (family === "always") {
    if (!enabled) throw new Error(`Model ${model} is always-thinking; turn on Enable thinking to use it.`);
    if (level !== "auto") throw new Error(`Model ${model} does not support configurable Reasoning effort in this plugin.`);
    return {};
  }
  if (family === "qwen38") {
    if (!enabled) return { reasoning_effort: "none" };
    if (level === "auto") return {};
    return { reasoning_effort: level === "high" ? "xhigh" : level };
  }

  const fields = { enable_thinking: enabled };
  if (!enabled || level === "auto") return fields;
  const maximum = maximumThinkingTokens(model);
  if (!maximum) throw new Error(`Model ${model} does not support configurable Reasoning effort in this plugin.`);
  if (level === "low") fields.thinking_budget = Math.min(4096, maximum);
  if (level === "medium") fields.thinking_budget = Math.min(16384, maximum);
  if (level === "high") fields.thinking_budget = maximum;
  return fields;
}

function requestBase(options, maxTokens) {
  const config = options?.config ?? {};
  const model = nonEmptyText(config.model, DEFAULTS.model);
  return {
    model,
    messages: [],
    temperature: 0.1,
    max_tokens: boundedInteger(config.maxTokens, maxTokens),
    stream: normalizedBoolean(config.stream, true),
    ...thinkingFields(
      model,
      normalizedBoolean(config.enableThinking, false),
      config.reasoningEffort,
    ),
  };
}

function languageName(requested, detected) {
  const explicit = nonEmptyText(requested);
  if (explicit && explicit !== "auto") return explicit;
  const fallback = nonEmptyText(detected);
  return fallback && fallback !== "auto" ? fallback : "Auto detect";
}

function translationRequest(text, from, to, options) {
  const config = options?.config ?? {};
  const request = requestBase(options, 4096);
  const source = languageName(from, options?.detect);
  const target = nonEmptyText(to, "English");

  if (request.model.toLowerCase().startsWith("qwen-mt-")) {
    request.messages = [{ role: "user", content: text }];
    request.translation_options = {
      source_lang: source === "Auto detect" ? "auto" : source,
      target_lang: target,
    };
    if (["qwen-mt-plus", "qwen-mt-turbo"].includes(request.model.toLowerCase())) request.stream = false;
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
        text,
      ].join("\n"),
    },
  ];
  return request;
}

function imageUrl(input) {
  const raw = nonEmptyText(input);
  if (!raw) throw new Error("Image content is required.");
  const url = /^data:image\//i.test(raw)
    ? raw
    : `data:image/png;base64,${raw.replace(/\s+/g, "")}`;
  if (url.length > MAX_IMAGE_DATA_URL_CHARS) throw new Error("Image data exceeds the 20 MB Data URL limit.");
  return url;
}

function ocrRequest(base64, language, options) {
  const config = options?.config ?? {};
  const request = requestBase(options, 8192);
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
          "Do not translate or explain. If no text is visible, return an empty string.",
        ].join("\n"),
      },
    ],
  };
  request.messages = request.model.toLowerCase() === "qwen3.5-ocr"
    ? [userMessage]
    : [
      { role: "system", content: nonEmptyText(config.systemPrompt, OCR_INSTRUCTION) },
      userMessage,
    ];
  return request;
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let result = "";
  for (const part of content) {
    if (typeof part === "string") result += part;
    else if (typeof part?.text === "string") result += part.text;
  }
  return result;
}

function redactedMessage(input, apiKey) {
  let message = nonEmptyText(input, "Unknown service error");
  if (apiKey) message = message.replaceAll(apiKey, "[REDACTED]");
  return message.length <= 800 ? message : `${message.slice(0, 800)}…`;
}

async function responseError(response, apiKey) {
  let detail = "";
  try {
    detail = await response.text();
    const decoded = JSON.parse(detail);
    detail = decoded?.error?.message ?? decoded?.message ?? detail;
  } catch (_) {
    // Preserve non-JSON service error text.
  }
  const hints = {
    400: "Check the model and request settings.",
    401: "Check that the API Key, billing mode, region, and Base URL belong together.",
    403: "The selected model or client scenario may not be permitted.",
    429: "Usage or rate limit reached; retry later.",
  };
  return `${hints[response.status] ?? "Model Studio request failed."} ${redactedMessage(detail, apiKey)}`.trim();
}

async function sendRequest(request, options) {
  const config = options?.config ?? {};
  const apiKey = nonEmptyText(config.apiKey);
  if (!apiKey) throw new Error("Alibaba Cloud Model Studio API Key is required.");
  const fetcher = options?.utils?.fetch;
  if (typeof fetcher !== "function") throw new Error("Manggo network utility is unavailable.");

  const response = await fetcher(chatEndpoint(config), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: request.stream ? "text/event-stream" : "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await responseError(response, apiKey)}`);
  return response;
}

async function jsonCompletion(response, allowEmpty) {
  let body;
  try {
    body = JSON.parse(await response.text());
  } catch (_) {
    throw new Error("Model Studio returned an invalid JSON response.");
  }
  const choice = body?.choices?.[0];
  if (!choice) throw new Error("Model Studio response did not include a completion choice.");
  if (choice.finish_reason === "length") throw new Error("Model Studio output was truncated; increase Max tokens or reduce the input.");
  const result = contentText(choice?.message?.content);
  if (!allowEmpty && !result.trim()) throw new Error("Model Studio response did not include result text.");
  return result;
}

function eventData(block) {
  return block.split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
    .trim();
}

function applyStreamEvent(block, state, options) {
  const data = eventData(block);
  if (!data || data === "[DONE]") return;
  let decoded;
  try {
    decoded = JSON.parse(data);
  } catch (_) {
    throw new Error("Model Studio returned an invalid streaming event.");
  }
  const choice = decoded?.choices?.[0];
  if (!choice) return;
  if (choice.finish_reason === "length") state.truncated = true;
  const addition = contentText(choice?.delta?.content);
  if (!addition) return;
  state.result += addition;
  options?.setResult?.(addition);
}

async function streamCompletion(response, options, allowEmpty) {
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (/application\/json/i.test(contentType) || !response.body?.getReader) {
    return jsonCompletion(response, allowEmpty);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state = { result: "", truncated: false };
  let pending = "";

  const drain = (flush) => {
    pending = pending.replace(/\r\n/g, "\n");
    const blocks = pending.split("\n\n");
    pending = flush ? "" : (blocks.pop() ?? "");
    for (const block of blocks) applyStreamEvent(block, state, options);
  };

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    pending += decoder.decode(chunk.value, { stream: true });
    drain(false);
  }
  pending += decoder.decode();
  if (pending.trim()) {
    pending += "\n\n";
    drain(true);
  }

  if (state.truncated) throw new Error("Model Studio output was truncated; increase Max tokens or reduce the input.");
  if (!allowEmpty && !state.result.trim()) throw new Error("Model Studio stream did not include result text.");
  return state.result;
}

async function complete(request, options, allowEmpty) {
  const response = await sendRequest(request, options);
  return request.stream
    ? streamCompletion(response, options, allowEmpty)
    : jsonCompletion(response, allowEmpty);
}

export async function translate(text, from, to, options) {
  const input = `${text ?? ""}`;
  if (!input) return "";
  return complete(translationRequest(input, from, to, options), options, false);
}

export async function recognize(base64, language, options) {
  return complete(ocrRequest(base64, language, options), options, true);
}
