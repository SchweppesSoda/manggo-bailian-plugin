import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const platformRoot = path.join(repoRoot, "platforms", "bob-translate");

function defaultOptions(overrides = {}) {
  return {
    apiKey: "bob-private-key-123",
    accessMode: "pay_as_you_go",
    region: "china",
    workspaceId: "",
    customBaseUrl: "",
    modelPreset: "qwen3.7-plus",
    customModel: "",
    enableThinking: "off",
    reasoningEffort: "auto",
    maxTokens: "4096",
    ...overrides,
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createCommonJsLoader(globals = {}) {
  const sandbox = { ...globals };
  const context = vm.createContext(sandbox);
  const moduleCache = new Map();

  function loadModule(filename) {
    const resolved = path.resolve(filename);
    if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;

    const module = { exports: {} };
    moduleCache.set(resolved, module);
    const source = readFileSync(resolved, "utf8");
    const localRequire = (request) => {
      if (!request.startsWith(".")) throw new Error(`Only local Bob modules are supported in this test: ${request}`);
      let requested = path.resolve(path.dirname(resolved), request);
      if (!path.extname(requested)) requested += ".js";
      return loadModule(requested);
    };
    const wrapped = `(function (require, module, exports, __filename, __dirname) {\n${source}\n})`;
    const factory = new vm.Script(wrapped, { filename: resolved }).runInContext(context);
    factory(localRequire, module, module.exports, resolved, path.dirname(resolved));
    return module.exports;
  }

  function runEntry(filename) {
    const resolved = path.resolve(filename);
    const localRequire = (request) => {
      if (!request.startsWith(".")) throw new Error(`Only local Bob modules are supported in this test: ${request}`);
      let requested = path.resolve(path.dirname(resolved), request);
      if (!path.extname(requested)) requested += ".js";
      return loadModule(requested);
    };
    context.require = localRequire;
    new vm.Script(readFileSync(resolved, "utf8"), { filename: resolved }).runInContext(context);
  }

  return { context, loadModule, runEntry };
}

function loadPlatform(option, http) {
  const loader = createCommonJsLoader({ $option: option, $http: http });
  loader.runEntry(path.join(platformRoot, "main.js"));
  return loader.context;
}

test("Bob translate manifest uses a secure key, explicit plans, model override, and menu thinking", async () => {
  const manifest = JSON.parse(await readFile(path.join(platformRoot, "info.json"), "utf8"));
  const configs = Object.fromEntries(manifest.options.map((item) => [item.identifier, item]));

  assert.equal(manifest.category, "translate");
  assert.equal(manifest.minBobVersion, "1.8.0");
  assert.equal("appcast" in manifest, false, "Beta package must not point to an unpublished appcast");
  assert.match(manifest.identifier, /^[a-z0-9.]+$/);
  assert.equal(configs.apiKey.textConfig.type, "secure");
  assert.deepEqual(configs.accessMode.menuValues.map((item) => item.value), [
    "pay_as_you_go",
    "coding_plan",
    "token_plan",
  ]);
  assert.equal(configs.modelPreset.defaultValue, "qwen3.7-plus");
  assert.equal(configs.customModel.type, "text");
  assert.equal(configs.enableThinking.type, "menu");
  assert.deepEqual(configs.enableThinking.menuValues.map((item) => item.value), ["off", "on"]);
});

test("platform sources are package-local copies of the canonical Bob adapter", async () => {
  const pairs = [
    ["src/bob/common/options.js", "platforms/bob-translate/lib/common/options.js"],
    ["src/bob/common/languages.js", "platforms/bob-translate/lib/common/languages.js"],
    ["src/bob/common/sse.js", "platforms/bob-translate/lib/common/sse.js"],
    ["src/bob/common/transport.js", "platforms/bob-translate/lib/common/transport.js"],
    ["src/bob/translate/main.js", "platforms/bob-translate/lib/translate/main.js"],
  ];
  for (const [sourcePath, packagePath] of pairs) {
    const [source, packaged] = await Promise.all([
      readFile(path.join(repoRoot, sourcePath), "utf8"),
      readFile(path.join(repoRoot, packagePath), "utf8"),
    ]);
    assert.equal(packaged, source, packagePath);
  }
});

test("streaming crosses chunk boundaries, uses Bob detection, and completes once", () => {
  let request;
  const streamResults = [];
  const completionResults = [];
  const cancelSignal = { cancelled: false };
  const http = {
    streamRequest(value) {
      request = value;
      value.streamHandler({ text: 'data: {"choices":[{"delta":{"reasoning_content":"hidden"},"finish_reason":null}]}\r\n\r\n' });
      value.streamHandler({ text: 'data: {"choices":[{"delta":{"content":"Hel' });
      value.streamHandler({ text: 'lo"},"finish_reason":null}]}\r\n\r\n' });
      value.streamHandler({ text: 'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]\r\n\r\n' });
      value.handler({ response: { statusCode: 200 } });
      value.handler({ response: { statusCode: 200 } });
    },
  };
  const plugin = loadPlatform(defaultOptions(), http);

  plugin.translate({
    text: "你好",
    from: "auto",
    to: "auto",
    detectFrom: "zh-Hans",
    detectTo: "en",
    cancelSignal,
    onStream: (result) => streamResults.push(result),
    onCompletion: (result) => completionResults.push(result),
  });

  assert.equal(typeof plugin.supportLanguages, "function");
  assert.ok(plugin.supportLanguages().includes("zh-Hans"));
  assert.ok(plugin.supportLanguages().includes("en"));
  assert.equal(request.method, "POST");
  assert.equal(request.header.Authorization, "Bearer bob-private-key-123");
  assert.equal(request.header["Content-Type"], "application/json");
  assert.equal(request.cancelSignal, cancelSignal);
  assert.equal(request.body.stream, true);
  assert.match(request.body.messages[1].content, /Source language: Simplified Chinese/);
  assert.match(request.body.messages[1].content, /Target language: English/);
  assert.deepEqual(plain(streamResults.map((result) => result.toParagraphs)), [["Hello"], ["Hello world"]]);
  assert.equal(completionResults.length, 1);
  assert.deepEqual(plain(completionResults[0].result.toParagraphs), ["Hello world"]);
  assert.equal(completionResults[0].result.from, "zh-Hans");
  assert.equal(completionResults[0].result.to, "en");
  assert.equal("thinkInfo" in completionResults[0].result, false);
});

test("Qwen MT Plus is non-streaming and sends English language names, not Bob codes", () => {
  let request;
  let streamCalled = false;
  const completionResults = [];
  const http = {
    request(value) {
      request = value;
      value.handler({
        response: { statusCode: 200 },
        data: { choices: [{ message: { content: "Hello" }, finish_reason: "stop" }] },
      });
    },
    streamRequest() {
      streamCalled = true;
    },
  };
  const plugin = loadPlatform(defaultOptions({ modelPreset: "qwen-mt-plus" }), http);

  plugin.translate({
    text: "Hola",
    from: "es",
    to: "en",
    detectFrom: "es",
    detectTo: "en",
    onCompletion: (result) => completionResults.push(result),
  });

  assert.equal(streamCalled, false);
  assert.equal(request.body.stream, false);
  assert.deepEqual(plain(request.body.translation_options), {
    source_lang: "Spanish",
    target_lang: "English",
  });
  assert.equal(request.header["Content-Type"], "application/json");
  assert.equal(completionResults.length, 1);
  assert.deepEqual(plain(completionResults[0].result.toParagraphs), ["Hello"]);
});

test("core injection receives model-facing names for Qwen MT requests", () => {
  const loader = createCommonJsLoader();
  const entry = loader.loadModule(path.join(repoRoot, "src", "bob", "translate", "main.js"));
  let coreArguments;
  const completionResults = [];
  const core = {
    translationRequest(...args) {
      coreArguments = args;
      return { model: "qwen-mt-plus", stream: false, messages: [] };
    },
    chatEndpoint() {
      return "https://example.test/v1/chat/completions";
    },
  };
  const http = {
    request(value) {
      value.handler({
        response: { statusCode: 200 },
        data: { choices: [{ message: { content: "Hello" }, finish_reason: "stop" }] },
      });
    },
  };

  entry.translate({
    text: "Hola",
    from: "es",
    to: "en",
    detectFrom: "es",
    detectTo: "en",
    onCompletion: (result) => completionResults.push(result),
  }, null, { option: defaultOptions({ modelPreset: "qwen-mt-plus" }), http, core });

  assert.deepEqual(coreArguments.slice(0, 3), ["Hola", "Spanish", "English"]);
  assert.equal(completionResults.length, 1);
});

test("HTTP errors are mapped as network errors and redact the API Key", () => {
  const completionResults = [];
  const http = {
    streamRequest(value) {
      value.streamHandler({ text: 'data: {"error":{"message":"invalid bob-private-key-123"}}\n\n' });
      value.handler({ response: { statusCode: 401 } });
      value.handler({ response: { statusCode: 401 } });
    },
  };
  const plugin = loadPlatform(defaultOptions(), http);

  plugin.translate({
    text: "test",
    from: "en",
    to: "zh-Hans",
    detectFrom: "en",
    detectTo: "zh-Hans",
    onCompletion: (result) => completionResults.push(result),
  });

  assert.equal(completionResults.length, 1);
  assert.equal(completionResults[0].error.type, "network");
  assert.match(completionResults[0].error.message, /\[REDACTED\]/);
  assert.doesNotMatch(completionResults[0].error.message, /bob-private-key-123/);
});

test("missing API Key returns Bob's secretKey error without sending a request", () => {
  let requested = false;
  const completionResults = [];
  const http = {
    streamRequest() {
      requested = true;
    },
  };
  const plugin = loadPlatform(defaultOptions({ apiKey: "" }), http);

  plugin.translate({
    text: "test",
    from: "en",
    to: "zh-Hans",
    detectFrom: "en",
    detectTo: "zh-Hans",
    onCompletion: (result) => completionResults.push(result),
  });

  assert.equal(requested, false);
  assert.deepEqual(plain(completionResults), [{ error: {
    type: "secretKey",
    message: "Set an Alibaba Cloud Model Studio API Key in this plugin's settings.",
  } }]);
});

test("plugin validation uses the injected Core without spending a request", () => {
  let requested = false;
  const results = [];
  const plugin = loadPlatform(defaultOptions({ customBaseUrl: "https://example.test:bad/v1" }), {
    request() { requested = true; },
    streamRequest() { requested = true; },
  });

  plugin.pluginValidate((value) => results.push(value));

  assert.equal(requested, false);
  assert.equal(results.length, 1);
  assert.equal(results[0].result, false);
  assert.equal(results[0].error.type, "param");
  assert.match(results[0].error.message, /valid HTTPS URL/);
});
