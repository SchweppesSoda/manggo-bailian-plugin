"use strict";

var LANGUAGE_NAMES = {
  auto: "Auto detect",
  "zh-Hans": "Simplified Chinese",
  "zh-Hant": "Traditional Chinese",
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  fr: "French",
  de: "German",
  it: "Italian",
  ru: "Russian",
  vi: "Vietnamese",
  uk: "Ukrainian",
};

var SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_NAMES);

function resolvedLanguage(query) {
  var requested = query && query.from;
  var detected = query && query.detectFrom;
  var code = requested === "auto" && detected ? detected : requested;
  if (!code) code = "auto";
  if (!Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, code)) {
    var error = new Error("Unsupported OCR language: " + code + ".");
    error.bobType = "unsupportedLanguage";
    throw error;
  }
  return { code: code, name: LANGUAGE_NAMES[code] };
}

module.exports = {
  LANGUAGE_NAMES: LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES: SUPPORTED_LANGUAGES,
  resolvedLanguage: resolvedLanguage,
};
