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
  if (!data || data === "[DONE]") return false;
  var decoded;
  try {
    decoded = JSON.parse(data);
  } catch (_) {
    throw new Error("Model Studio returned an invalid streaming event.");
  }
  var choice = decoded && decoded.choices && decoded.choices[0];
  if (!choice) return false;
  if (choice.finish_reason === "length") state.truncated = true;
  var addition = contentText(choice.delta && choice.delta.content);
  if (!addition) return false;
  state.result += addition;
  return true;
}

function createSseAccumulator(onContent) {
  var buffer = "";
  var state = { result: "", truncated: false };

  function drain(flush) {
    var delimiter;
    while ((delimiter = /\r?\n\r?\n/.exec(buffer))) {
      var block = buffer.slice(0, delimiter.index);
      buffer = buffer.slice(delimiter.index + delimiter[0].length);
      if (processEvent(block, state) && typeof onContent === "function") onContent(state.result);
    }
    if (flush && buffer.trim()) {
      if (processEvent(buffer, state) && typeof onContent === "function") onContent(state.result);
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
  contentText: contentText,
  createSseAccumulator: createSseAccumulator,
  eventData: eventData
};
