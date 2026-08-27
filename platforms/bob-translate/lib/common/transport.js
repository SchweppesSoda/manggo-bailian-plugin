/* $http transport and Bob service-error mapping. */

var options = require("./options.js");

function responseStatus(response) {
  if (!response) return 0;
  if (response.response && response.response.statusCode !== undefined) return Number(response.response.statusCode) || 0;
  if (response.statusCode !== undefined) return Number(response.statusCode) || 0;
  return 0;
}

function rawResponseData(response) {
  if (!response || response.data === undefined || response.data === null) return "";
  if (typeof response.data === "string") return response.data;
  try {
    return JSON.stringify(response.data);
  } catch (_) {
    return String(response.data);
  }
}

function serviceDetail(raw) {
  if (!raw) return "";
  try {
    var decoded = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (decoded && decoded.error && decoded.error.message) return String(decoded.error.message);
    if (decoded && decoded.message) return String(decoded.message);
  } catch (_) {
    // A text response is still helpful after redaction.
  }
  return String(raw);
}

function httpMessage(status, raw, apiKey) {
  var hints = {
    400: "Check the model and request settings.",
    401: "Check that the API Key, billing mode, region, and Base URL belong together.",
    403: "The selected model or client scenario may not be permitted.",
    429: "Usage or rate limit reached; retry later."
  };
  var detail = options.redactSensitiveText(serviceDetail(raw), apiKey);
  return (hints[status] || "Model Studio request failed.") + (detail ? " " + detail : "");
}

function errorMessage(error, apiKey) {
  if (!error) return "Network request failed.";
  var message = error.message || error.localizedDescription || error.localizedFailureReason || String(error);
  return options.redactSensitiveText(message, apiKey);
}

function httpFailure(status, raw, apiKey) {
  return {
    type: "network",
    message: httpMessage(status, raw, apiKey)
  };
}

function networkFailure(error, apiKey) {
  return {
    type: "network",
    message: errorMessage(error, apiKey)
  };
}

function apiFailure(error, apiKey) {
  return {
    type: "api",
    message: errorMessage(error, apiKey)
  };
}

function requestArguments(endpoint, body, config, cancelSignal, isStream, handler, streamHandler) {
  var request = {
    method: "POST",
    url: endpoint,
    header: {
      "Authorization": "Bearer " + config.apiKey,
      "Content-Type": "application/json",
      "Accept": isStream ? "text/event-stream" : "application/json"
    },
    body: body,
    cancelSignal: cancelSignal,
    handler: handler
  };
  if (isStream) request.streamHandler = streamHandler;
  return request;
}

function postJson(http, endpoint, body, config, cancelSignal, handler) {
  if (!http || typeof http.request !== "function") {
    throw new Error("Bob network utility $http.request is unavailable.");
  }
  var request = requestArguments(endpoint, body, config, cancelSignal, false, handler);
  try {
    http.request(request);
  } catch (error) {
    handler({ error: error });
  }
}

function streamJson(http, endpoint, body, config, cancelSignal, streamHandler, handler) {
  if (!http || typeof http.streamRequest !== "function") {
    throw new Error("Bob 1.8.0 or later is required for streamed translation requests.");
  }
  var request = requestArguments(endpoint, body, config, cancelSignal, true, handler, streamHandler);
  try {
    http.streamRequest(request);
  } catch (error) {
    handler({ error: error });
  }
}

module.exports = {
  apiFailure: apiFailure,
  httpFailure: httpFailure,
  networkFailure: networkFailure,
  postJson: postJson,
  rawResponseData: rawResponseData,
  responseStatus: responseStatus,
  streamJson: streamJson
};
