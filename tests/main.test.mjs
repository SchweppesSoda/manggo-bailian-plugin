import test from "node:test";
import assert from "node:assert/strict";
import { recognize, translate } from "../main.js";

function jsonResponse(content, options = {}) {
  return new Response(JSON.stringify({
    choices: [{
      message: { content },
      finish_reason: options.finishReason || "stop",
    }],
  }), {
    status: options.status || 200,
    headers: { "Content-Type": "application/json" },
  });
}

function optionsWith(fetchImpl, config = {}, chunks = []) {
  return {
    config: {
      apiKey: "not-a-real-key",
      accessMode: "pay_as_you_go",
      region: "china",
      model: "qwen3.7-plus",
      stream: false,
      ...config,
    },
    utils: { fetch: fetchImpl },
    setResult: (chunk) => chunks.push(chunk),
  };
}

test("explicit pay-as-you-go uses its route and qwen3.7-plus thinking defaults off", async () => {
  let request;
  const options = optionsWith(async (url, init) => {
    request = { url, init, body: JSON.parse(init.body) };
    return jsonResponse("Hello\nworld");
  });
  const result = await translate("你好\n世界", "Simplified Chinese", "English", options);
  assert.equal(result, "Hello\nworld");
  assert.equal(request.url, "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
  assert.equal(request.body.model, "qwen3.7-plus");
  assert.equal(request.body.enable_thinking, false);
  assert.equal("thinking_budget" in request.body, false);
  assert.match(request.body.messages[1].content, /Source language: Simplified Chinese/);
  assert.equal(request.init.headers.Authorization, "Bearer not-a-real-key");
});

test("pay-as-you-go supports Singapore and workspace-specific routes", async () => {
  const urls = [];
  const fetcher = async (url) => {
    urls.push(url);
    return jsonResponse("ok");
  };
  await translate("a", "English", "Chinese", optionsWith(fetcher, { region: "singapore" }));
  await translate("b", "English", "Chinese", optionsWith(fetcher, { workspaceId: "ws-123" }));
  await translate("c", "English", "Chinese", optionsWith(fetcher, { region: "singapore", workspaceId: "ws-456" }));
  assert.deepEqual(urls, [
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    "https://ws-123.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
    "https://ws-456.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
  ]);
});

test("Coding Plan and Token Plan use isolated official routes", async () => {
  const urls = [];
  const fetcher = async (url) => {
    urls.push(url);
    return jsonResponse("ok");
  };
  await translate("a", "English", "Chinese", optionsWith(fetcher, { accessMode: "coding_plan" }));
  await translate("b", "English", "Chinese", optionsWith(fetcher, { accessMode: "token_plan" }));
  assert.deepEqual(urls, [
    "https://coding.dashscope.aliyuncs.com/v1/chat/completions",
    "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
  ]);
});

test("plan routes reject Singapore and custom endpoint overrides", async () => {
  let called = false;
  const fetcher = async () => {
    called = true;
    return jsonResponse("unused");
  };
  await assert.rejects(
    translate("a", "English", "Chinese", optionsWith(fetcher, {
      accessMode: "token_plan",
      region: "singapore",
    })),
    /require the China/,
  );
  assert.equal(called, false);

  await assert.rejects(
    translate("a", "English", "Chinese", optionsWith(fetcher, {
      accessMode: "token_plan",
      region: "china",
      customBaseUrl: "https://future.example/v1",
    })),
    /official Base URLs/,
  );
});

test("custom Base URL must be HTTPS and must not contain credentials", async () => {
  const fetcher = async () => jsonResponse("unused");
  await assert.rejects(
    translate("a", "English", "Chinese", optionsWith(fetcher, { customBaseUrl: "http://example.com/v1" })),
    /must use HTTPS/,
  );
  await assert.rejects(
    translate("a", "English", "Chinese", optionsWith(fetcher, { customBaseUrl: "https://user:pass@example.com/v1" })),
    /must not contain credentials/,
  );
});

test("Qwen MT uses translation_options and disables cumulative streaming", async () => {
  let request;
  const options = optionsWith(async (_url, init) => {
    request = JSON.parse(init.body);
    return jsonResponse("Hello");
  }, { model: "qwen-mt-plus", stream: true });
  options.detect = "Simplified Chinese";
  assert.equal(await translate("你好", "auto", "English", options), "Hello");
  assert.deepEqual(request.messages, [{ role: "user", content: "你好" }]);
  assert.deepEqual(request.translation_options, {
    source_lang: "Simplified Chinese",
    target_lang: "English",
  });
  assert.equal(request.stream, false);
  assert.equal("enable_thinking" in request, false);
});

test("OCR supports the pay-as-you-go Qwen OCR preset", async () => {
  let request;
  const options = optionsWith(async (_url, init) => {
    request = JSON.parse(init.body);
    return jsonResponse("发票号码\n12345");
  }, { model: "qwen3.5-ocr" });
  const result = await recognize("YWJjZA==", "Simplified Chinese", options);
  assert.equal(result, "发票号码\n12345");
  assert.equal(request.messages.length, 1);
  assert.equal(request.messages[0].role, "user");
  assert.equal(request.messages[0].content[0].image_url.url, "data:image/png;base64,YWJjZA==");
  assert.equal("enable_thinking" in request, false);
});

test("Qwen 3.7 high effort uses its maximum thinking budget", async () => {
  let request;
  const options = optionsWith(async (_url, init) => {
    request = JSON.parse(init.body);
    return jsonResponse("ok");
  }, { enableThinking: true, reasoningEffort: "high" });
  await translate("test", "English", "Chinese", options);
  assert.equal(request.enable_thinking, true);
  assert.equal(request.thinking_budget, 262144);
});

test("Qwen 3.8 uses native reasoning_effort instead of enable_thinking", async () => {
  const requests = [];
  for (const config of [
    { enableThinking: false, reasoningEffort: "high" },
    { enableThinking: true, reasoningEffort: "medium" },
    { enableThinking: true, reasoningEffort: "high" },
  ]) {
    await translate("test", "English", "Chinese", optionsWith(async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return jsonResponse("ok");
    }, { model: "qwen3.8-max", ...config }));
  }
  assert.equal(requests[0].reasoning_effort, "none");
  assert.equal(requests[1].reasoning_effort, "medium");
  assert.equal(requests[2].reasoning_effort, "xhigh");
  assert.equal("enable_thinking" in requests[2], false);
});

test("reasoning effort is omitted on automatic and ignored while thinking is off", async () => {
  const requests = [];
  for (const config of [
    { enableThinking: true, reasoningEffort: "auto" },
    { enableThinking: false, reasoningEffort: "high" },
  ]) {
    await translate("test", "English", "Chinese", optionsWith(async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return jsonResponse("ok");
    }, config));
  }
  assert.equal(requests[0].enable_thinking, true);
  assert.equal("thinking_budget" in requests[0], false);
  assert.equal(requests[1].enable_thinking, false);
  assert.equal("thinking_budget" in requests[1], false);
});

test("Qwen Coder and Qwen MT reject selectable thinking", async () => {
  for (const model of ["qwen3-coder-plus", "qwen-mt-plus"]) {
    await assert.rejects(
      translate("test", "English", "Chinese", optionsWith(async () => jsonResponse("unused"), {
        model,
        enableThinking: true,
      })),
      /not configured for selectable thinking mode/,
    );
  }
});

test("MiniMax M2.5 is always-thinking and does not accept plugin effort levels", async () => {
  let request;
  await translate("test", "English", "Chinese", optionsWith(async (_url, init) => {
    request = JSON.parse(init.body);
    return jsonResponse("ok");
  }, { model: "MiniMax-M2.5", enableThinking: true }));
  assert.equal("enable_thinking" in request, false);

  await assert.rejects(
    translate("test", "English", "Chinese", optionsWith(async () => jsonResponse("unused"), {
      model: "MiniMax-M2.5",
      enableThinking: false,
    })),
    /always-thinking/,
  );
  await assert.rejects(
    translate("test", "English", "Chinese", optionsWith(async () => jsonResponse("unused"), {
      model: "MiniMax-M2.5",
      enableThinking: true,
      reasoningEffort: "high",
    })),
    /does not support configurable Reasoning effort/,
  );
});

test("unknown custom models work with thinking off but fail safely when it is on", async () => {
  let request;
  const disabled = optionsWith(async (_url, init) => {
    request = JSON.parse(init.body);
    return jsonResponse("ok");
  }, { model: "future-model", enableThinking: false });
  assert.equal(await translate("test", "English", "Chinese", disabled), "ok");
  assert.equal("enable_thinking" in request, false);

  await assert.rejects(
    translate("test", "English", "Chinese", optionsWith(async () => jsonResponse("unused"), {
      model: "future-model",
      enableThinking: true,
    })),
    /thinking compatibility table/,
  );
});

test("streaming ignores reasoning_content and emits only result chunks", async () => {
  const chunks = [];
  const sse = [
    'data: {"choices":[{"delta":{"reasoning_content":"hidden"},"finish_reason":null}]}',
    'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}',
    'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}',
    "data: [DONE]",
    "",
  ].join("\r\n\r\n");
  const result = await translate("你好", "Chinese", "English", optionsWith(async () => new Response(sse, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  }), { stream: true, enableThinking: true }, chunks));
  assert.equal(result, "Hello world");
  assert.deepEqual(chunks, ["Hello", " world"]);
});

test("Manggo coalesces many SSE deltas while preserving exact incremental output", async () => {
  const chunks = [];
  const expected = Array.from({ length: 1000 }, (_, index) => String(index % 10)).join("");
  const sse = [
    ...Array.from(expected, (character) => `data: {"choices":[{"delta":{"content":"${character}"},"finish_reason":null}]}`),
    "data: [DONE]",
    "",
  ].join("\n\n");
  const result = await translate("source", "English", "Chinese", optionsWith(async () => new Response(sse, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  }), { stream: true }, chunks));
  assert.equal(result, expected);
  assert.equal(chunks.join(""), expected);
  assert.ok(chunks.length < 30, `expected fewer than 30 callbacks, received ${chunks.length}`);
});

test("Manggo parses CRLF SSE and UTF-8 characters across arbitrary byte chunks", async () => {
  const chunks = [];
  const sse = [
    'data: {"choices":[{"delta":{"content":"你"},"finish_reason":null}]}',
    'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}]}',
    "data: [DONE]",
    "",
  ].join("\r\n\r\n");
  const bytes = new TextEncoder().encode(sse);
  const body = new ReadableStream({
    start(controller) {
      for (let index = 0; index < bytes.length; index += 1) {
        controller.enqueue(bytes.slice(index, index + 1));
      }
      controller.close();
    },
  });
  const result = await translate("hello", "English", "Chinese", optionsWith(async () => new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  }), { stream: true }, chunks));
  assert.equal(result, "你好");
  assert.equal(chunks.join(""), "你好");
});

test("streaming mode accepts a JSON fallback and preserves outer whitespace", async () => {
  const result = await translate("test", "English", "Chinese", optionsWith(
    async () => jsonResponse("  fallback\n"),
    { stream: true },
  ));
  assert.equal(result, "  fallback\n");
});

test("empty translation does not spend a request", async () => {
  let called = false;
  const result = await translate("", "auto", "English", optionsWith(async () => {
    called = true;
    return jsonResponse("unused");
  }));
  assert.equal(result, "");
  assert.equal(called, false);
});

test("truncated output is rejected", async () => {
  await assert.rejects(
    translate("long", "English", "Chinese", optionsWith(
      async () => jsonResponse("partial", { finishReason: "length" }),
    )),
    /output was truncated/,
  );
});

test("HTTP errors redact the key and explain billing-mode mismatches", async () => {
  const options = optionsWith(async () => new Response(JSON.stringify({
    error: { message: "invalid not-a-real-key" },
  }), { status: 401 }));
  await assert.rejects(
    translate("test", "English", "Chinese", options),
    (error) => {
      assert.match(error.message, /billing mode, region, and Base URL/);
      assert.doesNotMatch(error.message, /not-a-real-key/);
      assert.match(error.message, /\[REDACTED\]/);
      return true;
    },
  );
});

test("a full chat completions URL is not appended twice", async () => {
  let requestedUrl;
  await translate("test", "English", "Chinese", optionsWith(async (url) => {
    requestedUrl = url;
    return jsonResponse("ok");
  }, { customBaseUrl: "https://example.test/v1/chat/completions" }));
  assert.equal(requestedUrl, "https://example.test/v1/chat/completions");
});
