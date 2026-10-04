/** The controls, as a compact list of keycaps. */
export function Keys() {
  return (
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
        <kbd>Click</kbd> fire · <kbd>R</kbd> reload · <kbd>F</kbd> inspect · <kbd>E</kbd> interact / talk
      </li>
      <li>
        <kbd>J</kbd> journal · <kbd>P</kbd> device, in a site
      </li>
      <li>
        <kbd>1</kbd> pistol · <kbd>2</kbd> put away · <kbd>Q</kbd> / scroll swap
      </li>
      <li>
        <kbd>Esc</kbd> pause · <kbd>`</kbd> colliders
      </li>
    </ul>

  );
}
