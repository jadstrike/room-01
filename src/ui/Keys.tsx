const CONTROLS: ReadonlyArray<[string, string[]]> = [
  ["Move", ["W", "A", "S", "D"]],
  ["Sprint", ["Shift"]],
  ["Crouch", ["Ctrl"]],
  ["Jump", ["Space"]],
  ["Examine · talk · open", ["E"]],
  ["Journal", ["J"]],
  ["Device (in the house or the lab)", ["P"]],
  ["Fire", ["Click"]],
  ["Reload", ["R"]],
  ["Look at the gun", ["F"]],
  ["Draw · put away", ["1", "2"]],
  ["Dialogue choices", ["1–9", "0"]],
  ["Pause", ["Esc"]],
];

/** The controls, one action per row, as a game's controls screen lists them. */
export function Keys() {
  return (
    <dl className="controls-table">
      {CONTROLS.map(([action, keys]) => (
        <div key={action}>
          <dt>{action}</dt>
          <dd>
            {keys.map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
