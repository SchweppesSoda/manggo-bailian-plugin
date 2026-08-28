import assert from "node:assert/strict";
import test from "node:test";
import {
  applySseEvent,
  bobLanguageCode,
  createOcrCall,
  createSseState,
  createTranslationCall,
  formatHttpError,
  languageName,
  parseJsonCompletion,
  secureBaseUrl,
  validateConfig,
} from "../src/core/index.js";

const config = {
  accessMode: "pay_as_you_go",
  region: "china",
  model: "qwen3.7-plus",
  stream: true,
};

test("pure Core maps Bob language codes and returns transport-ready calls", () => {
  assert.equal(languageName("es"), "Spanish");
  assert.equal(languageName("auto", "zh-Hans"), "Simplified Chinese");
  assert.equal(bobLanguageCode("Traditional Chinese"), "zh-Hant");

  const translation = createTranslationCall("hola", "es", "en", config);
  assert.equal(translation.url, "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
  assert.match(translation.body.messages[1].content, /Source language: Spanish/);
  assert.match(translation.body.messages[1].content, /Target language: English/);

  const ocr = createOcrCall("data:image/jpeg;base64,YWJj", "fr", { ...config, stream: false });
  assert.equal(ocr.body.messages[1].content[0].image_url.url, "data:image/jpeg;base64,YWJj");
  assert.deepEqual(validateConfig(config), {
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen3.7-plus",
  });
});

test("pure Core rejects malformed custom endpoints without browser URL APIs", () => {
  assert.equal(secureBaseUrl("https://example.test/v1/"), "https://example.test/v1");
  assert.throws(() => secureBaseUrl("https://example.test:bad/v1"), /valid HTTPS URL/);
  assert.throws(() => secureBaseUrl("https://user:pass@example.test/v1"), /must not contain credentials/);
  assert.throws(() => secureBaseUrl("https://example.test/v1?key=value"), /query or fragment/);
});

test("Coding Plan uses an exact model catalog and official endpoint", () => {
  assert.deepEqual(validateConfig({ accessMode: "coding_plan", model: "qwen3.7-plus", region: "china" }, "translation"), {
    endpoint: "https://coding.dashscope.aliyuncs.com/v1/chat/completions",
    model: "qwen3.7-plus",
  });
  assert.throws(
    () => createTranslationCall("hello", "en", "zh-Hans", {
      accessMode: "coding_plan",
      region: "china",
      model: "qwen3.7-flash",
    }),
    /verified Coding Plan model list/,
  );
  assert.throws(
    () => validateConfig({
      accessMode: "coding_plan",
      region: "china",
      model: "qwen3.7-plus",
      customBaseUrl: "https://example.test/v1",
    }, "translation"),
    /official Base URL/,
  );
});

test("Token Plan validates its current official model list before transport", () => {
  assert.deepEqual(validateConfig({ accessMode: "token_plan", model: "qwen3.8-flash", region: "china" }, "translation"), {
    endpoint: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen3.8-flash",
  });
  assert.throws(
    () => validateConfig({ accessMode: "token_plan", model: "qwen-mt-plus", region: "china" }, "translation"),
    /verified Token Plan model list/,
  );
  assert.throws(
    () => validateConfig({ accessMode: "token_plan", model: "qwen3.7-max", region: "china" }, "ocr"),
    /does not support image input/,
  );
});

test("OCR rejects text-only Coding Plan models and applies supported resolution presets", () => {
  assert.throws(
    () => createOcrCall("data:image/png;base64,YWJj", "en", {
      accessMode: "coding_plan",
      region: "china",
      model: "glm-5",
    }),
    /does not support image input/,
  );
  const fast = createOcrCall("data:image/png;base64,YWJj", "en", {
    accessMode: "coding_plan",
    region: "china",
    model: "qwen3.7-plus",
    ocrResolution: "fast",
  });
  assert.equal(fast.body.messages[1].content[0].max_pixels, 1048576);
  const automatic = createOcrCall("data:image/png;base64,YWJj", "en", {
    accessMode: "coding_plan",
    region: "china",
    model: "qwen3.7-plus",
    ocrResolution: "auto",
  });
  assert.equal("max_pixels" in automatic.body.messages[1].content[0], false);
});

test("pure Core parses JSON and SSE content while leaving callback effects to adapters", () => {
  assert.equal(parseJsonCompletion({
    choices: [{ message: { content: [{ text: "Hello" }, " world"] }, finish_reason: "stop" }],
  }), "Hello world");

  const before = createSseState();
  const applied = applySseEvent('data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}', before);
  assert.deepEqual(before, { result: "", truncated: false });
  assert.deepEqual(applied, {
    addition: "Hello",
    done: false,
    state: { result: "Hello", truncated: false },
  });
});

test("pure Core redacts secrets in structured HTTP errors", () => {
  const detail = formatHttpError(401, JSON.stringify({ error: { message: "invalid secret-value" } }), "secret-value");
  assert.match(detail, /billing mode, region, and Base URL/);
  assert.doesNotMatch(detail, /secret-value/);
  assert.match(detail, /\[REDACTED\]/);
});
