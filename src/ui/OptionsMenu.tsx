import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import type { Engine, EngineState } from "../engine/Engine";
import { FRAME_CAPS, type FrameCap } from "../engine/Pacer";
import { CROSSHAIR_PRESETS, type CrosshairSettings } from "./crosshairSettings";
import { Crosshair } from "./Crosshair";

type Category = "camera" | "display" | "audio" | "crosshair" | "extras";

const CATEGORIES: ReadonlyArray<{ id: Category; label: string; help: string }> = [
  { id: "camera", label: "Camera", help: "How the view moves." },
  { id: "display", label: "Display", help: "Brightness, the bulb, and how hard the game works your graphics card." },
  { id: "audio", label: "Audio", help: "Sound." },
  { id: "crosshair", label: "Crosshair", help: "The aiming mark in the middle of the screen. Changes show in the preview." },
  { id: "extras", label: "Extras", help: "Put your own pictures on the accused, swap in your own character, and debugging tools." },
];

const ON_OFF = [
  { value: true, label: "On" },
  { value: false, label: "Off" },
];

const STYLES: ReadonlyArray<{ value: CrosshairSettings["style"]; label: string }> = [
  { value: "cross-dot", label: "Cross and dot" },
  { value: "cross", label: "Cross" },
  { value: "dot", label: "Dot" },
  { value: "circle", label: "Circle" },
];

const COLOURS = ["#5ef2c0", "#f1e9dc", "#ff4d4d", "#9fb4d8", "#ffd84a"];

type Props = {
  engine: Engine;
  state: EngineState;
  crosshair: CrosshairSettings;
  onCrosshair: (patch: Partial<CrosshairSettings>) => void;
  onBack: () => void;
};

/**
 * Options the way a console horror game lays them out: categories down the
 * left, one setting per row with its value on the right, and a line at the
 * bottom explaining whichever row the pointer or focus is on. Q and E switch
 * category, Esc goes back.
 */
export function OptionsMenu({ engine, state, crosshair, onCrosshair, onBack }: Props) {
  const [category, setCategory] = useState<Category>("camera");
  const [help, setHelp] = useState("");
  const info = CATEGORIES.find((c) => c.id === category)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onBack();
      const step = e.code === "KeyE" ? 1 : e.code === "KeyQ" ? -1 : 0;
      if (!step || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const i = CATEGORIES.findIndex((c) => c.id === category);
      setCategory(CATEGORIES[(i + step + CATEGORIES.length) % CATEGORIES.length].id);
      setHelp("");
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [category, onBack]);

  const row = (label: string, text: string, control: ReactNode) => (
    <div className="option-row" key={label} onMouseEnter={() => setHelp(text)} onFocusCapture={() => setHelp(text)}>
      <span className="option-label">{label}</span>
      <div className="option-control">{control}</div>
    </div>
  );

  const preset = CROSSHAIR_PRESETS.findIndex((p) => (Object.keys(p.settings) as (keyof CrosshairSettings)[]).every((k) => p.settings[k] === crosshair[k]));
  const onPicture = (id: string) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void engine.setSignPicture(id, file);
    e.target.value = "";
  };

  let rows: ReactNode;
  if (category === "camera") {
    rows = [
      row("Mouse sensitivity", "How far the view turns for each movement of the mouse.", <Bar value={state.sensitivity} min={0.4} max={6} step={0.1} onChange={(v) => engine.setSensitivity(v)} />),
      row("Field of view", "Wider shows more of the room; narrower feels closer and more claustrophobic.", <Bar value={state.fov} min={60} max={105} step={1} format={(v) => `${v}°`} onChange={(v) => engine.setFov(v)} />),
      row("Head bob", "The camera's sway as Rowan walks. Off if it makes you queasy.", <Choice value={state.headBob} options={ON_OFF} onChange={(v) => engine.setHeadBob(v)} />),
    ];
  } else if (category === "display") {
    rows = [
      row("Brightness", "If you cannot make out the evidence, raise this. The game is meant to be dark, not unreadable.", <Bar value={state.exposure} min={0.5} max={2.5} step={0.05} onChange={(v) => engine.setExposure(v)} />),
      row("Light flicker", "The failing bulb and the dips in the lights. Off is easier on the eyes.", <Choice value={state.flicker} options={ON_OFF} onChange={(v) => engine.setFlicker(v)} />),
      row("Effects quality", "High adds ambient occlusion and film grain. Low is the biggest saving on a slow machine.", <Choice value={state.quality} options={[{ value: true, label: "High" }, { value: false, label: "Low" }]} onChange={(v) => engine.setQuality(v)} />),
      row("Frame rate limit", "A lower limit runs cooler and quieter. Menus and conversations already draw fewer frames.", <Choice value={state.frameCap} options={FRAME_CAPS.map((cap) => ({ value: cap, label: cap ? `${cap} fps` : "Unlimited" }))} onChange={(v) => engine.setFrameCap(v as FrameCap)} />),
      row("Dynamic resolution", "Lowers the resolution when the frame rate drops, and raises it again once it recovers.", <Choice value={state.autoResolution} options={ON_OFF} onChange={(v) => engine.setAutoResolution(v)} />),
    ];
  } else if (category === "audio") {
    rows = [row("Sound", "Every sound is generated as you play. It starts with your first click.", <Choice value={state.sound} options={ON_OFF} onChange={() => engine.toggleSound()} />)];
  } else if (category === "crosshair") {
    rows = [
      <div className="crosshair-preview" key="preview" aria-hidden="true">
        <Crosshair engine={null} settings={crosshair} focused={false} hidden={false} preview />
      </div>,
      row("Preset", "Start from a ready-made crosshair, then adjust it below.", <Choice value={preset} options={[...CROSSHAIR_PRESETS.map((p, i) => ({ value: i, label: p.name })), ...(preset < 0 ? [{ value: -1, label: "Custom" }] : [])]} onChange={(i) => i >= 0 && onCrosshair(CROSSHAIR_PRESETS[i].settings)} />),
      row("Style", "The shape of the mark.", <Choice value={crosshair.style} options={STYLES} onChange={(style) => onCrosshair({ style })} />),
      row("Colour", "Pick one, or any colour with the last swatch.", <Swatches value={crosshair.color} onChange={(color) => onCrosshair({ color })} />),
      row("Size", "Length of each line.", <Bar value={crosshair.length} min={0} max={24} step={1} onChange={(length) => onCrosshair({ length })} />),
      row("Thickness", "Width of each line.", <Bar value={crosshair.thickness} min={1} max={6} step={1} onChange={(thickness) => onCrosshair({ thickness })} />),
      row("Gap", "Space in the middle.", <Bar value={crosshair.gap} min={0} max={20} step={1} onChange={(gap) => onCrosshair({ gap })} />),
      row("Outline", "A dark edge that keeps the mark visible on bright walls.", <Bar value={crosshair.outline} min={0} max={3} step={1} onChange={(outline) => onCrosshair({ outline })} />),
      row("Opacity", "How solid the mark is.", <Bar value={crosshair.alpha} min={0.2} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(alpha) => onCrosshair({ alpha })} />),
      row("Spread when moving", "The lines open up as you move and fire, the way a shooter shows accuracy.", <Choice value={crosshair.dynamic} options={ON_OFF} onChange={(dynamic) => onCrosshair({ dynamic })} />),
      row("T-style", "Drops the top line.", <Choice value={crosshair.tStyle} options={ON_OFF} onChange={(tStyle) => onCrosshair({ tStyle })} />),
      row("Colour on a target", "What the mark turns when it is over something you can use.", <Swatches value={crosshair.focusColor} onChange={(focusColor) => onCrosshair({ focusColor })} />),
    ];
  } else {
    rows = [
      ...state.signs.map((sign) =>
        row(
          `Picture for ${sign.label.toLowerCase()}`,
          "Puts your picture on the sign over this figure's face, whole and uncropped. It stays on this device only.",
          <span className="option-buttons">
            <label className="file">
              {sign.custom ? "Change" : "Choose"}
              <input type="file" accept="image/*" onChange={onPicture(sign.id)} />
            </label>
            {sign.custom && (
              <button className="quiet" onClick={() => engine.resetSignPicture(sign.id)}>
                Original
              </button>
            )}
          </span>,
        ),
      ),
      row(
        "Character model",
        "Replace both figures with your own .glb. A .gltf needs its .bin and textures picked together. You can also drop files on the page.",
        <label className="file">
          Load .glb / .gltf
          <input type="file" accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2" multiple onChange={(e) => e.target.files?.length && void engine.loadCharacterFiles(e.target.files)} />
        </label>,
      ),
      ...(state.clips.length
        ? [row("Character animation", "Which of the model's animations the figures play.", <Choice value={state.clipIndex} options={state.clips.map((name, i) => ({ value: i, label: name }))} onChange={(i) => engine.selectClip(i)} />)]
        : []),
      row("Fit character to 1.75 m", "Rescales a model exported at the wrong size.", <Choice value={state.autoScale} options={ON_OFF} onChange={(v) => engine.setAutoScale(v)} />),
      row("Keep player in the room", "Off lets you walk out through an open door.", <Choice value={state.confineToRoom} options={ON_OFF} onChange={(v) => engine.setConfineToRoom(v)} />),
      row("Show colliders", "Draws every collision box. Also the ` key.", <Choice value={state.debug} options={ON_OFF} onChange={(v) => engine.setDebug(v)} />),
    ];
  }

  return (
    <div className="options" role="dialog" aria-label="Options">
      <div className="options-frame">
        <header>
          <span>Options</span>
          <h1>{info.label}</h1>
        </header>
        <div className="options-body">
          <nav className="options-tabs" aria-label="Categories">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                aria-current={c.id === category || undefined}
                onClick={() => {
                  setCategory(c.id);
                  setHelp("");
                }}
              >
                {c.label}
              </button>
            ))}
          </nav>
          <div className="options-rows" onMouseLeave={() => setHelp("")}>
            {rows}
          </div>
        </div>
        <footer>
          <p className="options-help">{help || info.help}</p>
          <span className="options-keys">
            <kbd>Q</kbd>
            <kbd>E</kbd> category ·{" "}
            <button className="quiet" onClick={onBack} autoFocus>
              Back <kbd>Esc</kbd>
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}

/** ◀ value ▶. The left and right arrows step it while it has focus. */
function Choice<T>({ value, options, onChange }: { value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void }) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  const step = (d: number) => onChange(options[(i + d + options.length) % options.length].value);
  return (
    <div
      className="choice"
      onKeyDown={(e) => {
        if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
          e.preventDefault();
          step(e.code === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <button aria-label="Previous" onClick={() => step(-1)}>
        ◀
      </button>
      <span>{options[i]?.label}</span>
      <button aria-label="Next" onClick={() => step(1)}>
        ▶
      </button>
    </div>
  );
}

function Bar({ value, min, max, step, format = (v) => String(v), onChange }: { value: number; min: number; max: number; step: number; format?: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="bar-control">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties} />
      <b>{format(value)}</b>
    </div>
  );
}

function Swatches({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="swatches">
      {COLOURS.map((c) => (
        <button key={c} aria-label={c} aria-pressed={c.toLowerCase() === value.toLowerCase()} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
      <input type="color" aria-label="Any colour" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
