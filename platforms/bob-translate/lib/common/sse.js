/* Incremental Server-Sent Events parsing for Bob's streamHandler chunks. */

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  var result = "";
  for (var index = 0; index < content.length; index += 1) {
    var part = content[index];
    if (typeof part === "string") result += part;
    else if (part && typeof part.text === "string") result += part.text;
  }
  return result;
}

function eventData(block) {
  var lines = block.split(/\r?\n/);
  var dataLines = [];
  for (var index = 0; index < lines.length; index += 1) {
    if (lines[index].indexOf("data:") === 0) {
      dataLines.push(lines[index].slice(5).replace(/^\s/, ""));
    }
  }
  return dataLines.join("\n").trim();
}

function processEvent(block, state) {
  var data = eventData(block);
  if (!data || data === "[DONE]") return "";
  var decoded;
  try {
    decoded = JSON.parse(data);
  } catch (_) {
    throw new Error("Model Studio returned an invalid streaming event.");
  }
  var choice = decoded && decoded.choices && decoded.choices[0];
  if (!choice) return "";
  if (choice.finish_reason === "length") state.truncated = true;
  var addition = contentText(choice.delta && choice.delta.content);
  if (!addition) return "";
  return addition;
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

function createStreamBatcher(emit, settings) {
  settings = settings || {};
  var mode = settings.mode === "snapshot" ? "snapshot" : "delta";
  var minIntervalMs = Number(settings.minIntervalMs) > 0 ? Math.floor(Number(settings.minIntervalMs)) : 60;
  var maxPendingChars = Number(settings.maxPendingChars) > 0 ? Math.floor(Number(settings.maxPendingChars)) : 96;
  var now = typeof settings.now === "function" ? settings.now : Date.now;
  var resultParts = [];
  var pendingParts = [];
  var pendingChars = 0;
  var emitted = false;
  var stopped = false;
  var lastFlushAt = 0;

  function snapshot() {
    return resultParts.join("");
  }

  function flush(at) {
    if (stopped || pendingChars === 0) return "";
    at = typeof at === "number" ? at : now();
    var output = mode === "snapshot" ? snapshot() : pendingParts.join("");
    pendingParts = [];
    pendingChars = 0;
    emitted = true;
    lastFlushAt = at;
    if (typeof emit === "function") emit(output);
    return output;
  }

  function push(input, at) {
    if (stopped || input === undefined || input === null) return false;
    var addition = String(input);
    if (!addition) return false;
    at = typeof at === "number" ? at : now();
    resultParts.push(addition);
    pendingParts.push(addition);
    pendingChars += addition.length;
    var elapsed = emitted ? at - lastFlushAt : Infinity;
    var boundary = pendingChars >= 32 && /[\n\r。！？.!?]\s*$/.test(addition);
    if (!emitted || pendingChars >= maxPendingChars || elapsed >= minIntervalMs || boundary) {
      flush(at);
      return true;
    }
    return false;
  }

  function finish(at) {
    if (!stopped) flush(at);
    stopped = true;
    return snapshot();
  }

  function cancel() {
    stopped = true;
    pendingParts = [];
    pendingChars = 0;
  }

  return {
    cancel: cancel,
    finish: finish,
    flush: flush,
    push: push,
    snapshot: snapshot
  };
}

module.exports = {
  contentText: contentText,
  createSseAccumulator: createSseAccumulator,
  createStreamBatcher: createStreamBatcher,
  eventData: eventData
};
