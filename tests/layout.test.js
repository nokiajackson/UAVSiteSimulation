import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultLayout,
  parseLayout,
  serializeLayout,
  updateTransform,
  definitions,
} from "../src/layout.js";
import { plan, courseFromLayout, distance, gateLead } from "../src/planner.js";

test("full layout round trip preserves positions and XYZ rotations for every object", () => {
  let layout = createDefaultLayout();
  for (const d of definitions)
    layout = updateTransform(
      layout,
      d.id,
      [1.25, 2.5, -3.75],
      [0.1, -0.2, 0.3],
    );
  assert.deepEqual(parseLayout(serializeLayout(layout)), layout);
  const original = createDefaultLayout();
  assert.notDeepEqual(layout, original);
  assert.deepEqual(original, createDefaultLayout());
});
test("rejects malformed, incomplete, duplicate and non-finite transforms", () => {
  const cases = [];
  for (const patch of [
    (o) => o.objects.pop(),
    (o) => (o.version = 2),
    (o) => (o.objects[0].position = [1, 2]),
    (o) => (o.objects[0].rotation = [NaN, 0, 0]),
    (o) => (o.objects[0].position = [101, 0, 0]),
    (o) => (o.objects[0].type = "unknown"),
    (o) => (o.objects[1].id = o.objects[0].id),
    (o) => (o.objects[0].position = ["0", 0, 0]),
  ]) {
    const layout = createDefaultLayout();
    patch(layout);
    cases.push(layout);
  }
  for (const bad of cases) assert.throws(() => serializeLayout(bad));
  assert.throws(() => parseLayout("{bad json}"));
  assert.throws(() => parseLayout(" ".repeat(1000001)));
});
test("planning preserves input and default layouts support playback", () => {
  for (const radius of [0.3, 0.32, 0.35]) {
    const layout = createDefaultLayout(),
      before = serializeLayout(layout),
      route = plan(radius, layout);
    assert.equal(serializeLayout(layout), before);
    assert.equal(route.valid, true, route.warnings.join(";"));
  }
});
test("moved and tilted ring updates crossing plane and direction", () => {
  const layout = updateTransform(
    createDefaultLayout(),
    "02",
    [-4, 2, 1],
    [0.2, 0.7, -0.3],
  );
  const course = courseFromLayout(layout),
    gate = course.gates[0],
    route = plan(0.3, layout);
  for (const [index, sign] of [
    [1, -1],
    [2, 1],
  ]) {
    const dot = route.outbound[index].reduce(
      (s, v, j) => s + (v - gate.center[j]) * gate.normal[j],
      0,
    );
    assert.ok(Math.abs(dot - sign * gateLead) < 1e-9);
  }
  assert.ok(Math.abs(gate.normal[0]) > 0.1);
});
test("flag slalom and tunnel endpoints follow their own rotated frames", () => {
  let layout = updateTransform(
    createDefaultLayout(),
    "06-2",
    [4, 1, 0],
    [0.2, 0.7, 0.1],
  );
  layout = updateTransform(layout, "07", [2, 0.5, 3], [0.1, 0, 0.2]);
  const c = courseFromLayout(layout),
    r = plan(0.3, layout),
    f = c.flags[1];
  const p = f.frame.local(r.slalom[3]);
  assert.ok(p[0] > f.width / 2 + 0.3);
  assert.ok(Math.abs(p[2] + 0.4) < 1e-9);
  for (const [i, x] of [
    [0, 1.7],
    [1, -1.7],
  ])
    assert.ok(
      distance(c.tunnelFrame.local(r.tunnelPoints[i]), [x, 0.85, 0]) < 1e-9,
    );
});
test("start pad movement affects loop, and obstacle conflicts stop playback", () => {
  let layout = updateTransform(
    createDefaultLayout(),
    "01",
    [-4, 0, 4],
    [0, 0.5, 0],
  );
  const r = plan(0.3, layout);
  assert.deepEqual(r.loop[0], [-4, 0.4, 4]);
  assert.deepEqual(r.loop.at(-1), r.loop[0]);
  layout = updateTransform(layout, "wall-back", [-4, 0.4, 4], [0, 0, 0]);
  const blocked = plan(0.3, layout);
  assert.equal(blocked.valid, false);
  assert.ok(blocked.warnings.some((w) => w.includes("後方牆面")));
});
