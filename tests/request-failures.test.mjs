import test from "node:test";
import assert from "node:assert/strict";
import * as source from "../src/manggo/entry.js";
import * as generated from "../main.js";

for (const [label, api] of Object.entries({ source, generated })) {
  for (const failure of ["fetch", "reader", "abort", "service"]) {
    test(label + ": " + failure + " rejects and redacts the original request key", async () => {
      const apiKey = "fixture-original-private-key";
      const options = {
        config: { apiKey, accessMode: "pay_as_you_go", model: "qwen3.7-plus", stream: true },
        setResult() {},
        utils: { fetch: async () => {
          options.config.apiKey = "changed-key";
          const error = new Error("offline failure " + apiKey);
          if (failure === "abort") error.name = "AbortError";
          if (failure === "fetch" || failure === "abort") throw error;
          let count = 0;
          return {
            ok: true,
            headers: new Headers({ "content-type": "text/event-stream" }),
            body: { getReader: () => ({ read: async () => {
              count += 1;
              if (count === 1) return { value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'), done: false };
              if (failure === "reader") throw error;
              if (count === 2) return { value: new TextEncoder().encode("data: " + JSON.stringify({error:{message:apiKey}}) + "\n\n"), done: false };
              return { done: true };
            } }) },
          };
        } },
      };
      await assert.rejects(api.translate("a", "English", "Chinese", options), (error) => {
        assert.equal(String(error).includes(apiKey), false);
        if (failure === "service") assert.match(error.message, /streaming error/);
        if (failure === "abort") assert.equal(error.name, "AbortError");
        return true;
      });
    });
  }
}
