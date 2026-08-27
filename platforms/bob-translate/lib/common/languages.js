/* Bob language codes stay at the platform boundary. */

var LANGUAGE_NAMES = {
  "auto": "Auto detect",
  "zh-Hans": "Simplified Chinese",
  "zh-Hant": "Traditional Chinese",
  "yue": "Cantonese",
  "en": "English",
  "ja": "Japanese",
  "ko": "Korean",
  "fr": "French",
  "de": "German",
  "es": "Spanish",
  "it": "Italian",
  "ru": "Russian",
  "pt": "Portuguese",
  "pt-pt": "Portuguese (Portugal)",
  "pt-br": "Portuguese (Brazil)",
  "nl": "Dutch",
  "pl": "Polish",
  "ar": "Arabic",
  "tr": "Turkish",
  "vi": "Vietnamese",
  "th": "Thai",
  "id": "Indonesian",
  "ms": "Malay",
  "hi": "Hindi",
  "bn": "Bengali",
  "uk": "Ukrainian",
  "cs": "Czech",
  "sv": "Swedish",
  "da": "Danish",
  "no": "Norwegian",
  "fi": "Finnish",
  "el": "Greek",
  "he": "Hebrew",
  "ro": "Romanian",
  "hu": "Hungarian",
  "bg": "Bulgarian",
  "sk": "Slovak",
  "sl": "Slovenian",
  "ca": "Catalan",
  "fa": "Persian",
  "ur": "Urdu"
};

var QWEN_MT_LANGUAGE_NAMES = {
  "zh-Hans": "Simplified Chinese",
  "zh-Hant": "Traditional Chinese",
  "yue": "Cantonese",
  "en": "English",
  "ja": "Japanese",
  "ko": "Korean",
  "fr": "French",
  "de": "German",
  "es": "Spanish",
  "it": "Italian",
  "ru": "Russian",
  "pt": "Portuguese",
  "pt-pt": "Portuguese",
  "pt-br": "Portuguese",
  "nl": "Dutch",
  "pl": "Polish",
  "ar": "Arabic",
  "tr": "Turkish",
  "vi": "Vietnamese",
  "th": "Thai",
  "id": "Indonesian",
  "ms": "Malay",
  "hi": "Hindi",
  "bn": "Bengali",
  "uk": "Ukrainian",
  "cs": "Czech",
  "sv": "Swedish",
  "da": "Danish",
  "no": "Norwegian",
  "fi": "Finnish",
  "el": "Greek",
  "he": "Hebrew",
  "ro": "Romanian",
  "hu": "Hungarian",
  "bg": "Bulgarian",
  "sk": "Slovak",
  "sl": "Slovenian",
  "ca": "Catalan",
  "fa": "Persian",
  "ur": "Urdu"
};

function supportLanguages() {
  return Object.keys(LANGUAGE_NAMES);
}

function isSupported(code) {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, code);
}

function languageName(code) {
  if (code === "auto") return "Auto detect";
  if (!isSupported(code)) throw new Error("Unsupported Bob language: " + String(code) + ".");
  return LANGUAGE_NAMES[code];
}

function qwenMtLanguage(code) {
  if (code === "auto") return "auto";
  if (!Object.prototype.hasOwnProperty.call(QWEN_MT_LANGUAGE_NAMES, code)) {
    throw new Error("The selected language is not available for Qwen MT: " + String(code) + ".");
  }
  return QWEN_MT_LANGUAGE_NAMES[code];
}

function selectedLanguage(query, key, detectedKey, fallback) {
  var requested = query && query[key] ? query[key] : "auto";
  if (requested !== "auto") return requested;
  var detected = query && query[detectedKey] ? query[detectedKey] : "";
  return detected || fallback;
}

function resolveTranslationLanguages(query) {
  var from = selectedLanguage(query, "from", "detectFrom", "auto");
  var to = selectedLanguage(query, "to", "detectTo", "en");
  if (!isSupported(from)) throw new Error("Unsupported Bob language: " + String(from) + ".");
  if (!isSupported(to)) throw new Error("Unsupported Bob language: " + String(to) + ".");
  return {
    from: from,
    to: to,
    sourceName: languageName(from),
    targetName: languageName(to),
    qwenMtFrom: qwenMtLanguage(from),
    qwenMtTo: qwenMtLanguage(to)
  };
}

module.exports = {
  isSupported: isSupported,
  languageName: languageName,
  qwenMtLanguage: qwenMtLanguage,
  resolveTranslationLanguages: resolveTranslationLanguages,
  supportLanguages: supportLanguages
};
