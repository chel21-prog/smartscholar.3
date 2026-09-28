import { useCallback, useEffect, useRef } from "react";
import styles from "./NumberInput.module.css";

// Sets the value the way a real keystroke would, so the parent's onChange
// receives a genuine event and React state stays in sync.
const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

const decimalsOf = (n) => {
  const s = String(n);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
};

/**
 * Number field with a custom − / + stepper instead of the browser's default
 * spinner arrows. Drop-in replacement for <input type="number">:
 *
 *   <NumberInput className={styles.input} min={0} value={x} onChange={...} />
 *
 * - `className` goes on the outer box (so the field keeps the look of the
 *   input it replaces — border, padding, width). The real <input> inside is bare.
 * - Click a chevron to step, or hold it to keep stepping. ↑ / ↓ keys work too.
 * - `bare` drops the hover/focus ring — use it inside a wrapper that already
 *   draws its own border (e.g. the ₱ / "slots" adorned fields).
 */
export default function NumberInput({
  className = "",
  bare = false,
  min,
  max,
  step = 1,
  value,
  disabled,
  readOnly,
  ...rest
}) {
  const inputRef = useRef(null);
  const holdTimer = useRef(null);
  const repeatTimer = useRef(null);

  const stepNum = Number(step) > 0 ? Number(step) : 1;
  const cur = parseFloat(value);
  const hasValue = Number.isFinite(cur);
  const atMin = hasValue && min !== undefined && cur <= Number(min);
  const atMax = hasValue && max !== undefined && cur >= Number(max);

  const bump = useCallback(
    (dir) => {
      const el = inputRef.current;
      if (!el || el.disabled || el.readOnly) return;

      const current = parseFloat(el.value);
      let next;
      if (Number.isFinite(current)) {
        next = current + dir * stepNum;
      } else {
        // empty field: first click lands on the minimum (or one step / zero)
        next = dir > 0 ? (min !== undefined ? Number(min) : stepNum) : (min !== undefined ? Number(min) : 0);
      }
      if (min !== undefined) next = Math.max(next, Number(min));
      if (max !== undefined) next = Math.min(next, Number(max));
      next = Number(next.toFixed(Math.max(decimalsOf(stepNum), decimalsOf(current) || 0)));

      nativeValueSetter?.call(el, String(next));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    [min, max, stepNum]
  );

  const stopHold = useCallback(() => {
    clearTimeout(holdTimer.current);
    clearInterval(repeatTimer.current);
  }, []);

  const startHold = (dir) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault(); // keep focus where it was
    bump(dir);
    stopHold();
    holdTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => bump(dir), 70);
    }, 400);
  };

  useEffect(() => stopHold, [stopHold]);

  const locked = disabled || readOnly;

  return (
    <span
      className={`${styles.wrap} ${className}`}
      data-numwrap={bare ? undefined : ""}
      data-disabled={disabled ? "" : undefined}
    >
      <input
        {...rest}
        ref={inputRef}
        type="number"
        data-numfield=""
        className={styles.field}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
      />
      <span className={styles.steppers} aria-hidden="false">
        <button
          type="button"
          data-stepper=""
          tabIndex={-1}
          className={styles.step}
          aria-label="Increase"
          disabled={locked || atMax}
          onPointerDown={startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
        >
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none" aria-hidden="true">
            <path d="M1 4l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          data-stepper=""
          tabIndex={-1}
          className={styles.step}
          aria-label="Decrease"
          disabled={locked || atMin}
          onPointerDown={startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
        >
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none" aria-hidden="true">
            <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </span>
    </span>
  );
}
