import { Euler, Quaternion, Vector3 } from "three";
import {
  gateDefinitions,
  flagDefinitions,
  tunnelDefinition,
  definitions,
  createDefaultLayout,
} from "./layout.js";
export const gates = gateDefinitions,
  flags = flagDefinitions,
  tunnel = tunnelDefinition;
export const start = [-5, 0.4, 3.5],
  finish = [tunnel.center[0], 0.85, tunnel.center[2] + tunnel.halfLength + 0.5];
export const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
export const length = (points) =>
  points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
const add = (a, b, scale = 1) => a.map((v, i) => v + b[i] * scale);
function frame(object) {
  const q = new Quaternion().setFromEuler(new Euler(...object.rotation));
  return {
    point: (p) =>
      new Vector3(...p)
        .applyQuaternion(q)
        .add(new Vector3(...object.position))
        .toArray(),
    vector: (p) => new Vector3(...p).applyQuaternion(q).toArray(),
    local: (p) =>
      new Vector3(...p)
        .sub(new Vector3(...object.position))
        .applyQuaternion(q.clone().invert())
        .toArray(),
  };
}
export function courseFromLayout(layout = createDefaultLayout()) {
  const byId = Object.fromEntries(layout.objects.map((o) => [o.id, o]));
  const get = (id) => frame(byId[id]);
  return {
    byId,
    get,
    start: get("01").point([0, 0.4, 0]),
    gates: gates.map((g) => {
      const f = get(g.id);
      return {
        ...g,
        center: [...byId[g.id].position],
        normal: f.vector(g.normal),
        u: f.vector(g.normal[0] ? [0, 0, 1] : [1, 0, 0]),
        v: f.vector(g.normal[1] ? [0, 0, 1] : [0, 1, 0]),
      };
    }),
    flags: flags.map((f) => ({ ...f, frame: get(f.id) })),
    tunnelFrame: get("07"),
  };
}
export function gateCenter(g, [u, v]) {
  return add(
    add(g.center, g.u ?? (g.normal[0] ? [0, 0, 1] : [1, 0, 0]), u),
    g.v ?? (g.normal[1] ? [0, 0, 1] : [0, 1, 0]),
    v,
  );
}
export function slalom(radius, course = courseFromLayout()) {
  const result = [];
  course.flags.forEach((f, i) => {
    const x = f.side * (f.width / 2 + radius + 0.15);
    if (i === 0) result.push(f.frame.point([0, 1.2, -0.8]));
    result.push(f.frame.point([x, 1.2, -0.4]), f.frame.point([x, 1.2, 0.4]));
    if (i === course.flags.length - 1)
      result.push(f.frame.point([0, 0.85, 0.65]));
  });
  return result;
}
function ringDistance(p, g) {
  const d = p.map((v, j) => v - g.center[j]),
    axial = d.reduce((s, v, j) => s + v * g.normal[j], 0),
    radial = Math.sqrt(
      Math.max(0, d.reduce((s, v) => s + v * v, 0) - axial * axial),
    );
  return Math.hypot(axial, radial - g.radius) - 0.055;
}
function clearsGroup(points, radius, rings) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      steps = Math.max(1, Math.ceil(distance(a, b) / 0.08));
    for (let k = 0; k <= steps; k++) {
      const p = a.map((v, j) => v + ((b[j] - v) * k) / steps);
      for (const g of rings)
        if (ringDistance(p, g) < radius + 0.045) return false;
    }
  }
  return true;
}
function boxDistance(p, center, size) {
  return Math.hypot(
    ...p.map((v, i) => Math.max(0, Math.abs(v - center[i]) - size[i] / 2)),
  );
}
export function routeWarnings(points, radius, course) {
  const hit = new Set();
  const checkers = definitions.map((d) => {
    const f = course.get(d.id);
    return {
      id: d.id,
      label: d.label,
      check: (p) => {
        const q = f.local(p);
        if (d.type === "pad") return false;
        if (d.type === "room")
          return boxDistance(q, [0, 0, 0], d.size) < radius - 0.001;
        if (d.type === "flag") {
          const g = d.flag;
          return (
            boxDistance(
              q,
              [0, g.height * 0.64, 0],
              [g.width, g.height * 0.68, 0.035],
            ) < radius ||
            boxDistance(
              q,
              [-g.width / 2, g.height / 2, 0],
              [0.035, g.height, 0.035],
            ) < radius ||
            boxDistance(q, [-g.width / 2, 0.04, 0], [0.5, 0.08, 0.5]) < radius
          );
        }
        if (d.type === "tunnel") {
          const t = tunnel,
            h = q[1] - t.legHeight,
            rad = Math.hypot(h, q[2]);
          const cross =
            h >= 0
              ? Math.abs(rad - t.radius)
              : Math.hypot(h, Math.abs(q[2]) - t.radius);
          return (
            Math.hypot(Math.max(0, Math.abs(q[0]) - t.halfLength), cross) <
              radius + 0.023 ||
            [-1, 1].some(
              (s) =>
                boxDistance(
                  q,
                  [0, t.legHeight / 2, s * t.radius],
                  [t.halfLength * 2, t.legHeight, 0.045],
                ) < radius,
            )
          );
        }
        const g = d.gate;
        // Gate geometry is defined in its original frame, then rigidly transformed.
        const localGate = { ...g, center: [0, 0, 0] };
        let ring = ringDistance(q, localGate);
        if (g.arch && q[1] < 0)
          ring = Math.hypot(Math.abs(q[0]) - g.radius, q[1], q[2]) - 0.055;
        const postOffset = g.arch ? g.radius : g.radius + 0.12;
        const post = [-1, 1].some(
          (s) =>
            boxDistance(
              q,
              [
                g.normal[0] || g.normal[1] ? 0 : s * postOffset,
                -g.center[1] / 2,
                g.normal[0] || g.normal[1] ? s * postOffset : 0,
              ],
              [0.035, g.center[1], 0.035],
            ) < radius,
        );
        return ring < radius - 0.001 || post;
      },
    };
  });
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      steps = Math.max(1, Math.ceil(distance(a, b) / 0.06));
    for (let k = 0; k <= steps; k++) {
      const p = a.map((v, j) => v + ((b[j] - v) * k) / steps);
      for (const c of checkers) if (!hit.has(c.id) && c.check(p)) hit.add(c.id);
    }
  }
  return checkers
    .filter((c) => hit.has(c.id))
    .map((c) => `路線與 ${c.label} 的實體相交`);
}
export const gateLead = 0.6;
export function plan(radius = 0.3, layout = createDefaultLayout()) {
  const course = courseFromLayout(layout),
    gates = course.gates,
    start = course.start;
  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    gates.some((g) => radius >= g.radius - 0.05)
  )
    throw Error("安全半徑超過環的可用開口");
  const offsets = gates.map(() => [0, 0]);
  const tunnelPoints = [
    course.tunnelFrame.point([tunnel.halfLength + 0.5, 0.85, 0]),
    course.tunnelFrame.point([-tunnel.halfLength - 0.5, 0.85, 0]),
  ];
  const tail = [...slalom(radius, course), ...tunnelPoints];
  const points = () => [
    start,
    ...gates.flatMap((g, i) => {
      const c = gateCenter(g, offsets[i]);
      return [-1, 1].map((s) => add(c, g.normal, s * gateLead));
    }),
    ...tail,
  ];
  const baseline = length(points()),
    rings = gates.filter((g) => g.stage === "05");
  for (const step of [0.16, 0.06, 0.02, 0.006, 0.002])
    for (let iter = 0; iter < 70; iter++) {
      let improved = false;
      for (let i = 0; i < gates.length; i++)
        for (let axis = 0; axis < 2; axis++) {
          const old = offsets[i][axis];
          let best = length(points()),
            value = old;
          for (const sign of [-1, 1]) {
            offsets[i][axis] = old + sign * step;
            const g = gates[i],
              c = gateCenter(g, offsets[i]);
            if (
              Math.hypot(...offsets[i]) <= g.radius - radius - 0.1 &&
              c[1] >= radius + 0.08 &&
              (!g.arch || offsets[i][1] >= 0)
            ) {
              const candidate = points(),
                cost = length(candidate);
              if (cost < best - 1e-9 && clearsGroup(candidate, radius, rings)) {
                best = cost;
                value = offsets[i][axis];
                improved = true;
              }
            }
          }
          offsets[i][axis] = value;
        }
      if (!improved) break;
    }
  const outbound = points(),
    end = tunnelPoints[1];
  // Return lane follows the moved tunnel exit and start instead of stale world coordinates.
  const returnZ = Math.max(start[2], end[2]) + 0.6;
  const returnPoints = [
    end,
    [end[0], end[1], returnZ],
    [start[0], Math.max(start[1], end[1]), returnZ],
    start,
  ];
  const loop = [...outbound, ...returnPoints.slice(1)].filter(
    (p, i, a) => i === 0 || distance(p, a[i - 1]) > 1e-8,
  );
  const warnings = routeWarnings(loop, radius, course);
  return {
    outbound,
    returnPoints,
    loop,
    baseline,
    total: length(outbound),
    loopLength: length(loop),
    returnLength: length(loop) - length(outbound),
    slalom: slalom(radius, course),
    tunnelPoints,
    warnings,
    valid: warnings.length === 0,
  };
}
