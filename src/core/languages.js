import { nonEmptyText } from "./config.js";

const LANGUAGE_ENTRIES = [
  { name: "English", bob: "en", aliases: ["en", "en_us", "en-us", "english"] },
  { name: "Simplified Chinese", bob: "zh-Hans", aliases: ["zh", "zh_cn", "zh-cn", "zh-hans", "simplified chinese", "chinese"] },
  { name: "Traditional Chinese", bob: "zh-Hant", aliases: ["zh_tw", "zh-tw", "zh-hant", "traditional chinese"] },
  { name: "Cantonese", bob: "yue", aliases: ["yue", "cantonese"] },
  { name: "Japanese", bob: "ja", aliases: ["ja", "ja_jp", "ja-jp", "japanese"] },
  { name: "Korean", bob: "ko", aliases: ["ko", "ko_kr", "ko-kr", "korean"] },
  { name: "French", bob: "fr", aliases: ["fr", "fr_fr", "fr-fr", "french"] },
  { name: "German", bob: "de", aliases: ["de", "de_de", "de-de", "german"] },
  { name: "Spanish", bob: "es", aliases: ["es", "es_es", "es-es", "spanish"] },
  { name: "Italian", bob: "it", aliases: ["it", "it_it", "it-it", "italian"] },
  { name: "Russian", bob: "ru", aliases: ["ru", "ru_ru", "ru-ru", "russian"] },
  { name: "Portuguese", bob: "pt", aliases: ["pt", "portuguese"] },
  { name: "Portuguese (Portugal)", bob: "pt-pt", aliases: ["pt-pt", "pt_pt", "portuguese (portugal)"] },
  { name: "Portuguese (Brazil)", bob: "pt-br", aliases: ["pt-br", "pt_br", "portuguese (brazil)"] },
  { name: "Dutch", bob: "nl", aliases: ["nl", "dutch"] },
  { name: "Polish", bob: "pl", aliases: ["pl", "polish"] },
  { name: "Arabic", bob: "ar", aliases: ["ar", "arabic"] },
  { name: "Turkish", bob: "tr", aliases: ["tr", "turkish"] },
  { name: "Vietnamese", bob: "vi", aliases: ["vi", "vi_vn", "vi-vn", "vietnamese"] },
  { name: "Thai", bob: "th", aliases: ["th", "thai"] },
  { name: "Indonesian", bob: "id", aliases: ["id", "indonesian"] },
  { name: "Malay", bob: "ms", aliases: ["ms", "malay"] },
  { name: "Hindi", bob: "hi", aliases: ["hi", "hindi"] },
  { name: "Bengali", bob: "bn", aliases: ["bn", "bengali"] },
  { name: "Ukrainian", bob: "uk", aliases: ["uk", "uk_ua", "uk-ua", "ukrainian"] },
  { name: "Czech", bob: "cs", aliases: ["cs", "czech"] },
  { name: "Swedish", bob: "sv", aliases: ["sv", "swedish"] },
  { name: "Danish", bob: "da", aliases: ["da", "danish"] },
  { name: "Norwegian", bob: "no", aliases: ["no", "norwegian"] },
  { name: "Finnish", bob: "fi", aliases: ["fi", "finnish"] },
  { name: "Greek", bob: "el", aliases: ["el", "greek"] },
  { name: "Hebrew", bob: "he", aliases: ["he", "hebrew"] },
  { name: "Romanian", bob: "ro", aliases: ["ro", "romanian"] },
  { name: "Hungarian", bob: "hu", aliases: ["hu", "hungarian"] },
  { name: "Bulgarian", bob: "bg", aliases: ["bg", "bulgarian"] },
  { name: "Slovak", bob: "sk", aliases: ["sk", "slovak"] },
  { name: "Slovenian", bob: "sl", aliases: ["sl", "slovenian"] },
  { name: "Catalan", bob: "ca", aliases: ["ca", "catalan"] },
  { name: "Persian", bob: "fa", aliases: ["fa", "persian"] },
  { name: "Urdu", bob: "ur", aliases: ["ur", "urdu"] },
];

const BY_ALIAS = Object.create(null);
const BY_BOB = Object.create(null);
for (let index = 0; index < LANGUAGE_ENTRIES.length; index += 1) {
  const entry = LANGUAGE_ENTRIES[index];
  BY_BOB[entry.bob.toLowerCase()] = entry;
  for (let aliasIndex = 0; aliasIndex < entry.aliases.length; aliasIndex += 1) {
    BY_ALIAS[entry.aliases[aliasIndex]] = entry;
  }
}

function lookup(input) {
  const raw = nonEmptyText(input);
  if (!raw || raw.toLowerCase() === "auto") return undefined;
  return BY_ALIAS[raw.toLowerCase().replace(/_/g, "-").replace(/-/g, "-")]
    || BY_ALIAS[raw.toLowerCase()]
    || BY_BOB[raw.toLowerCase()];
}

/** Returns a model-facing language name while preserving unknown custom names. */
export function languageDisplayName(input, fallback = "") {
  const raw = nonEmptyText(input, fallback);
  if (!raw || raw.toLowerCase() === "auto") return raw;
  const entry = lookup(raw);
  return entry ? entry.name : raw;
}

/**
 * Use the explicit language where possible, otherwise a detected one, then
 * expose the same "Auto detect" prompt wording used by the original plugin.
 */
export function languageName(requested, detected) {
  const explicit = languageDisplayName(requested);
  if (explicit && explicit.toLowerCase() !== "auto") return explicit;
  const fallback = languageDisplayName(detected);
  return fallback && fallback.toLowerCase() !== "auto" ? fallback : "Auto detect";
}

export function bobLanguageCode(input, fallback = "auto") {
  const raw = nonEmptyText(input, fallback);
  if (!raw || raw.toLowerCase() === "auto") return "auto";
  const entry = lookup(raw);
  return entry ? entry.bob : raw;
}

export const LANGUAGE_MAPPINGS = Object.freeze(LANGUAGE_ENTRIES.map((entry) => Object.freeze({
  name: entry.name,
  bob: entry.bob,
})));
