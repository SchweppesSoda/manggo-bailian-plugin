import { nonEmptyText, normalizedBoolean, selectedValue } from "./config.js";
import { modelCapability } from "./catalog.js";

const VALID_EFFORTS = Object.freeze({ auto: true, low: true, medium: true, high: true });

export function thinkingFamily(model) {
  const id = nonEmptyText(model).toLowerCase();
  const capability = modelCapability(id);
  return capability ? capability.thinking : "unknown";
}

export function maximumThinkingTokens(model) {
  const capability = modelCapability(model);
  return capability && capability.maxThinkingTokens;
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
