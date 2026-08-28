"use strict";

var MAX_DATA_URL_CHARS = 20 * 1024 * 1024;

function byteAt(data, index) {
  if (!data || typeof data.readUInt8 !== "function") {
    throw new Error("Bob did not provide readable image data.");
  }
  return data.readUInt8(index);
}

function matches(data, offset, bytes) {
  if (!data || typeof data.length !== "number" || data.length < offset + bytes.length) return false;
  for (var index = 0; index < bytes.length; index += 1) {
    if (byteAt(data, offset + index) !== bytes[index]) return false;
  }
  return true;
}

function detectImageMime(data) {
  if (matches(data, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (matches(data, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (matches(data, 0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return "image/gif";
  if (matches(data, 0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "image/gif";
  if (matches(data, 0, [0x52, 0x49, 0x46, 0x46]) && matches(data, 8, [0x57, 0x45, 0x42, 0x50])) {
    return "image/webp";
  }
  throw new Error("Unsupported image format. Bob OCR accepts PNG, JPEG, WebP, or GIF images.");
}

function imageDataUrl(data) {
  if (!data || typeof data.toBase64 !== "function") {
    throw new Error("Bob did not provide image data that can be converted to Base64.");
  }
  var mime = detectImageMime(data);
  if (typeof data.length === "number") {
    var estimatedBase64Chars = Math.ceil(data.length / 3) * 4;
    var prefixChars = ("data:" + mime + ";base64,").length;
    if (prefixChars + estimatedBase64Chars > MAX_DATA_URL_CHARS) {
      throw new Error("Image data exceeds the 20 MB Data URL limit.");
    }
  }
  var base64 = data.toBase64();
  if (typeof base64 !== "string" || base64.length === 0) throw new Error("Bob returned empty image data.");
  if (/\s/.test(base64)) base64 = base64.replace(/\s+/g, "");
  var result = "data:" + mime + ";base64," + base64;
  if (result.length > MAX_DATA_URL_CHARS) throw new Error("Image data exceeds the 20 MB Data URL limit.");
  return result;
}

function textRows(text) {
  if (text === undefined || text === null) return [];
  return String(text)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter(function (line) { return line.trim().length > 0; })
    .map(function (line) { return { text: line }; });
}

module.exports = {
  detectImageMime: detectImageMime,
  imageDataUrl: imageDataUrl,
  textRows: textRows,
};
