// Generated from src/core by npm run build. Do not edit directly.
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/core/bob-streaming-entry.js
var bob_streaming_entry_exports = {};
__export(bob_streaming_entry_exports, {
  contentText: () => contentText,
  createStreamBatcher: () => createStreamBatcher,
  eventData: () => eventData,
  parseSseEvent: () => parseSseEvent
});
module.exports = __toCommonJS(bob_streaming_entry_exports);

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
  if (decoded && decoded.error) {
    throw new Error("Model Studio returned a streaming error.");
  }
  const choice = decoded && decoded.choices && decoded.choices[0];
  if (!choice) return { addition: "", done: false, truncated: false };
  return {
    addition: contentText(choice.delta && choice.delta.content),
    done: false,
    truncated: choice.finish_reason === "length"
  };
}

// src/core/streaming.js
var DEFAULT_MIN_INTERVAL_MS = 60;
var DEFAULT_MAX_PENDING_CHARS = 96;
function positiveInteger(input, fallback) {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}
function createStreamBatcher(emit, options = {}) {
  const mode = options.mode === "snapshot" ? "snapshot" : "delta";
  const minIntervalMs = positiveInteger(options.minIntervalMs, DEFAULT_MIN_INTERVAL_MS);
  const maxPendingChars = positiveInteger(options.maxPendingChars, DEFAULT_MAX_PENDING_CHARS);
  const now = typeof options.now === "function" ? options.now : Date.now;
  const resultParts = [];
  let pendingParts = [];
  let pendingChars = 0;
  let emitted = false;
  let stopped = false;
  let lastFlushAt = 0;
  function snapshot() {
    return resultParts.join("");
  }
  function flush(at = now()) {
    if (stopped || pendingChars === 0) return "";
    const output = mode === "snapshot" ? snapshot() : pendingParts.join("");
    pendingParts = [];
    pendingChars = 0;
    emitted = true;
    lastFlushAt = at;
    if (typeof emit === "function") emit(output);
    return output;
  }
  function push(input, at = now()) {
    if (stopped || input === void 0 || input === null) return false;
    const addition = String(input);
    if (!addition) return false;
    resultParts.push(addition);
    pendingParts.push(addition);
    pendingChars += addition.length;
    const elapsed = emitted ? at - lastFlushAt : Number.POSITIVE_INFINITY;
    const boundary = pendingChars >= 32 && /[\n\r。！？.!?]\s*$/.test(addition);
    if (!emitted || pendingChars >= maxPendingChars || elapsed >= minIntervalMs || boundary) {
      flush(at);
      return true;
    }
    return false;
  }
  function finish(at = now()) {
    if (!stopped) flush(at);
    stopped = true;
    return snapshot();
  }
  function cancel() {
    stopped = true;
    pendingParts = [];
    pendingChars = 0;
  }
  return {
    cancel,
    finish,
    flush,
    push,
    snapshot
  };
}
var STREAM_BATCH_DEFAULTS = Object.freeze({
  minIntervalMs: DEFAULT_MIN_INTERVAL_MS,
  maxPendingChars: DEFAULT_MAX_PENDING_CHARS
});
