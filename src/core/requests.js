import { DEFAULTS, boundedInteger, chatEndpoint, nonEmptyText, normalizedBoolean } from "./config.js";
import { SERVICE_KIND, supportsMaxPixels, validateModelForService } from "./catalog.js";
import { languageName } from "./languages.js";
import { thinkingFields } from "./models.js";

export const TRANSLATION_INSTRUCTION = [
  "You are a professional translation engine.",
  "Translate faithfully and naturally, preserving paragraphs, line breaks, lists, punctuation, names, numbers, and technical terms.",
  "Return only the translated text without explanations, labels, quotes, or Markdown fences.",
].join(" ");

export const OCR_INSTRUCTION = [
  "You are a precise OCR transcription engine.",
  "Transcribe every visible character without translating, summarizing, correcting, or inventing content.",
  "Preserve reading order, paragraphs, lists, and line breaks. Return only the recognized text.",
].join(" ");

export const MAX_IMAGE_DATA_URL_CHARS = 20 * 1024 * 1024;

export const OCR_RESOLUTION_PRESETS = Object.freeze({
  auto: undefined,
  fast: 1048576,
  high: 8388608,
});

export function requestBase(config = {}, maxTokens) {
  const model = nonEmptyText(config.model, DEFAULTS.model);
  return {
    model,
    messages: [],
    temperature: 0.1,
    max_tokens: boundedInteger(config.maxTokens, maxTokens),
    stream: normalizedBoolean(config.stream, true),
    ...thinkingFields(model, normalizedBoolean(config.enableThinking, false), config.reasoningEffort),
  };
}

export function translationRequest(text, from, to, config = {}, detected) {
  validateModelForService(config, SERVICE_KIND.TRANSLATION);
  const request = requestBase(config, 4096);
  const source = languageName(from, detected);
  const target = languageDisplayTarget(to);

  if (request.model.toLowerCase().indexOf("qwen-mt-") === 0) {
    request.messages = [{ role: "user", content: String(text) }];
    request.translation_options = {
      source_lang: source === "Auto detect" ? "auto" : source,
      target_lang: target,
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
        String(text),
      ].join("\n"),
    },
  ];
  return request;
}

function languageDisplayTarget(input) {
  const name = languageName(input);
  return name === "Auto detect" ? "English" : name;
}

export function imageUrl(input) {
  if (input === undefined || input === null) throw new Error("Image content is required.");
  let raw = String(input);
  if (!raw.trim()) throw new Error("Image content is required.");
  if (/^\s|\s$/.test(raw)) raw = raw.trim();
  const isDataUrl = /^data:image\//i.test(raw);
  const estimatedLength = isDataUrl ? raw.length : "data:image/png;base64,".length + raw.length;
  if (estimatedLength > MAX_IMAGE_DATA_URL_CHARS) {
    throw new Error("Image data exceeds the 20 MB Data URL limit.");
  }
  if (/\s/.test(raw)) raw = raw.replace(/\s+/g, "");
  const url = isDataUrl ? raw : `data:image/png;base64,${raw}`;
  if (url.length > MAX_IMAGE_DATA_URL_CHARS) throw new Error("Image data exceeds the 20 MB Data URL limit.");
  return url;
}

export function ocrRequest(base64, language, config = {}) {
  validateModelForService(config, SERVICE_KIND.OCR);
  const request = requestBase(config, 8192);
  const expectedLanguage = languageName(language);
  const resolution = nonEmptyText(config.ocrResolution, "auto").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(OCR_RESOLUTION_PRESETS, resolution)) {
    throw new Error(`Unsupported OCR resolution: ${config.ocrResolution}.`);
  }
  const maxPixels = OCR_RESOLUTION_PRESETS[resolution];
  if (maxPixels && !supportsMaxPixels(request.model)) {
    throw new Error(`Model ${request.model} does not support the plugin's OCR resolution setting.`);
  }
  const imageContent = { type: "image_url", image_url: { url: imageUrl(base64) } };
  if (maxPixels) imageContent.max_pixels = maxPixels;
  const userMessage = {
    role: "user",
    content: [
      imageContent,
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

/** A pure request/endpoint pair for a platform-specific transport. */
export function createTranslationCall(text, from, to, config = {}, detected) {
  return {
    url: chatEndpoint(config),
    body: translationRequest(text, from, to, config, detected),
  };
}

/** A pure OCR request/endpoint pair for a platform-specific transport. */
export function createOcrCall(base64, language, config = {}) {
  return {
    url: chatEndpoint(config),
    body: ocrRequest(base64, language, config),
  };
}

/**
 * Validate the shared routing and model rules without sending a request.
 * The platform adapter remains responsible for checking its own credentials.
 */
export function validateConfig(config = {}, service) {
  validateModelForService(config, service);
  const request = requestBase(config, 4096);
  return { endpoint: chatEndpoint(config), model: request.model };
}
