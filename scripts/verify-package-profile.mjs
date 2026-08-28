import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";

const [profile, manggoStage, bobTranslateStage, bobOcrStage] = process.argv.slice(2);
const codingEnabled = profile === "PersonalCoding";

async function verifyManggo() {
  const entry = path.join(manggoStage, "main.js");
  const plugin = await import(`${pathToFileURL(entry).href}?profile=${encodeURIComponent(profile)}&time=${Date.now()}`);
  let requested = false;
  const options = {
    config: {
      accessMode: "coding_plan",
      apiKey: "profile-verification-key",
      model: "qwen3.7-plus",
      region: "china",
      stream: false,
    },
    utils: {
      fetch: async () => {
        requested = true;
        return new Response(JSON.stringify({
          choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  };

  if (codingEnabled) {
    assert.equal(await plugin.translate("test", "English", "Chinese", options), "ok");
    assert.equal(requested, true);
  } else {
    await assert.rejects(
      plugin.translate("test", "English", "Chinese", options),
      /Coding Plan is disabled in public plugin packages/,
    );
    assert.equal(requested, false);
  }
}

function loadBob(stage, option) {
  const context = vm.createContext({
    $option: option,
    $http: {
      request() { throw new Error("profile verification must not spend a request"); },
      streamRequest() { throw new Error("profile verification must not spend a request"); },
    },
  });
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

  const entry = path.join(stage, "main.js");
  context.require = (request) => loadModule(path.resolve(path.dirname(entry), request));
  new vm.Script(readFileSync(entry, "utf8"), { filename: entry }).runInContext(context);
  return context;
}

function verifyBob(stage, model) {
  const plugin = loadBob(stage, {
    accessMode: "coding_plan",
    apiKey: "profile-verification-key",
    modelPreset: model,
    region: "china",
  });
  const results = [];
  plugin.pluginValidate((value) => results.push(JSON.parse(JSON.stringify(value))));
  assert.equal(results.length, 1);
  if (codingEnabled) {
    assert.equal(results[0].result, true);
  } else {
    assert.equal(results[0].result, false);
    assert.match(results[0].error.message, /Coding Plan is disabled in public plugin packages/);
  }
}

await verifyManggo();
verifyBob(bobTranslateStage, "qwen3.7-plus");
verifyBob(bobOcrStage, "qwen3.7-plus");
console.log(`Verified ${profile} runtime profile for Manggo, Bob Translate, and Bob OCR.`);
