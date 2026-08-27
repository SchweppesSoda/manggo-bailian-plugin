var plugin = require("./lib/translate/main.js");

// Release builds may place a JavaScriptCore-compatible src/core bundle here.
// The source package remains usable with the local fallback when it is absent.
try {
  plugin.setCore(require("./lib/core.js"));
} catch (_) {
  // No generated core bundle in source-checkout / development mode.
}

function supportLanguages() {
  return plugin.supportLanguages();
}

function translate(query, completion) {
  plugin.translate(query, completion);
}

function pluginValidate(completion) {
  plugin.pluginValidate(completion);
}

function pluginTimeoutInterval() {
  return plugin.pluginTimeoutInterval();
}
