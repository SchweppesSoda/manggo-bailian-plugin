import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import imageTools from "../src/bob/ocr/image.cjs";
import languages from "../src/bob/ocr/languages.cjs";
import bobOcr from "../src/bob/ocr/plugin.cjs";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function loadBobOcrPlatform(option, http) {
  const context = vm.createContext({ $option: option, $http: http });
  const cache = new Map();
  function loadModule(filename) {
    const resolved = path.resolve(filename);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const module = { exports: {} };
    cache.set(resolved, module);
    const localRequire = (request) => loadModule(path.resolve(path.dirname(resolved), request));
    const source = readFileSync(resolved, "utf8");
    const wrapper = new vm.Script(`(function(require,module,exports){\n${source}\n})`, { filename: resolved });
    wrapper.runInContext(context)(localRequire, module, module.exports);
    return module.exports;
  }
  const entry = path.join(repoRoot, "platforms", "bob-ocr", "main.js");
  context.require = (request) => loadModule(path.resolve(path.dirname(entry), request));
  new vm.Script(readFileSync(entry, "utf8"), { filename: entry }).runInContext(context);
  return context;
}

function pngData() {
  const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return {
    length: bytes.length,
    readUInt8(index) { return bytes[index] ?? 0; },
    toBase64() { return Buffer.from(bytes).toString("base64"); },
  };
}

function createHarness({ option = {}, response, requestError, deferResponse = false } = {}) {
  let request;
  const completions = [];
  const core = {
    createOcrCall(imageUrl, language, config) {
      assert.match(imageUrl, /^data:image\/png;base64,/);
      return {
        url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        body: { model: config.model, imageUrl, language },
      };
    },
    completionText(data) {
      return data.choices[0].message.content;
    },
    validateConfig() {},
  };
  const http = {
    request(value) {
      if (requestError) throw requestError;
      request = value;
      if (!deferResponse) {
        value.handler(response ?? {
          response: { statusCode: 200 },
          data: { choices: [{ message: { content: "第一行\n第二行" } }] },
        });
      }
    },
  };
  const plugin = bobOcr.createBobOcrPlugin({
    core,
    imageTools,
    languages,
    getOption: () => ({ apiKey: "not-a-real-key", ...option }),
    http,
  });
  return { plugin, completions, get request() { return request; } };
}

function createCancelSignal() {
  let callback;
  let disposeCount = 0;
  return {
    subscribe(value) {
      callback = value;
      return {
        dispose() {
          disposeCount += 1;
          callback = undefined;
        },
      };
    },
    send() {
      const current = callback;
      if (current) current();
    },
    get disposeCount() {
      return disposeCount;
    },
  };
}

test("Bob OCR sends a non-streaming JSON request and returns Bob text rows", () => {
  const harness = createHarness({ option: { modelPreset: "qwen3.5-ocr" } });
  harness.plugin.ocr({ image: pngData(), from: "auto", detectFrom: "zh-Hans" }, (value) => {
    harness.completions.push(value);
  });
  assert.equal(harness.request.method, "POST");
  assert.equal(harness.request.header["Content-Type"], "application/json");
  assert.equal(harness.request.header.Authorization, "Bearer not-a-real-key");
  assert.equal("streamHandler" in harness.request, false);
  assert.deepEqual(harness.completions, [{
    result: {
      from: "zh-Hans",
      texts: [{ text: "第一行" }, { text: "第二行" }],
    },
  }]);
});

test("Bob OCR classifies missing credentials and redacts HTTP errors", () => {
  const missing = createHarness({ option: { apiKey: "" } });
  missing.plugin.ocr({ image: pngData(), from: "en" }, (value) => missing.completions.push(value));
  assert.equal(missing.completions[0].error.type, "secretKey");

  const failed = createHarness({
    response: {
      response: { statusCode: 401 },
      data: { error: { message: "bad not-a-real-key" } },
    },
  });
  failed.plugin.ocr({ image: pngData(), from: "en" }, (value) => failed.completions.push(value));
  assert.equal(failed.completions[0].error.type, "network");
  assert.doesNotMatch(failed.completions[0].error.message, /not-a-real-key/);
});

test("Bob OCR converts synchronous transport failures to one redacted completion", () => {
  const failed = createHarness({ requestError: new Error("socket failed for not-a-real-key") });
  failed.plugin.ocr({ image: pngData(), from: "en" }, (value) => failed.completions.push(value));
  assert.equal(failed.completions.length, 1);
  assert.equal(failed.completions[0].error.type, "network");
  assert.doesNotMatch(failed.completions[0].error.message, /not-a-real-key/);
});

test("Bob OCR cancellation suppresses a late HTTP completion", () => {
  const harness = createHarness({ deferResponse: true });
  const cancelSignal = createCancelSignal();
  harness.plugin.ocr({ image: pngData(), from: "en", cancelSignal }, (value) => {
    harness.completions.push(value);
  });
  assert.equal(harness.request.cancelSignal, cancelSignal);

  cancelSignal.send();
  harness.request.handler({
    response: { statusCode: 200 },
    data: { choices: [{ message: { content: "late" } }] },
  });

  assert.deepEqual(harness.completions, []);
  assert.equal(cancelSignal.disposeCount, 1);
});

test("Bob OCR metadata is an independent secure OCR plugin", async () => {
  const info = JSON.parse(await readFile(new URL("../platforms/bob-ocr/info.json", import.meta.url), "utf8"));
  assert.equal(info.identifier, "com.schweppessoda.bailian.ocr");
  assert.equal(info.category, "ocr");
  assert.equal(info.version, "2.2.0");
  assert.equal(info.minBobVersion, "1.8.0");
  assert.equal(info.homepage, "https://github.com/SchweppesSoda/bob-bailian-ocr");
  assert.equal(info.appcast, "https://raw.githubusercontent.com/SchweppesSoda/bob-bailian-ocr/main/appcast.json");
  const apiKey = info.options.find((item) => item.identifier === "apiKey");
  assert.equal(apiKey.textConfig.type, "secure");
  assert.equal(info.options.find((item) => item.identifier === "enableThinking").type, "menu");
  const accessMode = info.options.find((item) => item.identifier === "accessMode");
  assert.equal(accessMode.defaultValue, "pay_as_you_go");
  assert.deepEqual(accessMode.menuValues.map((item) => item.value), ["pay_as_you_go", "token_plan"]);
  assert.equal(info.options.find((item) => item.identifier === "ocrResolution").defaultValue, "auto");
});

test("built Bob OCR entry loads only package-local JavaScript modules", () => {
  const completions = [];
  const plugin = loadBobOcrPlatform({
    apiKey: "not-a-real-key",
    accessMode: "pay_as_you_go",
    region: "china",
    modelPreset: "qwen3.5-ocr",
    enableThinking: "false",
    reasoningEffort: "auto",
  }, {
    request(value) {
      value.handler({
        response: { statusCode: 200 },
        data: { choices: [{ message: { content: "one\ntwo" }, finish_reason: "stop" }] },
      });
    },
  });

  plugin.ocr({ image: pngData(), from: "en" }, (value) => completions.push(value));
  assert.equal(completions.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(completions[0].result)), {
    from: "en",
    texts: [{ text: "one" }, { text: "two" }],
  });
});
