import React, { useRef, useState, useMemo, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, ContactShadows } from "@react-three/drei";
import { Vector3 } from "three";
import {
  Play,
  Pause,
  RotateCcw,
  Layers,
  Navigation,
  Move3D,
  ArrowUpRight,
  Settings2,
  Maximize,
} from "lucide-react";
import { gates, plan, distance, length } from "./planner";
import { CourseObjects, Box } from "./objects";
import Editor from "./Editor";
import {
  createDefaultLayout,
  parseLayout,
  serializeLayout,
  updateTransform,
  STORAGE_KEY,
} from "./layout";
import "./style.css";
function Drone({ route, running, speed, reset, onProgress }) {
  const ref = useRef(),
    travel = useRef(0),
    report = useRef(0);
  const prev = useRef(reset);
  const lengths = useMemo(
    () => route.slice(1).map((p, i) => distance(route[i], p)),
    [route],
  );
  const total = length(route);
  useFrame((_, dt) => {
    if (prev.current !== reset) {
      travel.current = 0;
      prev.current = reset;
    }
    if (running)
      travel.current = (travel.current + Math.min(dt, 0.1) * speed) % total;
    let d = travel.current,
      i = 0;
    while (i < lengths.length - 1 && d > lengths[i]) {
      d -= lengths[i++];
    }
    const a = new Vector3(...route[i]),
      b = new Vector3(...route[i + 1]);
    ref.current.position.copy(a.lerp(b, d / lengths[i]));
    const dir = new Vector3(...route[i + 1]).sub(new Vector3(...route[i]));
    ref.current.rotation.y = Math.atan2(dir.x, dir.z);
    if ((report.current += dt) > 0.15) {
      onProgress(travel.current / total);
      report.current = 0;
    }
  });
  return (
    <group ref={ref} scale={0.7}>
      <Box scale={[0.25, 0.08, 0.32]} color="#f4ba53" />
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group key={`${x}${z}`} position={[x * 0.19, 0, z * 0.19]}>
            <Box scale={[0.25, 0.025, 0.025]} color="#202b32" />
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.095, 0.115, 24]} />
              <meshStandardMaterial color="#25343b" side={2} />
            </mesh>
          </group>
        )),
      )}
      <pointLight color="#a8f3d4" intensity={0.6} distance={1} />
    </group>
  );
}
function Camera({ view, controls }) {
  const { camera } = useThree();
  React.useEffect(() => {
    const positions = {
      perspective: [1, 15, 18],
      top: [0, 22, 0.01],
      front: [0, 5, 20],
    };
    camera.position.set(...positions[view.mode]);
    controls.current?.target.set(0, 1, 0);
    controls.current?.update();
  }, [view]);
  return null;
}
function Scene({
  view,
  route,
  showPath,
  showRoom,
  running,
  speed,
  reset,
  onProgress,
  layout,
  selected,
  onSelect,
  editing,
  tool,
  snap,
  onTransform,
  onDragging,
  dragging,
}) {
  const controls = useRef();
  return (
    <>
      <color attach="background" args={["#e7ebe7"]} />
      <fog attach="fog" args={["#e7ebe7", 24, 55]} />
      <ambientLight intensity={1.3} />
      <directionalLight
        position={[2, 12, 5]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <gridHelper
        args={[17, 34, "#82928b", "#96a29a"]}
        position={[0, 0.012, 0]}
      />
      <CourseObjects
        {...{
          layout,
          selected,
          onSelect,
          editing,
          showRoom,
          tool,
          snap,
          onTransform,
          onDragging,
        }}
      />
      {showPath && !dragging && (
        <>
          <Line points={route.outbound} color="#008b75" lineWidth={3} />
          <Line
            points={route.returnPoints}
            color="#86958f"
            lineWidth={1.5}
            dashed
            dashSize={0.16}
            gapSize={0.12}
          />
        </>
      )}
      <Drone
        route={route.loop}
        running={running && route.valid && !dragging}
        speed={speed}
        reset={reset}
        onProgress={onProgress}
      />
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.3}
        scale={24}
        blur={2}
        far={5}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        minDistance={3}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2 - 0.02}
        target={[0, 1, 0]}
      />
      <Camera view={view} controls={controls} />
    </>
  );
}
function readInitial() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return {
      layout: text ? parseLayout(text) : createDefaultLayout(),
      message: text
        ? "已載入上次儲存的配置"
        : "選取物件開始編輯；配置尚未存入瀏覽器",
    };
  } catch (e) {
    return {
      layout: createDefaultLayout(),
      message: `無法載入本機配置：${e.message}。目前使用預設場地，舊資料尚未覆寫。`,
    };
  }
}
function App() {
  const [initial] = useState(readInitial),
    [layout, setLayout] = useState(initial.layout),
    [saved, setSaved] = useState(() => serializeLayout(initial.layout)),
    [message, setMessage] = useState(initial.message);
  const [editing, setEditing] = useState(true),
    [selected, setSelected] = useState("01"),
    [tool, setTool] = useState("translate"),
    [snap, setSnap] = useState(true),
    [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1.2),
    [radius, setRadius] = useState(0.3),
    [showPath, setShowPath] = useState(true),
    [showRoom, setShowRoom] = useState(true),
    [view, setView] = useState({ mode: "perspective" }),
    [reset, setReset] = useState(0),
    [progress, setProgress] = useState(0);
  const route = useMemo(() => plan(radius, layout), [radius, layout]);
  const dirty = serializeLayout(layout) !== saved;
  const pause = () => {
    setRunning(false);
    setReset((x) => x + 1);
  };
  const onSelect = (id) => {
    setSelected(id);
    if (layout.objects.find((o) => o.id === id)?.type === "room")
      setShowRoom(true);
  };
  const onTransform = (id, position, rotation) => {
    try {
      const next = updateTransform(layout, id, position, rotation);
      setLayout(next);
      pause();
      setMessage("配置已變更，按 Save 儲存。");
      return true;
    } catch (e) {
      setMessage(e.message);
      return false;
    }
  };
  const onDragging = (value) => {
    setDragging(value);
    if (value) setRunning(false);
  };
  const onSave = () => {
    try {
      const text = serializeLayout(layout);
      localStorage.setItem(STORAGE_KEY, text);
      setSaved(text);
      setMessage("已儲存在此瀏覽器。下次開啟會自動載入。");
    } catch (e) {
      setMessage(`儲存失敗：${e.message}。請改用匯出 JSON。`);
    }
  };
  const onReload = () => {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (!text) {
        setMessage("此瀏覽器尚未有儲存配置，請先按 Save。");
        return;
      }
      const next = parseLayout(text);
      if (dirty && !confirm("捨棄尚未儲存的修改，載入上次儲存配置？")) return;
      setLayout(next);
      setSaved(serializeLayout(next));
      pause();
      setMessage("已重新載入上次儲存的配置。");
    } catch (e) {
      setMessage(`載入失敗：${e.message}，目前配置維持不變。`);
    }
  };
  const onExport = () => {
    const url = URL.createObjectURL(
        new Blob([serializeLayout(layout)], { type: "application/json" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "uav-layout.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("已匯出目前配置，可在其他電腦匯入。");
  };
  const onImport = async (file) => {
    try {
      if (file.size > 1000000) throw Error("檔案超過 1 MB");
      const next = parseLayout(await file.text());
      if (dirty && !confirm("以匯入配置取代尚未儲存的修改？")) return;
      setLayout(next);
      pause();
      setMessage("匯入成功，按 Save 可存入此瀏覽器。");
    } catch (e) {
      setMessage(`匯入失敗：${e.message}，目前配置維持不變。`);
    }
  };
  const onDefaults = () => {
    if (
      !confirm(
        "恢復預設場地？目前未儲存修改將被取代，已存配置不會覆寫，直到再次按 Save。",
      )
    )
      return;
    setLayout(createDefaultLayout());
    pause();
    setMessage("已恢復預設，按 Save 才會覆寫本機儲存。");
  };
  React.useEffect(() => {
    const handler = (e) => {
      if (
        e.target.isContentEditable ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (e.key.toLowerCase() === "w") setTool("translate");
      if (e.key.toLowerCase() === "e") setTool("rotate");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  React.useEffect(() => {
    const handler = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const changeView = (mode) => setView({ mode });
  return (
    <div className="app">
      <header>
        <a className="brand" href="./">
          <span className="brand-icon">
            <Navigation size={21} />
          </span>
          FIELD
          <span className="brand-divider" /> <small>UAV SIMULATION</small>
        </a>
        <div className="header-right">
          <span className="status-dot" />
          3D 場地工作室 <span className="version">LAYOUT EDITOR</span>
        </div>
      </header>
      <aside>
        <div className="eyebrow">WORKSPACE / 01</div>
        <h1>
          室內飛行場地<span>Indoor flight environment</span>
        </h1>
        <div className="project-note">
          <span className="status-dot" />
          場地示意模型 · 公尺制
        </div>
        {editing ? (
          <Editor
            {...{
              layout,
              selected,
              onSelect,
              onTransform,
              tool,
              setTool,
              snap,
              setSnap,
              dirty,
              onSave,
              onReload,
              onExport,
              onImport,
              onDefaults,
              message,
            }}
          />
        ) : (
          <section>
            <div className="section-heading">
              <h2>賽道配置</h2>
              <Layers size={16} />
            </div>
            <div className="course">
              <div className="course-row">
                <i className="start-dot" />
                <div>
                  H 起飛區<small>START POINT</small>
                </div>
                <span>01</span>
              </div>
              {gates
                .filter((g) => !g.stage)
                .map((g) => (
                  <div className="course-row" key={g.id}>
                    <i className={g.normal[1] ? "ring horizontal" : "ring"} />
                    <div>
                      {g.label}
                      <small>
                        {g.arch
                          ? "ARCH"
                          : g.normal[1]
                            ? "HORIZONTAL"
                            : "VERTICAL"}{" "}
                        GATE
                      </small>
                    </div>
                    <span>{g.id}</span>
                  </div>
                ))}
              <div className="course-row">
                <i className="ring horizontal" />
                <div>
                  三環組：水平・垂直・水平<small>LEFT → CENTER → RIGHT</small>
                </div>
                <span>05</span>
              </div>
              <div className="course-row">
                <i className="ring" />
                <div>
                  三旗 S 型繞行<small>SLALOM · 左 → 右 → 左</small>
                </div>
                <span>06</span>
              </div>
              <div className="course-row">
                <i className="ring" />
                <div>
                  隧道 → 返回 01<small>TUNNEL / RETURN TO START</small>
                </div>
                <span>07</span>
              </div>
            </div>
          </section>
        )}
        <section>
          <div className="section-heading">
            <h2>路徑規劃</h2>
            <Settings2 size={16} />
          </div>
          <div className="metric">
            <span>01 → 07 路線長度</span>
            <strong>
              {route.total.toFixed(2)} <small>m</small>
            </strong>
          </div>
          <div className="comparison">
            較中心穿越基準縮短{" "}
            <b>{((1 - route.total / route.baseline) * 100).toFixed(1)}%</b>
          </div>
          <label className="slider-label">
            安全半徑 <b>{radius.toFixed(2)} m</b>
            <input
              aria-label="安全半徑"
              type="range"
              min=".30"
              max=".35"
              step=".01"
              value={radius}
              onChange={(e) => {
                setRunning(false);
                setRadius(+e.target.value);
                setReset((x) => x + 1);
              }}
            />
          </label>
          <p className="hint">
            依序通過 02～04、05 左中右三環、三旗 S 型繞行與 07 隧道，再返回
            01。旗子預設左 → 右 → 左繞行。
          </p>
        </section>
        <div className="sidebar-bottom">
          <span>模型說明</span>
          <p>
            依照片概念重建，未加入鏡中反射。尺寸與位置為估計值，路線為幾何近似，未包含完整碰撞與飛行動力學。
          </p>
        </div>
      </aside>
      <main>
        <div className="viewport-header">
          <div>
            <span className="eyebrow">LIVE VIEWPORT</span>
            <h2>
              場地全覽 <span>/ 3D</span>
            </h2>
          </div>
          <button
            className={editing ? "editor-toggle active" : "editor-toggle"}
            onClick={() => {
              setEditing(!editing);
              setDragging(false);
            }}
          >
            {" "}
            {editing ? "結束編輯" : "編輯場地"}
          </button>
        </div>
        <div className="canvas-wrap">
          <Suspense fallback={<div className="loading">正在建立場景…</div>}>
            <Canvas
              shadows
              camera={{ position: [1, 15, 18], fov: 45 }}
              gl={{ antialias: true }}
            >
              <Scene
                {...{
                  view,
                  route,
                  showPath,
                  showRoom,
                  running,
                  speed,
                  reset,
                  onProgress: setProgress,
                  layout,
                  selected,
                  onSelect,
                  editing,
                  tool,
                  snap,
                  onTransform,
                  onDragging,
                  dragging,
                }}
              />
            </Canvas>
          </Suspense>
          {(route.warnings.length > 0 || dragging) && (
            <div className="route-warning" role="alert">
              {dragging ? (
                "正在編輯，放開後重算路線"
              ) : (
                <>
                  配置有路線衝突，已暫停模擬
                  <ul>
                    {route.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <div className="view-tabs">
            {[
              ["perspective", "透視"],
              ["top", "俯視"],
              ["front", "正視"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                className={view.mode === mode ? "active" : ""}
                onClick={() => changeView(mode)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="view-tools">
            <button title="重設視角" onClick={() => changeView("perspective")}>
              <Maximize size={18} />
            </button>
            <button
              title="顯示路線"
              className={showPath ? "selected" : ""}
              onClick={() => setShowPath(!showPath)}
            >
              <Navigation size={18} />
            </button>
            <button
              title="顯示牆面"
              className={showRoom ? "selected" : ""}
              onClick={() => setShowRoom(!showRoom)}
            >
              <Layers size={18} />
            </button>
          </div>
          <div className="scene-legend">
            <span>
              <i />
              01 → 07
            </span>
            <span>
              <i className="return" />
              循環返航
            </span>
            <span>
              <i className="gate" />
              賽道障礙
            </span>
          </div>
          <div className="axis">
            <b>Y</b>
            <span>Z └ X</span>
          </div>
        </div>
        <div className="playback">
          <button
            className="play"
            disabled={!route.valid || dragging}
            onClick={() => setRunning(!running)}
          >
            {running ? <Pause size={17} /> : <Play size={17} />}{" "}
            {running ? "暫停模擬" : "開始模擬"}
          </button>
          <button
            className="reset"
            title="重設飛行"
            onClick={() => {
              setReset((x) => x + 1);
              setRunning(false);
            }}
          >
            <RotateCcw size={17} />
          </button>
          <div className="timeline">
            <div className="timeline-label">
              <span>{running ? "循環飛行中" : "飛行預覽"}</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="track">
              <div style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
          <label className="speed">
            速度
            <select
              aria-label="飛行速度"
              value={speed}
              onChange={(e) => setSpeed(+e.target.value)}
            >
              <option value={0.6}>0.6 m/s</option>
              <option value={1.2}>1.2 m/s</option>
              <option value={2.4}>2.4 m/s</option>
            </select>
          </label>
        </div>
        <footer>
          <span>
            <Move3D size={14} />
            {editing
              ? "選取物件編輯 · 拖曳控制軸；空白處拖曳轉視角"
              : "拖曳旋轉"}{" "}
            <em>·</em> 滾輪縮放 <em>·</em> 右鍵平移
          </span>
          <span>
            R3F / THREE.JS <ArrowUpRight size={13} />
          </span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
