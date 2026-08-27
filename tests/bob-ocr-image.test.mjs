import assert from "node:assert/strict";
import test from "node:test";
import imageTools from "../src/bob/ocr/image.cjs";
import languages from "../src/bob/ocr/languages.cjs";

function bobData(bytes) {
  return {
    length: bytes.length,
    readUInt8(index) {
      return bytes[index] ?? 0;
    },
    toBase64() {
      return Buffer.from(bytes).toString("base64");
    },
  };
}

test("Bob OCR recognizes supported image signatures", () => {
  assert.equal(imageTools.detectImageMime(bobData([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(imageTools.detectImageMime(bobData([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(imageTools.detectImageMime(bobData([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), "image/gif");
  assert.equal(imageTools.detectImageMime(bobData([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "image/webp");
});

test("Bob OCR builds a MIME-aware data URL and rejects unknown input", () => {
  const png = bobData([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.match(imageTools.imageDataUrl(png), /^data:image\/png;base64,/);
  assert.throws(() => imageTools.imageDataUrl(bobData([1, 2, 3, 4])), /Unsupported image format/);
});

test("Bob OCR converts model text into ordered non-empty rows", () => {
  assert.deepEqual(imageTools.textRows("第一行\r\n\r\n 第二行 "), [
    { text: "第一行" },
    { text: " 第二行 " },
  ]);
});

test("Bob OCR resolves auto language through detectFrom", () => {
  assert.deepEqual(languages.resolvedLanguage({ from: "auto", detectFrom: "zh-Hans" }), {
    code: "zh-Hans",
    name: "Simplified Chinese",
  });
  assert.throws(
    () => languages.resolvedLanguage({ from: "auto", detectFrom: "xx" }),
    (error) => error.bobType === "unsupportedLanguage",
  );
});
