const DEFAULT_MIN_INTERVAL_MS = 60;
const DEFAULT_MAX_PENDING_CHARS = 96;

function positiveInteger(input, fallback) {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

/**
 * Collect model deltas without rebuilding the full result for every SSE event.
 *
 * `mode: "delta"` emits only text not previously sent (Manggo's contract).
 * `mode: "snapshot"` emits the complete result at a bounded rate (Bob's
 * contract). The first visible delta is always emitted immediately and finish
 * always flushes the tail.
 */
export function createStreamBatcher(emit, options = {}) {
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
    if (stopped || input === undefined || input === null) return false;
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
    snapshot,
  };
}

export const STREAM_BATCH_DEFAULTS = Object.freeze({
  minIntervalMs: DEFAULT_MIN_INTERVAL_MS,
  maxPendingChars: DEFAULT_MAX_PENDING_CHARS,
});
