import { ACCESS_MODE, DEFAULTS, nonEmptyText } from "./config.js";

export const SERVICE_KIND = Object.freeze({
  TRANSLATION: "translation",
  OCR: "ocr",
});

// Coding Plan entries were verified against the official Alibaba Cloud list
// on 2026-08-28. The plan has no model-discovery API, so changes stay explicit.
export const MODEL_CATALOG = Object.freeze({
  "qwen3.7-plus": { coding: true, token: true, vision: true, thinking: "budget", maxThinkingTokens: 262144, maxPixels: true },
  "qwen3.6-plus": { coding: true, vision: true, thinking: "budget", maxThinkingTokens: 81920, maxPixels: true },
  "qwen3.5-plus": { coding: true, vision: true, thinking: "budget", maxThinkingTokens: 81920, maxPixels: true },
  "kimi-k2.5": { coding: true, vision: true, thinking: "budget", maxThinkingTokens: 81920, maxPixels: false },
  "glm-5": { coding: true, vision: false, thinking: "budget", maxThinkingTokens: 32768, maxPixels: false },
  "minimax-m2.5": { coding: true, vision: false, thinking: "always", maxPixels: false },
  "qwen3-max-2026-01-23": { coding: true, vision: false, thinking: "budget", maxThinkingTokens: 81920, maxPixels: false },
  "qwen3-coder-next": { coding: true, vision: false, thinking: "unsupported", maxPixels: false },
  "qwen3-coder-plus": { coding: true, vision: false, thinking: "unsupported", maxPixels: false },
  "glm-4.7": { coding: true, vision: false, thinking: "budget", maxThinkingTokens: 32768, maxPixels: false },

  "qwen3.8-max": { coding: false, token: true, vision: true, thinking: "qwen38", maxPixels: true },
  "qwen3.8-max-preview": { coding: false, token: true, vision: true, thinking: "qwen38", maxPixels: true },
  "qwen3.8-flash": { coding: false, token: true, vision: true, thinking: "qwen38", maxPixels: true },
  "qwen3.7-max": { coding: false, token: true, vision: false, thinking: "budget", maxThinkingTokens: 262144, maxPixels: false },
  "qwen3.7-flash": { coding: false, vision: true, thinking: "budget", maxThinkingTokens: 262144, maxPixels: true },
  "qwen3.6-flash": { coding: false, token: true, vision: true, thinking: "budget", maxThinkingTokens: 81920, maxPixels: true },
  "qwen3.5-ocr": { coding: false, vision: true, thinking: "unsupported", maxPixels: true, ocrOnly: true },
  "qwen-mt-plus": { coding: false, vision: false, thinking: "unsupported", maxPixels: false, translationOnly: true },
  "qwen-mt-turbo": { coding: false, vision: false, thinking: "unsupported", maxPixels: false, translationOnly: true },
  "qwen-mt-flash": { coding: false, vision: false, thinking: "unsupported", maxPixels: false, translationOnly: true },
  "qwen-mt-lite": { coding: false, vision: false, thinking: "unsupported", maxPixels: false, translationOnly: true },
});

export function modelCapability(model) {
  return MODEL_CATALOG[nonEmptyText(model).toLowerCase()];
}

export function validateModelForService(config = {}, service) {
  const model = nonEmptyText(config.model, DEFAULTS.model);
  const mode = nonEmptyText(config.accessMode, DEFAULTS.accessMode).toLowerCase();
  const capability = modelCapability(model);

  if (mode === ACCESS_MODE.CODING && (!capability || !capability.coding)) {
    throw new Error(`Model ${model} is not in the plugin's verified Coding Plan model list.`);
  }
  if (mode === ACCESS_MODE.TOKEN && (!capability || !capability.token)) {
    throw new Error(`Model ${model} is not in the plugin's verified Token Plan model list.`);
  }
  if (service === SERVICE_KIND.OCR && capability && !capability.vision) {
    throw new Error(`Model ${model} does not support image input and cannot be used for OCR.`);
  }
  if (service === SERVICE_KIND.TRANSLATION && capability && capability.ocrOnly) {
    throw new Error(`Model ${model} is an OCR-only model and cannot be used for translation.`);
  }
  return capability;
}

export function supportsMaxPixels(model) {
  const capability = modelCapability(model);
  return Boolean(capability && capability.maxPixels);
}
