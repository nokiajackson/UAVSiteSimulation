// Geometry stays fixed; saved layouts contain only each object's rigid transform.
export const gateDefinitions = [
  {
    id: "02",
    center: [-5, 1.5, 1.2],
    normal: [0, 0, -1],
    label: "垂直圓環",
    radius: 0.7,
  },
  {
    id: "03",
    center: [-5, 0.45, -1],
    normal: [0, 0, -1],
    label: "拱門",
    radius: 0.85,
    arch: true,
  },
  {
    id: "04",
    center: [-5, 1.9, -3.4],
    normal: [0, 0, -1],
    label: "垂直圓環",
    radius: 0.7,
  },
  {
    id: "05-L",
    stage: "05",
    center: [-2, 2.6, -3.4],
    normal: [0, 1, 0],
    label: "左・水平環",
    radius: 0.7,
  },
  {
    id: "05-C",
    stage: "05",
    center: [-0.8, 1.4, -3.4],
    normal: [1, 0, 0],
    label: "中・垂直環",
    radius: 0.7,
  },
  {
    id: "05-R",
    stage: "05",
    center: [0.4, 2.6, -3.4],
    normal: [0, -1, 0],
    label: "右・水平環",
    radius: 0.7,
  },
];
export const flagDefinitions = [-3.5, -1.3, 0.9].map((z, i) => ({
  id: `06-${i + 1}`,
  center: [3, 1.2, z],
  width: 0.8,
  height: 2.4,
  side: i % 2 === 0 ? -1 : 1,
}));
export const tunnelDefinition = {
  center: [3.1, 0, 3],
  rotationY: Math.PI / 2,
  halfLength: 1.2,
  radius: 0.95,
  legHeight: 0.55,
};
export const definitions = [
  { id: "01", type: "pad", label: "01 H 起飛區", position: [-5, 0, 3.5] },
  ...gateDefinitions.map((g) => ({
    id: g.id,
    type: "gate",
    label: `${g.id} ${g.label}`,
    position: g.center,
    gate: g,
  })),
  ...flagDefinitions.map((f, i) => ({
    id: f.id,
    type: "flag",
    label: `${f.id} 旗子（${f.side < 0 ? "左" : "右"}繞）`,
    position: [f.center[0], 0, f.center[2]],
    flag: f,
    index: i,
  })),
  {
    id: "07",
    type: "tunnel",
    label: "07 隧道",
    position: tunnelDefinition.center,
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "floor",
    type: "room",
    label: "地板",
    position: [0, -0.12, 0],
    size: [17, 0.24, 12],
    color: "#a5ada8",
  },
  {
    id: "wall-back",
    type: "room",
    label: "後方牆面",
    position: [0, 2.2, -6],
    size: [17, 4.4, 0.15],
    color: "#d9ddd6",
  },
  {
    id: "wall-left",
    type: "room",
    label: "左側牆面",
    position: [-8.5, 2.2, 0],
    size: [0.15, 4.4, 12],
    color: "#d0d6cf",
  },
  ...[-5, -2, 1, 4].map((x, i) => ({
    id: `window-${i + 1}`,
    type: "room",
    label: `窗戶 ${i + 1}`,
    position: [x, 2.4, -5.9],
    size: [2.2, 1.9, 0.04],
    color: "#728b90",
  })),
];
export const STORAGE_KEY = "uav-field-layout-v1";
export function createDefaultLayout() {
  return {
    version: 1,
    objects: definitions.map((d) => ({
      id: d.id,
      type: d.type,
      position: [...d.position],
      rotation: [...(d.rotation ?? [0, 0, 0])],
    })),
  };
}
export function validateLayout(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.objects) ||
    value.objects.length !== definitions.length
  )
    throw Error("配置格式不符：需要 version 1 與完整的物件清單");
  const seen = new Set();
  const objects = value.objects.map((o) => {
    const d = definitions.find((d) => d.id === o?.id);
    if (!d || seen.has(o.id) || d.type !== o.type)
      throw Error("配置含有未知、重複或類型不符的物件");
    seen.add(o.id);
    for (const key of ["position", "rotation"])
      if (
        !Array.isArray(o[key]) ||
        o[key].length !== 3 ||
        o[key].some(
          (v) =>
            typeof v !== "number" ||
            !Number.isFinite(v) ||
            Math.abs(v) > (key === "position" ? 100 : Math.PI * 20),
        )
      )
        throw Error("位置必須在 ±100 公尺內，角度須為有效數字且不超過 ±3600°");
    return {
      id: d.id,
      type: d.type,
      position: [...o.position],
      rotation: [...o.rotation],
    };
  });
  return {
    version: 1,
    objects: definitions.map((d) => objects.find((o) => o.id === d.id)),
  };
}
export function parseLayout(text) {
  if (text.length > 1000000) throw Error("配置檔案超過 1 MB");
  return validateLayout(JSON.parse(text));
}
export function serializeLayout(layout) {
  return JSON.stringify(validateLayout(layout), null, 2);
}
export function updateTransform(layout, id, position, rotation) {
  return validateLayout({
    ...layout,
    objects: layout.objects.map((o) =>
      o.id === id ? { ...o, position, rotation } : o,
    ),
  });
}
