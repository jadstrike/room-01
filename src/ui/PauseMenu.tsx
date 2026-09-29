import type { ChangeEvent } from "react";
import type { Engine, EngineState } from "../engine/Engine";
import { CROSSHAIR_PRESETS, type CrosshairSettings } from "./crosshairSettings";

type Props = {
  engine: Engine | null;
  state: EngineState;
  crosshair: CrosshairSettings;
  onCrosshair: (patch: Partial<CrosshairSettings>) => void;
};

/**
 * Shown whenever the pointer is not locked - Escape releases it, so this is
 * both the start screen and the settings menu, the way an FPS does it.
 */
export function PauseMenu({ engine, state, crosshair, onCrosshair }: Props) {
  if (!engine) return null;

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void engine.loadCharacterFiles(e.target.files);
  };
  const onPicture = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void engine.setSignPicture(file);
    e.target.value = "";
  };

  return (
    <div className="menu-backdrop">
      <div className="menu" role="dialog" aria-label="Paused">
        <header>
          <h1>ROOM 01</h1>
          <button className="primary" onClick={() => engine.requestLock()} autoFocus>
            {state.locked ? "Resume" : "Click to play"}
          </button>
        </header>

        <ul className="keys">
          <li>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> move
          </li>
          <li>
            <kbd>Shift</kbd> sprint · <kbd>Ctrl</kbd> crouch · <kbd>Space</kbd> jump
          </li>
          <li>
            <kbd>Click</kbd> fire · <kbd>R</kbd> reload · <kbd>F</kbd> inspect · <kbd>E</kbd> interact
          </li>
          <li>
            <kbd>1</kbd> pistol · <kbd>2</kbd> put away · <kbd>Q</kbd> / scroll swap
          </li>
          <li>
            <kbd>Esc</kbd> pause · <kbd>`</kbd> colliders
          </li>
        </ul>

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
            <Toggle label="Bulb flicker" on={state.flicker} onChange={(v) => engine.setFlicker(v)} />
            <Toggle label="AO + grain" on={state.quality} onChange={(v) => engine.setQuality(v)} />
            <Toggle label="Sound" on={state.sound} onChange={() => engine.toggleSound()} />
            <Toggle
              label="Keep player in the room"
              on={state.confineToRoom}
              onChange={(v) => engine.setConfineToRoom(v)}
            />
            <Toggle label="Show colliders" on={state.debug} onChange={(v) => engine.setDebug(v)} />
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
            {state.sign.available && (
              <>
                <h2>Sign</h2>
                <label className="file">
                  {state.sign.custom ? "Change picture" : "Choose a picture"}
                  <input type="file" accept="image/*" onChange={onPicture} />
                </label>
                {state.sign.custom && (
                  <button className="quiet" onClick={() => engine.resetSignPicture()}>
                    Put the old face back
                  </button>
                )}
                <p className="hint">
                  Shown on the figure's sign, whole and uncropped. Or drop a picture anywhere on the page. It stays on
                  this device only.
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

        <p className="credits">
          Pistol:{" "}
          <a href="https://sketchfab.com/3d-models/beretta-pistol-fps-animation-0313ab1888994c14abeaf444d7af3217" target="_blank" rel="noreferrer">
            “Beretta Pistol FPS ANIMATION”
          </a>{" "}
          by BURNER,{" "}
          <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
        </p>
      </div>
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
