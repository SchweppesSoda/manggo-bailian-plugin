/* Incremental Server-Sent Events parsing for Bob's streamHandler chunks. */

// The generated Core bundle owns event decoding and output batching.
// Only Bob's incremental transport framing belongs in this adapter.
var core = require("../core.js");

function processEvent(block, state) {
  var event = core.parseSseEvent(block);
  if (event.truncated) state.truncated = true;
  return event.addition;
}

function createSseAccumulator(onContent) {
  var buffer = "";
  var state = { truncated: false };

  function drain(flush) {
    var delimiter;
    while ((delimiter = /\r?\n\r?\n/.exec(buffer))) {
      var block = buffer.slice(0, delimiter.index);
      buffer = buffer.slice(delimiter.index + delimiter[0].length);
      var addition = processEvent(block, state);
      if (addition && typeof onContent === "function") onContent(addition);
    }
    if (flush && buffer.trim()) {
      var tail = processEvent(buffer, state);
      if (tail && typeof onContent === "function") onContent(tail);
      buffer = "";
    }
  }

  return {
    push: function (text) {
      if (text) {
        buffer += String(text);
        drain(false);
      }
    },
    finish: function () {
      drain(true);
      return state;
    },
    state: state
  };
}

module.exports = {
  contentText: core.contentText,
  createSseAccumulator: createSseAccumulator,
  createStreamBatcher: core.createStreamBatcher,
  eventData: core.eventData
};
