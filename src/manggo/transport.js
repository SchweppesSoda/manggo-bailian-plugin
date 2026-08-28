import {
  chatEndpoint,
  createStreamBatcher,
  formatHttpError,
  nonEmptyText,
  parseJsonCompletion,
  parseSseEvent,
} from "../core/index.js";

function configFrom(options) {
  return options && options.config ? options.config : {};
}

function emitChunk(options, chunk) {
  if (options && typeof options.setResult === "function") options.setResult(chunk);
}

async function responseError(response, apiKey) {
  let rawBody = "";
  try {
    rawBody = await response.text();
  } catch (_) {
    // A failed response still benefits from a useful status hint.
  }
  return formatHttpError(response.status, rawBody, apiKey);
}

export async function sendRequest(request, options) {
  const config = configFrom(options);
  const apiKey = nonEmptyText(config.apiKey);
  if (!apiKey) throw new Error("Alibaba Cloud Model Studio API Key is required.");
  const fetcher = options && options.utils && options.utils.fetch;
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

export async function jsonCompletion(response, allowEmpty) {
  let rawBody;
  try {
    rawBody = await response.text();
  } catch (_) {
    throw new Error("Model Studio returned an invalid JSON response.");
  }
  return parseJsonCompletion(rawBody, allowEmpty);
}

function responseContentType(response) {
  const headers = response && response.headers;
  return headers && typeof headers.get === "function" ? (headers.get("content-type") || "") : "";
}

export async function streamCompletion(response, options, allowEmpty) {
  const contentType = responseContentType(response);
  if (/application\/json/i.test(contentType) || !response.body || typeof response.body.getReader !== "function") {
    return jsonCompletion(response, allowEmpty);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let truncated = false;
  const batcher = createStreamBatcher((addition) => emitChunk(options, addition), { mode: "delta" });

  const drain = (flush) => {
    pending = pending.replace(/\r\n/g, "\n");
    const blocks = pending.split("\n\n");
    pending = flush ? "" : (blocks.pop() || "");
    for (let index = 0; index < blocks.length; index += 1) {
      const event = parseSseEvent(blocks[index]);
      truncated = Boolean(truncated || event.truncated);
      if (event.addition) batcher.push(event.addition);
    }
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

  const result = batcher.finish();
  if (truncated) throw new Error("Model Studio output was truncated; increase Max tokens or reduce the input.");
  if (!allowEmpty && !result.trim()) throw new Error("Model Studio stream did not include result text.");
  return result;
}

export async function complete(request, options, allowEmpty) {
  const response = await sendRequest(request, options);
  return request.stream
    ? streamCompletion(response, options, allowEmpty)
    : jsonCompletion(response, allowEmpty);
}
