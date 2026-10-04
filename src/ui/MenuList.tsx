import { useEffect, useRef, useState } from "react";

export type MenuItem = { id: string; label: string; detail?: string; disabled?: boolean; run: () => void };

/**
 * A vertical menu in the style of the title screen: big type, a red marker
 * on the selected item. The arrows (or W/S) move focus and Enter or Space
 * click the focused button natively, so nothing fires twice. `active` turns
 * the keys off while a sub-screen is showing.
 */
export function MenuList({ items, label, active = true, onMove }: { items: MenuItem[]; label: string; active?: boolean; onMove?: () => void }) {
  const [selected, setSelected] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const current = Math.min(selected, items.length - 1);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const step = e.code === "ArrowDown" || e.code === "KeyS" ? 1 : e.code === "ArrowUp" || e.code === "KeyW" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const list = itemsRef.current;
      let next = Math.min(selected, list.length - 1);
      for (let n = 0; n < list.length; n++) {
        next = (next + step + list.length) % list.length;
        if (!list[next].disabled) break;
      }
      setSelected(next);
      ref.current?.querySelectorAll("button")[next]?.focus();
      onMove?.();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [active, selected, onMove]);

  return (
    <nav className="title-menu" aria-label={label} ref={ref}>
      {items.map((item, i) => (
        <button
          key={item.id}
          className={i === current ? "selected" : undefined}
          disabled={item.disabled}
          onMouseEnter={() => !item.disabled && setSelected(i)}
          onFocus={() => setSelected(i)}
          onClick={item.run}
          autoFocus={i === 0}
        >
          <span>{item.label}</span>
          {item.detail && <small>{item.detail}</small>}
        </button>
      ))}
    </nav>
  );
}
