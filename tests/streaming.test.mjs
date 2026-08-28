import assert from "node:assert/strict";
import test from "node:test";
import { createStreamBatcher } from "../src/core/index.js";

test("Manggo-style batching emits exact deltas with bounded callback count", () => {
  const emitted = [];
  let clock = 0;
  const batcher = createStreamBatcher((value) => emitted.push(value), {
    mode: "delta",
    minIntervalMs: 60,
    maxPendingChars: 96,
    now: () => clock,
  });
  const expected = Array.from({ length: 1000 }, (_, index) => String(index % 10)).join("");
  for (const character of expected) {
    batcher.push(character, clock);
    clock += 1;
  }
  const result = batcher.finish(clock);
  assert.equal(result, expected);
  assert.equal(emitted.join(""), expected);
  assert.equal(emitted[0], expected[0]);
  assert.ok(emitted.length < 30, `expected fewer than 30 callbacks, received ${emitted.length}`);
});

test("Bob-style batching emits monotonic cumulative snapshots and an exact final result", () => {
  const snapshots = [];
  let clock = 0;
  const batcher = createStreamBatcher((value) => snapshots.push(value), {
    mode: "snapshot",
    minIntervalMs: 50,
    maxPendingChars: 64,
    now: () => clock,
  });
  const additions = Array.from({ length: 500 }, (_, index) => String(index % 10));
  for (const addition of additions) {
    batcher.push(addition, clock);
    clock += 1;
  }
  const result = batcher.finish(clock);
  assert.equal(result, additions.join(""));
  assert.equal(snapshots.at(-1), result);
  for (let index = 1; index < snapshots.length; index += 1) {
    assert.ok(snapshots[index].startsWith(snapshots[index - 1]));
  }
  assert.ok(snapshots.length < 30, `expected fewer than 30 snapshots, received ${snapshots.length}`);
});

test("cancel discards pending output and prevents late callbacks", () => {
  const emitted = [];
  const batcher = createStreamBatcher((value) => emitted.push(value), { mode: "delta", now: () => 0 });
  batcher.push("first", 0);
  batcher.push("pending", 0);
  batcher.cancel();
  batcher.push("late", 100);
  assert.deepEqual(emitted, ["first"]);
});
