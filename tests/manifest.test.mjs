import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../manggo.plugin.json", import.meta.url), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("manifest declares a public multi-mode v2 plugin with both services", () => {
  assert.equal(manifest.manifestVersion, 1);
  assert.equal(manifest.version, "2.0.0");
  assert.equal(packageJson.version, manifest.version);
  assert.equal(manifest.homepage, "https://github.com/SchweppesSoda/manggo-bailian-plugin");
  assert.deepEqual(manifest.runtime, {
    kind: "bun",
    api: "manggo.plugin.v1",
    main: "main.js",
  });
  assert.deepEqual(
    manifest.services.map(({ id, kind, entry }) => ({ id, kind, entry })),
    [
      { id: "translation", kind: "translation", entry: "translate" },
      { id: "ocr", kind: "ocr", entry: "recognize" },
    ],
  );
});

test("both services expose all billing modes and protect the API Key", () => {
  for (const service of manifest.services) {
    const configs = Object.fromEntries(service.config.map((item) => [item.key, item]));
    assert.equal(configs.accessMode.default, "pay_as_you_go");
    assert.deepEqual(
      configs.accessMode.options.map((option) => option.value),
      ["pay_as_you_go", "coding_plan", "token_plan"],
    );
    assert.deepEqual(
      configs.region.options.map((option) => option.value),
      ["china", "singapore"],
    );
    assert.equal(configs.apiKey.control, "password");
    assert.equal(configs.apiKey.secret, true);
    assert.equal(configs.model.default, "qwen3.7-plus");
    assert.equal(configs.model.editable, true);
    assert.ok(configs.workspaceId);
    assert.ok(configs.customBaseUrl);
  }
});

test("both services use the original packaged icon and expose optional thinking", async () => {
  assert.equal(manifest.icon, "icon.png");
  for (const service of manifest.services) {
    assert.equal(service.icon, "icon.png");
    const configs = Object.fromEntries(service.config.map((item) => [item.key, item]));
    assert.equal(configs.enableThinking.default, false);
    assert.equal(configs.reasoningEffort.default, "auto");
    assert.deepEqual(
      configs.reasoningEffort.options.map((option) => option.value),
      ["auto", "low", "medium", "high"],
    );
  }

  const icon = await readFile(new URL("../icon.png", import.meta.url));
  assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(icon.readUInt32BE(16), 256);
  assert.equal(icon.readUInt32BE(20), 256);
});

test("translation and OCR presets include pay-as-you-go specialists", () => {
  const translation = manifest.services.find((service) => service.kind === "translation");
  const ocr = manifest.services.find((service) => service.kind === "ocr");
  const translationModels = translation.config.find((item) => item.key === "model").options.map((item) => item.value);
  const ocrModels = ocr.config.find((item) => item.key === "model").options.map((item) => item.value);
  assert.ok(translationModels.includes("qwen-mt-plus"));
  assert.ok(translationModels.includes("qwen3.7-plus"));
  assert.ok(ocrModels.includes("qwen3.5-ocr"));
  assert.ok(ocrModels.includes("qwen3.7-plus"));
});

test("public repository includes license, security policy, and CI", async () => {
  const [license, security, workflow, packageScript] = await Promise.all([
    readFile(new URL("../LICENSE", import.meta.url), "utf8"),
    readFile(new URL("../SECURITY.md", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/package.ps1", import.meta.url), "utf8"),
  ]);
  assert.match(license, /MIT License/);
  assert.match(security, /private vulnerability reporting/i);
  assert.match(workflow, /node --test/);
  assert.match(packageScript, /'LICENSE'/);
  assert.match(packageScript, /'icon\.png'/);
});
