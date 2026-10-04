import type { ChangeEvent } from "react";
import type { Engine, EngineState } from "../engine/Engine";
import { CROSSHAIR_PRESETS, type CrosshairSettings } from "./crosshairSettings";
import { FRAME_CAPS, type FrameCap } from "../engine/Pacer";

type Props = {
  engine: Engine;
  state: EngineState;
  crosshair: CrosshairSettings;
  onCrosshair: (patch: Partial<CrosshairSettings>) => void;
};

/** Look, room, performance, crosshair and the figures' signs: shared by the pause menu and the title screen. */
export function Settings({ engine, state, crosshair, onCrosshair }: Props) {
  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void engine.loadCharacterFiles(e.target.files);
  };
  const onPicture = (id: string) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void engine.setSignPicture(id, file);
    e.target.value = "";
  };

  return (
    <div className="cols">
      <section>
        <h2>Look</h2>
        <Slider
          label="Sensitivity"
          value={state.sensitivity}
          min={0.4}
          max={6}
          step={0.1}
          onChange={(v) => engine.setSensitivity(v)}
        />
        <Slider
          label="Field of view"
          value={state.fov}
          min={60}
          max={105}
          step={1}
          suffix="°"
          onChange={(v) => engine.setFov(v)}
        />
        <Toggle label="Head bob" on={state.headBob} onChange={(v) => engine.setHeadBob(v)} />

        <h2>Room</h2>
        <Slider
          label="Brightness"
          value={state.exposure}
          min={0.5}
          max={2.5}
          step={0.05}
          onChange={(v) => engine.setExposure(v)}
        />
        <Toggle label="Light flicker" on={state.flicker} onChange={(v) => engine.setFlicker(v)} />
        <Toggle label="Sound" on={state.sound} onChange={() => engine.toggleSound()} />
        <Toggle
          label="Keep player in the room"
          on={state.confineToRoom}
          onChange={(v) => engine.setConfineToRoom(v)}
        />
        <Toggle label="Show colliders" on={state.debug} onChange={(v) => engine.setDebug(v)} />

        <h2>Performance</h2>
        <label className="field">
          <span>Frame cap</span>
          <select value={state.frameCap} onChange={(e) => engine.setFrameCap(Number(e.target.value) as FrameCap)}>
            {FRAME_CAPS.map((cap) => (
              <option key={cap} value={cap}>
                {cap ? `${cap} fps` : "Display rate"}
              </option>
            ))}
          </select>
        </label>
        <Toggle label="Auto resolution" on={state.autoResolution} onChange={(v) => engine.setAutoResolution(v)} />
        <Toggle label="AO + grain" on={state.quality} onChange={(v) => engine.setQuality(v)} />
        <p className="hint">
          A lower cap runs cooler. Menus and conversations already draw fewer frames, and nothing renders while the tab
          is hidden.
        </p>
      </section>

      <section>
        <h2>Crosshair</h2>
        <div className="presets">
          {CROSSHAIR_PRESETS.map((p) => (
            <button key={p.name} onClick={() => onCrosshair(p.settings)}>
              {p.name}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Style</span>
          <select
            value={crosshair.style}
            onChange={(e) => onCrosshair({ style: e.target.value as CrosshairSettings["style"] })}
          >
            <option value="cross">Cross</option>
            <option value="cross-dot">Cross + dot</option>
            <option value="dot">Dot</option>
            <option value="circle">Circle</option>
          </select>
        </label>
        <Slider
          label="Length"
          value={crosshair.length}
          min={0}
          max={24}
          step={1}
          onChange={(v) => onCrosshair({ length: v })}
        />
        <Slider
          label="Thickness"
          value={crosshair.thickness}
          min={1}
          max={6}
          step={1}
          onChange={(v) => onCrosshair({ thickness: v })}
        />
        <Slider
          label="Gap"
          value={crosshair.gap}
          min={0}
          max={20}
          step={1}
          onChange={(v) => onCrosshair({ gap: v })}
        />
        <Slider
          label="Outline"
          value={crosshair.outline}
          min={0}
          max={3}
          step={1}
          onChange={(v) => onCrosshair({ outline: v })}
        />
        <Slider
          label="Opacity"
          value={crosshair.alpha}
          min={0.2}
          max={1}
          step={0.05}
          onChange={(v) => onCrosshair({ alpha: v })}
        />
        <Toggle label="Dynamic spread" on={crosshair.dynamic} onChange={(v) => onCrosshair({ dynamic: v })} />
        <Toggle label="T-style" on={crosshair.tStyle} onChange={(v) => onCrosshair({ tStyle: v })} />
        <div className="row">
          <label className="field colour">
            <span>Colour</span>
            <input
              type="color"
              value={crosshair.color}
              onChange={(e) => onCrosshair({ color: e.target.value })}
            />
          </label>
          <label className="field colour">
            <span>On target</span>
            <input
              type="color"
              value={crosshair.focusColor}
              onChange={(e) => onCrosshair({ focusColor: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section>
        {state.signs.length > 0 && (
          <>
            <h2>Signs</h2>
            {state.signs.map((sign) => (
              <div className="sign-row" key={sign.id}>
                <label className="file">
                  {sign.custom ? `Change ${sign.label.toLowerCase()}` : `Picture for ${sign.label.toLowerCase()}`}
                  <input type="file" accept="image/*" onChange={onPicture(sign.id)} />
                </label>
                {sign.custom && (
                  <button className="quiet" onClick={() => engine.resetSignPicture(sign.id)}>
                    Old face back
                  </button>
                )}
              </div>
            ))}
            <p className="hint">
              Shown on each figure's sign, whole and uncropped. A picture dropped on the page goes on whoever you were
              looking at. It stays on this device only.
            </p>
          </>
        )}

        <h2>Character</h2>
        <label className="file">
          Load .glb / .gltf
          <input
            type="file"
            accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2"
            multiple
            onChange={onFiles}
          />
        </label>
        <label className="field">
          <span>Animation</span>
          <select
            value={state.clipIndex}
            onChange={(e) => engine.selectClip(Number(e.target.value))}
            disabled={!state.clips.length}
          >
            {state.clips.length ? (
              state.clips.map((name, i) => (
                <option key={name + i} value={i}>
                  {name}
                </option>
              ))
            ) : (
              <option value={-1}>No animation</option>
            )}
          </select>
        </label>
        <Toggle label="Auto-scale to 1.75 m" on={state.autoScale} onChange={(v) => engine.setAutoScale(v)} />
        <p className="hint">
          Drop a .glb anywhere on the page to replace the figure. A .gltf needs its .bin and textures selected
          together.
        </p>
      </section>
    </div>

  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field slider">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <b>
        {value}
        {suffix}
      </b>
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="toggle" aria-pressed={on} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <i />
    </button>
  );
}
