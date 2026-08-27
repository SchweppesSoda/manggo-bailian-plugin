import { nonEmptyText, normalizedBoolean, selectedValue } from "./config.js";

const VALID_EFFORTS = Object.freeze({ auto: true, low: true, medium: true, high: true });

export function thinkingFamily(model) {
  const id = nonEmptyText(model).toLowerCase();
  if (id === "qwen3.8-max" || id === "qwen3.8-max-preview") return "qwen38";
  if (id === "minimax-m2.5") return "always";
  if (
    id === "qwen3-coder-next"
    || id === "qwen3-coder-plus"
    || id.indexOf("qwen-mt-") === 0
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

export function maximumThinkingTokens(model) {
  const id = nonEmptyText(model).toLowerCase();
  if (/^qwen3\.7-/.test(id)) return 262144;
  if (/^qwen3\.(5|6)-/.test(id) || /^qwen3-max-/.test(id) || id === "kimi-k2.5") return 81920;
  if (/^glm-(4\.7|5)$/.test(id)) return 32768;
  return undefined;
}

export function effortLevel(input) {
  return selectedValue(input, "auto", VALID_EFFORTS, "Reasoning effort");
}

export function thinkingFields(model, enabled, effort) {
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
