import React, { useRef } from "react";
import { definitions } from "./layout";
export default function Editor({
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
}) {
  const object = layout.objects.find((o) => o.id === selected),
    file = useRef();
  function change(key, axis, text) {
    const value = Number(text);
    if (text.trim() === "" || !Number.isFinite(value)) return;
    const next = [...object[key]];
    next[axis] = key === "rotation" ? (value * Math.PI) / 180 : value;
    return onTransform(
      object.id,
      key === "position" ? next : object.position,
      key === "rotation" ? next : object.rotation,
    );
  }
  return (
    <section className="editor-panel">
      <div className="section-heading">
        <h2>物件編輯</h2>
        <span className={dirty ? "dirty" : "saved"}>
          {dirty ? "尚未儲存" : "已儲存／初始配置"}
        </span>
      </div>
      <label className="object-picker">
        選擇物件
        <select
          aria-label="選擇物件"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
        >
          {["賽道物件", "場地環境"].map((name, i) => (
            <optgroup key={name} label={name}>
              {definitions
                .filter((d) => (i ? d.type === "room" : d.type !== "room"))
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="edit-modes">
        <button
          className={tool === "translate" ? "active" : ""}
          onClick={() => setTool("translate")}
        >
          移動 W
        </button>
        <button
          className={tool === "rotate" ? "active" : ""}
          onClick={() => setTool("rotate")}
        >
          旋轉 E
        </button>
      </div>
      <p className="editor-help">
        點選物件，拖曳軸線移動或圓弧旋轉。位置單位 m、角度單位 °；數字輸入後按
        Enter 或移開焦點套用。
      </p>
      {["position", "rotation"].map((key) => (
        <fieldset className="transform-fields" key={key}>
          <legend>
            {key === "position" ? "位置 / 公尺" : "旋轉 / 角度（XYZ Euler）"}
          </legend>
          {["X", "Y", "Z"].map((axis, i) => {
            const value = +(
              object[key][i] * (key === "rotation" ? 180 / Math.PI : 1)
            ).toFixed(3);
            return (
              <label key={axis}>
                <span className={"axis-" + axis}>{axis}</span>
                <input
                  key={`${object.id}-${key}-${i}-${value}`}
                  aria-label={`${key === "position" ? "位置" : "旋轉"} ${axis}`}
                  type="number"
                  step={key === "position" ? ".1" : "5"}
                  min={key === "position" ? "-100" : "-3600"}
                  max={key === "position" ? "100" : "3600"}
                  defaultValue={value}
                  onBlur={(e) => {
                    if (!change(key, i, e.target.value))
                      e.currentTarget.value = String(value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
              </label>
            );
          })}
        </fieldset>
      ))}
      <label className="snap-toggle">
        <input
          type="checkbox"
          checked={snap}
          onChange={(e) => setSnap(e.target.checked)}
        />
        吸附：移動 0.1 m／旋轉 15°
      </label>
      <div className="save-actions">
        <button className="primary" onClick={onSave}>
          Save 儲存
        </button>
        <button onClick={onReload}>Reload 載入</button>
        <button onClick={onExport}>匯出 JSON</button>
        <button onClick={() => file.current.click()}>匯入 JSON</button>
        <button className="defaults" onClick={onDefaults}>
          恢復預設配置
        </button>
      </div>
      <input
        ref={file}
        aria-label="匯入配置檔案"
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await onImport(f);
          e.target.value = "";
        }}
      />
      <p className="save-note">
        Save 存在目前瀏覽器；下次開啟自動載入。換電腦或網址時，請使用 JSON
        匯出／匯入。
      </p>
      <p role="status" className="editor-message">
        {message}
      </p>
    </section>
  );
}
