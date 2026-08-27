import { DEFAULTS, boundedInteger, chatEndpoint, nonEmptyText, normalizedBoolean } from "./config.js";
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
  const raw = nonEmptyText(input);
  if (!raw) throw new Error("Image content is required.");
  const url = /^data:image\//i.test(raw)
    ? raw
    : `data:image/png;base64,${raw.replace(/\s+/g, "")}`;
  if (url.length > MAX_IMAGE_DATA_URL_CHARS) throw new Error("Image data exceeds the 20 MB Data URL limit.");
  return url;
}

export function ocrRequest(base64, language, config = {}) {
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
export function validateConfig(config = {}) {
  const request = requestBase(config, 4096);
  return { endpoint: chatEndpoint(config), model: request.model };
}
