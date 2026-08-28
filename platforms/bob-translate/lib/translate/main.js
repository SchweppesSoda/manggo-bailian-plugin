/*
 * Canonical Bob Translate entry module.
 *
 * The module only depends on Bob's $option/$http through the runtime object.
 * A build can inject the pure ESM src/core/index.js exports through setCore()
 * after converting them to a Bob-compatible CommonJS module; the fallback
 * builder keeps the source package runnable before that build integration.
 */

var options = require("../common/options.js");
var languages = require("../common/languages.js");
var sse = require("../common/sse.js");
var transport = require("../common/transport.js");

var injectedCore = null;

var TRANSLATION_INSTRUCTION = [
  "You are a professional translation engine.",
  "Translate faithfully and naturally, preserving paragraphs, line breaks, lists, punctuation, names, numbers, and technical terms.",
  "Return only the translated text without explanations, labels, quotes, Markdown fences, analysis, or reasoning."
].join(" ");

function setCore(core) {
  injectedCore = core || null;
}

function runtimeCore(runtime) {
  if (runtime && runtime.core) return runtime.core;
  if (injectedCore) return injectedCore;
  if (typeof globalThis !== "undefined" && globalThis.__MANGGO_BAILIAN_CORE__) {
    return globalThis.__MANGGO_BAILIAN_CORE__;
  }
  return null;
}

function copyFields(target, source) {
  var keys = Object.keys(source || {});
  for (var index = 0; index < keys.length; index += 1) target[keys[index]] = source[keys[index]];
  return target;
}

function fallbackTranslationRequest(text, resolvedLanguages, config) {
  var request = {
    model: config.model,
    messages: [],
    temperature: 0.1,
    max_tokens: config.maxTokens,
    stream: true
  };
  copyFields(request, options.thinkingFields(config));

  if (config.model.toLowerCase().indexOf("qwen-mt-") === 0) {
    request.messages = [{ role: "user", content: String(text) }];
    request.translation_options = {
      source_lang: resolvedLanguages.qwenMtFrom,
      target_lang: resolvedLanguages.qwenMtTo
    };
    if (config.model.toLowerCase() === "qwen-mt-plus" || config.model.toLowerCase() === "qwen-mt-turbo") {
      request.stream = false;
    }
    return request;
  }

  request.messages = [
    { role: "system", content: TRANSLATION_INSTRUCTION },
    {
      role: "user",
      content: [
        "Source language: " + resolvedLanguages.sourceName,
        "Target language: " + resolvedLanguages.targetName,
        "Translate the text below. Return only the translation.",
        "",
        String(text)
      ].join("\n")
    }
  ];
  return request;
}

function buildRequest(core, text, resolvedLanguages, config) {
  if (core && typeof core.translationRequest === "function") {
    // Core is model-facing: pass full language names, while Bob result fields
    // remain the original Bob codes. Qwen MT rejects generic codes such as es.
    var source = resolvedLanguages.from === "auto" ? "auto" : resolvedLanguages.sourceName;
    return core.translationRequest(text, source, resolvedLanguages.targetName, config, source);
  }
  return fallbackTranslationRequest(text, resolvedLanguages, config);
}

function endpointFor(core, config) {
  if (core && typeof core.chatEndpoint === "function") return core.chatEndpoint(config);
  return options.chatEndpoint(config);
}

function resultPayload(text, resolvedLanguages) {
  return {
    // Keep one element so Bob preserves the model's original paragraph layout.
    toParagraphs: [String(text)],
    from: resolvedLanguages.from,
    to: resolvedLanguages.to
  };
}

function createCancellation(query) {
  var cancelled = false;
  var subscription = null;
  var callbacks = [];

  function dispose() {
    if (!subscription) return;
    var current = subscription;
    subscription = null;
    if (typeof current.dispose === "function") current.dispose();
  }

  function cancel() {
    if (cancelled) return;
    cancelled = true;
    var pending = callbacks;
    callbacks = [];
    for (var index = 0; index < pending.length; index += 1) pending[index]();
    dispose();
  }

  var signal = query && query.cancelSignal;
  if (signal && typeof signal.subscribe === "function") {
    try {
      subscription = signal.subscribe(cancel);
      // Also dispose when a test double or future host invokes synchronously.
      if (cancelled) dispose();
    } catch (_) {
      subscription = null;
    }
  }

  return {
    dispose: dispose,
    isCancelled: function () { return cancelled; },
    onCancel: function (callback) {
      if (cancelled) callback();
      else callbacks.push(callback);
    }
  };
}

function completeOnce(query, legacyCompletion, cancellation) {
  var completed = false;
  var invoke = function (payload) {
    if (completed || (cancellation && cancellation.isCancelled())) return;
    completed = true;
    if (cancellation) cancellation.dispose();
    if (query && typeof query.onCompletion === "function") query.onCompletion(payload);
    else if (typeof legacyCompletion === "function") legacyCompletion(payload);
  };
  invoke.isCompleted = function () {
    return completed || Boolean(cancellation && cancellation.isCancelled());
  };
  return invoke;
}

function completeError(complete, error) {
  complete({ error: error });
}

function configurationError(error, apiKey) {
  var message = options.redactSensitiveText(error && error.message, apiKey);
  return { type: "param", message: message };
}

function missingApiKeyError() {
  return {
    type: "secretKey",
    message: "Set an Alibaba Cloud Model Studio API Key in this plugin's settings."
  };
}

function parseJsonCompletion(payload, core) {
  if (core && typeof core.parseJsonCompletion === "function") return core.parseJsonCompletion(payload, false);
  var body;
  try {
    body = typeof payload === "string" ? JSON.parse(payload) : payload;
  } catch (_) {
    throw new Error("Model Studio returned an invalid JSON response.");
  }
  var choice = body && body.choices && body.choices[0];
  if (!choice) throw new Error("Model Studio response did not include a completion choice.");
  if (choice.finish_reason === "length") {
    throw new Error("Model Studio output was truncated; increase Max tokens or reduce the input.");
  }
  var result = sse.contentText(choice.message && choice.message.content);
  if (!String(result).trim()) throw new Error("Model Studio response did not include result text.");
  return result;
}

function translateNonstream(query, complete, runtime, core, endpoint, request, config, resolvedLanguages) {
  try {
    transport.postJson(runtime.http, endpoint, request, config, query && query.cancelSignal, function (response) {
      if (complete.isCompleted()) return;
      if (response && response.error) {
        completeError(complete, transport.networkFailure(response.error, config.apiKey));
        return;
      }
      var status = transport.responseStatus(response);
      var raw = transport.rawResponseData(response);
      if (status >= 300) {
        completeError(complete, transport.httpFailure(status, raw, config.apiKey));
        return;
      }
      try {
        complete({ result: resultPayload(parseJsonCompletion(response && response.data, core), resolvedLanguages) });
      } catch (error) {
        completeError(complete, transport.apiFailure(error, config.apiKey));
      }
    });
  } catch (error) {
    completeError(complete, transport.networkFailure(error, config.apiKey));
  }
}

function translateStream(query, complete, cancellation, runtime, core, endpoint, request, config, resolvedLanguages) {
  var ERROR_PREVIEW_LIMIT = 16384;
  var errorPreview = "";
  var streamParseError = null;
  var makeBatcher = core && typeof core.createStreamBatcher === "function"
    ? core.createStreamBatcher
    : sse.createStreamBatcher;
  var batcher = makeBatcher(function (allText) {
    if (query && typeof query.onStream === "function") {
      // Bob expects every streamed result to be the cumulative translation.
      query.onStream(resultPayload(allText, resolvedLanguages));
    }
  }, { mode: "snapshot" });
  var accumulator = sse.createSseAccumulator(function (addition) {
    batcher.push(addition);
  });
  cancellation.onCancel(function () {
    batcher.cancel();
  });

  function appendErrorPreview(chunk) {
    if (!chunk || errorPreview.length >= ERROR_PREVIEW_LIMIT) return;
    errorPreview += chunk.slice(0, ERROR_PREVIEW_LIMIT - errorPreview.length);
  }

  try {
    transport.streamJson(
    runtime.http,
    endpoint,
    request,
    config,
    query && query.cancelSignal,
    function (stream) {
      if (complete.isCompleted()) return;
      try {
        var chunk = stream && stream.text ? String(stream.text) : "";
        appendErrorPreview(chunk);
        accumulator.push(chunk);
      } catch (error) {
        // Wait for handler: a non-2xx response can contain non-SSE JSON text.
        streamParseError = error;
      }
    },
    function (response) {
      if (complete.isCompleted()) return;
      if (response && response.error) {
        batcher.cancel();
        completeError(complete, transport.networkFailure(response.error, config.apiKey));
        return;
      }
      var status = transport.responseStatus(response);
      if (status >= 300) {
        batcher.cancel();
        completeError(complete, transport.httpFailure(status, errorPreview || transport.rawResponseData(response), config.apiKey));
        return;
      }
      try {
        if (streamParseError) throw streamParseError;
        var state = accumulator.finish();
        var result = batcher.finish();
        if (state.truncated) {
          throw new Error("Model Studio output was truncated; increase Max tokens or reduce the input.");
        }
        if (!result.trim()) throw new Error("Model Studio stream did not include result text.");
        complete({ result: resultPayload(result, resolvedLanguages) });
      } catch (error) {
        batcher.cancel();
        completeError(complete, transport.apiFailure(error, config.apiKey));
      }
    }
    );
  } catch (error) {
    completeError(complete, transport.networkFailure(error, config.apiKey));
  }
}

function translate(query, legacyCompletion, suppliedRuntime) {
  var runtime = suppliedRuntime || {
    option: typeof $option === "undefined" ? {} : $option,
    http: typeof $http === "undefined" ? null : $http
  };
  var cancellation = createCancellation(query);
  var complete = completeOnce(query, legacyCompletion, cancellation);
  var config;
  var resolvedLanguages;
  var core = runtimeCore(runtime);
  var request;
  var endpoint;
  try {
    config = options.normalizeConfig(runtime.option || {});
    if (!config.apiKey) {
      completeError(complete, missingApiKeyError());
      return;
    }
    resolvedLanguages = languages.resolveTranslationLanguages(query || {});
    var text = query && query.text !== undefined && query.text !== null ? String(query.text) : "";
    if (!text) {
      complete({ result: resultPayload("", resolvedLanguages) });
      return;
    }
    request = buildRequest(core, text, resolvedLanguages, config);
    endpoint = endpointFor(core, config);
  } catch (error) {
    completeError(complete, configurationError(error, config && config.apiKey));
    return;
  }
  if (request.stream === false) {
    translateNonstream(query, complete, runtime, core, endpoint, request, config, resolvedLanguages);
  } else {
    translateStream(query, complete, cancellation, runtime, core, endpoint, request, config, resolvedLanguages);
  }
}

function pluginValidate(completion, suppliedRuntime) {
  var runtime = suppliedRuntime || {
    option: typeof $option === "undefined" ? {} : $option
  };
  try {
    var config = options.normalizeConfig(runtime.option || {});
    if (!config.apiKey) {
      completion({ result: false, error: missingApiKeyError() });
      return;
    }
    // Validate billing/endpoint and thinking compatibility without consuming API quota.
    var core = runtimeCore(runtime);
    if (core && typeof core.validateConfig === "function") core.validateConfig(config, "translation");
    else {
      options.chatEndpoint(config);
      options.thinkingFields(config);
    }
    completion({ result: true });
  } catch (error) {
    completion({ result: false, error: configurationError(error) });
  }
}

function pluginTimeoutInterval() {
  return 120;
}

module.exports = {
  pluginTimeoutInterval: pluginTimeoutInterval,
  pluginValidate: pluginValidate,
  setCore: setCore,
  supportLanguages: languages.supportLanguages,
  translate: translate
};
