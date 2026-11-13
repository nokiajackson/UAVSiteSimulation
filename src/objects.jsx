import React, { useRef, useLayoutEffect, useMemo, useEffect } from "react";
import { Html, TransformControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { BoxHelper } from "three";
import { definitions, tunnelDefinition as tunnel } from "./layout";
export function Box({ position, scale, color = "#b4b6ad", ...props }) {
  return (
    <mesh position={position} receiveShadow castShadow {...props}>
      <boxGeometry args={scale} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}
function Tag({ position, children }) {
  return (
    <Html position={position} center distanceFactor={13}>
      <span className="gate-tag">{children}</span>
    </Html>
  );
}
function Gate({ g }) {
  const horizontal = !!g.normal[1],
    supportZ = horizontal || g.normal[0];
  return (
    <>
      <mesh
        rotation={
          horizontal
            ? [Math.PI / 2, 0, 0]
            : g.normal[0]
              ? [0, Math.PI / 2, 0]
              : [0, 0, 0]
        }
        castShadow
      >
        <torusGeometry
          args={[g.radius, 0.055, 16, 72, g.arch ? Math.PI : Math.PI * 2]}
        />
        <meshStandardMaterial
          color={g.arch ? "#e0ac58" : "#28b6db"}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      {[-1, 1].map((s) => (
        <Box
          key={s}
          position={[
            supportZ ? 0 : s * (g.arch ? g.radius : g.radius + 0.12),
            -g.center[1] / 2,
            supportZ ? s * (g.radius + 0.12) : 0,
          ]}
          scale={[0.035, g.center[1], 0.035]}
          color="#3b4548"
        />
      ))}
      <Tag position={[0, g.radius + 0.35, 0]}>
        {g.id} <b>{g.label}</b>
      </Tag>
    </>
  );
}
function Flag({ f, index }) {
  return (
    <>
      <Box
        position={[-f.width / 2, f.height / 2, 0]}
        scale={[0.035, f.height, 0.035]}
        color="#394e49"
      />
      <Box
        position={[0, f.height * 0.64, 0]}
        scale={[f.width, f.height * 0.68, 0.035]}
        color={index % 2 ? "#efc264" : "#249fba"}
      />
      <Box
        position={[-f.width / 2, 0.04, 0]}
        scale={[0.5, 0.08, 0.5]}
        color="#455953"
      />
      <Tag position={[0, f.height + 0.25, 0]}>
        {f.id} <b>{f.side < 0 ? "左繞" : "右繞"}</b>
      </Tag>
    </>
  );
}
function Tunnel() {
  const { radius: r, legHeight: h, halfLength: l } = tunnel;
  return (
    <>
      {[-1, 1].map((s) => (
        <Box
          key={s}
          position={[0, h / 2, s * r]}
          scale={[l * 2, h, 0.045]}
          color="#339eb2"
        />
      ))}
      {Array.from({ length: 24 }, (_, i) => {
        const a = ((i + 0.5) * Math.PI) / 24;
        return (
          <Box
            key={i}
            position={[0, h + r * Math.sin(a), r * Math.cos(a)]}
            rotation={[-a - Math.PI / 2, 0, 0]}
            scale={[l * 2, 0.045, (r * Math.PI) / 24 + 0.012]}
            color={i % 4 === 0 ? "#d1e8de" : "#339eb2"}
          />
        );
      })}
      <Tag position={[0, h + r + 0.35, 0]}>
        07 <b>隧道</b>
      </Tag>
    </>
  );
}
function Pad() {
  return (
    <>
      <mesh position={[0, 0.035, 0]} receiveShadow>
        <cylinderGeometry args={[0.7, 0.7, 0.02, 64]} />
        <meshStandardMaterial color="#168cb5" />
      </mesh>
      <Html position={[0, 0.1, 0]} center distanceFactor={12}>
        <strong className="pad">H</strong>
      </Html>
      <Tag position={[0, 0.1, 1]}>01 起點 / 循環返回</Tag>
    </>
  );
}
function EditableObject({
  object,
  selected,
  onTarget,
  onSelect,
  editing,
  visible,
}) {
  const ref = useRef(),
    d = definitions.find((d) => d.id === object.id);
  useLayoutEffect(() => {
    if (selected) onTarget(ref.current);
  }, [selected, onTarget]);
  return (
    <group
      ref={ref}
      position={object.position}
      rotation={object.rotation}
      visible={visible}
      userData={{ layoutId: object.id }}
      onClick={(e) => {
        if (editing && e.delta < 5) {
          e.stopPropagation();
          onSelect(object.id);
        }
      }}
    >
      {d.type === "gate" ? (
        <Gate g={d.gate} />
      ) : d.type === "flag" ? (
        <Flag f={d.flag} index={d.index} />
      ) : d.type === "tunnel" ? (
        <Tunnel />
      ) : d.type === "pad" ? (
        <Pad />
      ) : (
        <>
          <Box scale={d.size} color={d.color} />
          {d.id.startsWith("window") && (
            <Box
              position={[0, 0, 0.05]}
              scale={[0.04, 1.9, 0.04]}
              color="#d1d8d3"
            />
          )}
        </>
      )}
    </group>
  );
}
function Outline({ target }) {
  const helper = useMemo(() => new BoxHelper(target, "#f3a32d"), [target]);
  useFrame(() => helper.update());
  useEffect(() => () => helper.dispose(), [helper]);
  return <primitive object={helper} />;
}
export function CourseObjects({
  layout,
  selected,
  onSelect,
  editing,
  showRoom,
  tool,
  snap,
  onTransform,
  onDragging,
}) {
  const [target, setTarget] = React.useState(null);
  const targetMatches = target?.userData.layoutId === selected;
  return (
    <>
      {layout.objects.map((object) => (
        <EditableObject
          key={object.id}
          {...{ object, onSelect, editing }}
          selected={editing && selected === object.id}
          onTarget={setTarget}
          visible={object.type !== "room" || object.id === "floor" || showRoom}
        />
      ))}
      {editing && targetMatches && (
        <>
          <Outline target={target} />
          <TransformControls
            object={target}
            mode={tool}
            space="world"
            translationSnap={snap ? 0.1 : null}
            rotationSnap={snap ? Math.PI / 12 : null}
            onMouseDown={() => onDragging(true)}
            onMouseUp={() => {
              const accepted = onTransform(
                selected,
                target.position.toArray(),
                target.rotation.toArray().slice(0, 3),
              );
              if (!accepted) {
                const saved = layout.objects.find((o) => o.id === selected);
                target.position.fromArray(saved.position);
                target.rotation.set(...saved.rotation);
              }
              onDragging(false);
            }}
          />
        </>
      )}
    </>
  );
}
