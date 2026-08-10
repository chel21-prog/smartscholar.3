import { useEffect, useRef, useState } from "react";
import f from "./FilterDropdown.module.css";

/**
 * A single filter's dropdown: a button showing the current selection, and
 * a floating menu of options with a checkmark on the active one. Reads
 * and behaves like the filter menus on most modern web apps — click to
 * open, click an option (or use the arrow keys + Enter) to pick it,
 * Escape or an outside click to close.
 *
 * Props: { label, value, onChange, options: [{value,label}], width?, active? }
 */
export default function FilterDropdown({ label, value, onChange, options, width, active }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
      // focus the menu so arrow keys / Enter work immediately
      requestAnimationFrame(() => menuRef.current?.focus());
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  const onButtonKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(options[highlight]);
    }
  };

  return (
    <div className={f.root} ref={rootRef} style={width ? { maxWidth: width } : undefined}>
      <button
        type="button"
        className={`${f.trigger} ${active ? f.triggerActive : ""}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className={f.triggerLabel}>{selected?.label}</span>
        <svg className={f.chevron} width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          className={f.menu}
          role="listbox"
          aria-label={label}
          ref={menuRef}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
        >
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`${f.option} ${i === highlight ? f.optionHighlight : ""} ${opt.value === value ? f.optionSelected : ""}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => commit(opt)}
            >
              <span className={f.check} aria-hidden="true">
                {opt.value === value && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 4.5L4 7.5L10 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
