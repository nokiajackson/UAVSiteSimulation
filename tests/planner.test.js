import test from "node:test";
import assert from "node:assert/strict";
import {
  gates,
  flags,
  tunnel,
  plan,
  start,
  finish,
  distance,
  length,
  gateCenter,
  gateLead,
} from "../src/planner.js";
for (const radius of [0.3, 0.32, 0.35])
  test(`ordered course, slalom clearance and tunnel at radius ${radius}`, () => {
    const route = plan(radius);
    assert.deepEqual(route.outbound[0], start);
    assert.ok(distance(route.outbound.at(-1), finish) < 1e-9);
    assert.ok(route.total <= route.baseline);
    assert.equal(route.total, length(route.outbound));
    gates.forEach((g, i) => {
      const entry = route.outbound[1 + i * 2],
        exit = route.outbound[2 + i * 2];
      const dot = (p) =>
        p.reduce((sum, v, j) => sum + (v - g.center[j]) * g.normal[j], 0);
      assert.ok(Math.abs(dot(entry) + gateLead) < 1e-9);
      assert.ok(Math.abs(dot(exit) - gateLead) < 1e-9);
      const middle = entry.map((v, j) => (v + exit[j]) / 2);
      assert.ok(distance(middle, g.center) <= g.radius - radius - 0.05 + 1e-9);
      if (g.arch) assert.ok(middle[1] >= g.center[1]);
    });
    flags.forEach((f, i) => {
      const a = route.slalom[1 + i * 2],
        b = route.slalom[2 + i * 2];
      assert.ok((a[0] - f.center[0]) * f.side >= f.width / 2 + radius + 0.149);
      assert.ok(a[2] < f.center[2] && b[2] > f.center[2]);
    });
    // Check the entire loop, including connecting and return segments, against flag panels and poles.
    for (let i = 1; i < route.loop.length; i++)
      for (let t = 0; t <= 1; t += 0.01) {
        const p = route.loop[i - 1].map(
          (v, j) => v + (route.loop[i][j] - v) * t,
        );
        assert.ok(p[1] >= radius);
        for (const f of flags) {
          const dx = Math.max(
            Math.abs(p[0] - f.center[0]) - f.width / 2 - 0.025,
            0,
          );
          const dz = Math.max(Math.abs(p[2] - f.center[2]) - 0.025, 0);
          assert.ok(Math.hypot(dx, dz) > radius, `flag collision at ${p}`);
        }
      }
    const [entry, exit] = route.tunnelPoints;
    assert.ok(entry[2] < tunnel.center[2] - tunnel.halfLength);
    assert.ok(exit[2] > tunnel.center[2] + tunnel.halfLength);
    assert.ok(Math.abs(entry[0] - tunnel.center[0]) < 1e-9);
    assert.ok(Math.abs(exit[0] - tunnel.center[0]) < 1e-9);
    assert.equal(tunnel.rotationY, Math.PI / 2);
    assert.ok(
      entry[1] - radius > 0 &&
        entry[1] + radius < tunnel.legHeight + tunnel.radius,
    );
    assert.deepEqual(route.loop.at(-1), start);
    assert.equal(route.loopLength, length(route.loop));
  });
test("rejects impossible and invalid safety radii", () => {
  for (const r of [0.7, 0, -1, NaN]) assert.throws(() => plan(r));
});

test("stage 05 contains left horizontal, center vertical, right horizontal rings", () => {
  const group = gates.filter((g) => g.stage === "05");
  assert.deepEqual(
    group.map((g) => g.id),
    ["05-L", "05-C", "05-R"],
  );
  assert.ok(
    group[0].center[0] < group[1].center[0] &&
      group[1].center[0] < group[2].center[0],
  );
  assert.deepEqual(
    group.map((g) => Math.abs(g.normal[1])),
    [1, 0, 1],
  );
  assert.equal(group[1].normal[0], 1);
  assert.ok(group[0].center[1] > group[1].center[1] + group[1].radius);
  assert.ok(group[2].center[1] > group[1].center[1] + group[1].radius);
  for (const g of group) {
    const c = gateCenter(g, [0.1, 0.2]);
    assert.ok(
      Math.abs(
        c.reduce((sum, v, i) => sum + (v - g.center[i]) * g.normal[i], 0),
      ) < 1e-9,
    );
  }
});

for (const radius of [0.3, 0.35])
  test(`compact stage 05 avoids ring material at radius ${radius}`, () => {
    const { loop } = plan(radius);
    for (let i = 1; i < loop.length; i++) {
      const a = loop[i - 1],
        b = loop[i],
        steps = Math.ceil(distance(a, b) / 0.01);
      for (let k = 0; k <= steps; k++)
        for (const g of gates.filter((g) => g.stage === "05")) {
          const d = a.map((v, j) => v + ((b[j] - v) * k) / steps - g.center[j]);
          const axial = d.reduce((sum, v, j) => sum + v * g.normal[j], 0);
          const radial = Math.sqrt(
            Math.max(0, d.reduce((sum, v) => sum + v * v, 0) - axial * axial),
          );
          assert.ok(
            Math.hypot(axial, radial - g.radius) >= radius + 0.055,
            `route clips ${g.id}`,
          );
        }
    }
  });
