import { nonEmptyText } from "./config.js";

const STATUS_HINTS = Object.freeze({
  400: "Check the model and request settings.",
  401: "Check that the API Key, billing mode, region, and Base URL belong together.",
  403: "The selected model or client scenario may not be permitted.",
  429: "Usage or rate limit reached; retry later.",
});

export function redactSensitiveText(input, sensitiveValues) {
  let message = nonEmptyText(input, "Unknown service error");
  const values = Array.isArray(sensitiveValues) ? sensitiveValues : [sensitiveValues];
  for (let index = 0; index < values.length; index += 1) {
    const value = nonEmptyText(values[index]);
    if (value) message = message.split(value).join("[REDACTED]");
  }
  return message.length <= 800 ? message : `${message.slice(0, 800)}…`;
}

export function serviceErrorDetail(rawBody) {
  const raw = nonEmptyText(rawBody);
  if (!raw) return raw;
  try {
    const decoded = JSON.parse(raw);
    return decoded && decoded.error && decoded.error.message
      ? decoded.error.message
      : (decoded && decoded.message ? decoded.message : raw);
  } catch (_) {
    return raw;
  }
}

export function formatHttpError(status, rawBody, sensitiveValues) {
  const hint = STATUS_HINTS[Number(status)] || "Model Studio request failed.";
  const detail = redactSensitiveText(serviceErrorDetail(rawBody), sensitiveValues);
  return `${hint} ${detail}`.trim();
}
