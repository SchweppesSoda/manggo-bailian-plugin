"use strict";

function stringValue(value, fallback) {
  if (value === undefined || value === null) return fallback || "";
  var result = String(value).trim();
  return result || fallback || "";
}

function optionConfig(option) {
  option = option || {};
  return {
    accessMode: stringValue(option.accessMode, "pay_as_you_go"),
    region: stringValue(option.region, "china"),
    workspaceId: stringValue(option.workspaceId),
    customBaseUrl: stringValue(option.customBaseUrl),
    apiKey: stringValue(option.apiKey),
    model: stringValue(option.customModel) || stringValue(option.modelPreset, "qwen3.7-plus"),
    maxTokens: stringValue(option.maxTokens, "8192"),
    enableThinking: stringValue(option.enableThinking, "false") === "true",
    reasoningEffort: stringValue(option.reasoningEffort, "auto"),
    systemPrompt: stringValue(option.systemPrompt),
    stream: false,
  };
}

function once(callback) {
  var called = false;
  return function (value) {
    if (called) return;
    called = true;
    callback(value);
  };
}

function safeMessage(value, apiKey) {
  var message = value && value.message ? value.message : value;
  message = stringValue(message, "Unknown OCR error");
  if (apiKey) message = message.split(apiKey).join("[REDACTED]");
  return message.length > 800 ? message.slice(0, 800) + "…" : message;
}

function responseMessage(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  if (typeof data.message === "string") return data.message;
  if (data.error && typeof data.error.message === "string") return data.error.message;
  return fallback;
}

function createOcrCall(core, imageUrl, language, config) {
  if (typeof core.createOcrCall === "function") return core.createOcrCall(imageUrl, language, config);
  if (typeof core.chatEndpoint !== "function" || typeof core.ocrRequest !== "function") {
    throw new Error("Bob OCR core dependency is incomplete.");
  }
  return {
    url: core.chatEndpoint(config),
    body: core.ocrRequest(imageUrl, language, config),
  };
}

function completionText(core, data) {
  if (typeof core.completionText === "function") return core.completionText(data, true);
  if (typeof core.parseJsonCompletion === "function") return core.parseJsonCompletion(data, true);
  throw new Error("Bob OCR completion parser is unavailable.");
}

function createBobOcrPlugin(dependencies) {
  var core = dependencies.core;
  var imageTools = dependencies.imageTools;
  var languages = dependencies.languages;
  var getOption = dependencies.getOption;
  var http = dependencies.http;

  if (!core) {
    throw new Error("Bob OCR core dependency is incomplete.");
  }

  function supportLanguages() {
    return languages.SUPPORTED_LANGUAGES.slice();
  }

  function pluginTimeoutInterval() {
    return 120;
  }

  function pluginValidate(completion) {
    var config = optionConfig(getOption());
    if (!config.apiKey) {
      completion({
        result: false,
        error: { type: "secretKey", message: "Enter the API Key for the selected Bailian billing mode." },
      });
      return;
    }
    try {
      if (typeof core.validateConfig === "function") core.validateConfig(config);
      completion({ result: true });
    } catch (error) {
      completion({ result: false, error: { type: "param", message: safeMessage(error, config.apiKey) } });
    }
  }

  function ocr(query, completion) {
    var finish = once(completion);
    var config = optionConfig(getOption());
    var language;
    var call;

    try {
      if (!config.apiKey) {
        finish({ error: { type: "secretKey", message: "Enter the API Key for the selected Bailian billing mode." } });
        return;
      }
      if (!query || !query.image) throw new Error("Bob did not provide an image for OCR.");
      language = languages.resolvedLanguage(query);
      call = createOcrCall(core, imageTools.imageDataUrl(query.image), language.name, config);
    } catch (error) {
      finish({
        error: {
          type: error && error.bobType ? error.bobType : "param",
          message: safeMessage(error, config.apiKey),
        },
      });
      return;
    }

    try {
      http.request({
        method: "POST",
        url: call.url,
        header: {
          Authorization: "Bearer " + config.apiKey,
          "Content-Type": "application/json",
        },
        body: call.body,
        timeout: 120,
        handler: function (response) {
        if (response && response.error) {
          finish({ error: { type: "network", message: safeMessage(response.error, config.apiKey) } });
          return;
        }
        var statusCode = response && response.response && response.response.statusCode;
        if (typeof statusCode === "number" && (statusCode < 200 || statusCode >= 300)) {
          finish({
            error: {
              type: "network",
              message: safeMessage(responseMessage(response.data, "Bailian OCR returned HTTP " + statusCode + "."), config.apiKey),
            },
          });
          return;
        }
        try {
          var text = completionText(core, response && response.data);
          finish({ result: { from: language.code, texts: imageTools.textRows(text) } });
        } catch (error) {
          finish({ error: { type: "api", message: safeMessage(error, config.apiKey) } });
        }
        },
      });
    } catch (error) {
      finish({ error: { type: "network", message: safeMessage(error, config.apiKey) } });
    }
  }

  return {
    supportLanguages: supportLanguages,
    pluginTimeoutInterval: pluginTimeoutInterval,
    pluginValidate: pluginValidate,
    ocr: ocr,
  };
}

module.exports = {
  createBobOcrPlugin: createBobOcrPlugin,
  optionConfig: optionConfig,
};
