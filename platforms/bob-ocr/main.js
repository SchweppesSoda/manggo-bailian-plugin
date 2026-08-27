var core = require("./lib/core.js");
var imageTools = require("./lib/image.js");
var languages = require("./lib/languages.js");
var bobOcr = require("./lib/plugin.js");

var runtime = bobOcr.createBobOcrPlugin({
  core: core,
  imageTools: imageTools,
  languages: languages,
  getOption: function () { return $option; },
  http: $http,
});

function supportLanguages() {
  return runtime.supportLanguages();
}

function pluginTimeoutInterval() {
  return runtime.pluginTimeoutInterval();
}

function pluginValidate(completion) {
  runtime.pluginValidate(completion);
}

function ocr(query, completion) {
  runtime.ocr(query, completion);
}
