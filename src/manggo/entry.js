import { ocrRequest, translationRequest } from "../core/index.js";
import { complete } from "./transport.js";

function configFrom(options) {
  return options && options.config ? options.config : {};
}

export async function translate(text, from, to, options) {
  const input = String(text === undefined || text === null ? "" : text);
  if (!input) return "";
  const detected = options && options.detect;
  return complete(translationRequest(input, from, to, configFrom(options), detected), options, false);
}

export async function recognize(base64, language, options) {
  return complete(ocrRequest(base64, language, configFrom(options)), options, true);
}
