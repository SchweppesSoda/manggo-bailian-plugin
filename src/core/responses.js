export function contentText(content) {
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

export function parseJsonCompletion(payload, allowEmpty = false) {
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

export function eventData(block) {
  return String(block).split("\n")
    .filter((line) => line.indexOf("data:") === 0)
    .map((line) => line.slice(5).replace(/^\s+/, ""))
    .join("\n")
    .trim();
}

export function parseSseEvent(block) {
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
    truncated: choice.finish_reason === "length",
  };
}

export function createSseState() {
  return { result: "", truncated: false };
}

/**
 * Parse one complete SSE block and return a new state.  The caller owns all
 * runtime effects (stream reading and result callbacks), which keeps Core
 * usable by both Bun and Bob JavaScriptCore.
 */
export function applySseEvent(block, state = createSseState()) {
  const event = parseSseEvent(block);
  return {
    addition: event.addition,
    done: event.done,
    state: {
      result: state.result + event.addition,
      truncated: Boolean(state.truncated || event.truncated),
    },
  };
}
