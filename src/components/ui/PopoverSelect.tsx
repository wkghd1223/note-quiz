"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { nextOptionIndex, popoverPosition, typeaheadMatch } from "./popover-select-interaction";
import styles from "./PopoverSelect.module.css";

export interface PopoverSelectOption<Value extends string = string> {
  value: Value;
  label: string;
  lang?: string;
  dir?: "ltr" | "rtl" | "auto";
}

export interface PopoverSelectProps<Value extends string = string> {
  label: string;
  closeLabel: string;
  value: Value;
  options: readonly PopoverSelectOption<Value>[];
  onValueChange: (value: Value) => void;
  disabled?: boolean;
}

export default function PopoverSelect<Value extends string>({
  label, closeLabel, value, options, onValueChange, disabled = false,
}: PopoverSelectProps<Value>) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);
  const search = useRef({ text: "", at: 0 });
  const backdropPress = useRef(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const selected = options.find((option) => option.value === value);
  const unavailable = disabled || options.length === 0;

  function focusOption(index: number) {
    const item = items.current[index];
    if (!item) return;
    setActive(index);
    item.focus({ preventScroll: true });
    item.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }

  useEffect(() => {
    if (!open) return;
    if (unavailable) {
      setOpen(false);
      return;
    }
    const panel = dialog.current;
    const button = trigger.current;
    if (!panel || !button) return;
    const overflow = document.body.style.getPropertyValue("overflow");
    const priority = document.body.style.getPropertyPriority("overflow");
    document.body.style.setProperty("overflow", "hidden");
    panel.showModal();
    const position = () => {
      if (!window.matchMedia("(min-width: 768px)").matches) {
        panel.style.removeProperty("left");
        panel.style.removeProperty("top");
        return;
      }
      const { left, top } = popoverPosition(
        button.getBoundingClientRect(), panel.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        getComputedStyle(button).direction === "rtl",
      );
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    };
    position();
    const index = options.findIndex((option) => option.value === value);
    if (index >= 0) focusOption(index);
    else {
      setActive(-1);
      closeButton.current?.focus({ preventScroll: true });
    }
    search.current = { text: "", at: 0 };
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      if (panel.open) panel.close();
      if (overflow) document.body.style.setProperty("overflow", overflow, priority);
      else document.body.style.removeProperty("overflow");
      if (button.isConnected) button.focus({ preventScroll: true });
    };
  }, [open, unavailable, options, value]);

  function choose(option: PopoverSelectOption<Value>) {
    setOpen(false);
    if (option.value !== value) onValueChange(option.value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Tab") {
      event.preventDefault();
      const index = items.current.findIndex((item) => item === document.activeElement);
      const next = (index + (event.shiftKey ? -1 : 1) + options.length + 1) % (options.length + 1);
      if (next === options.length) closeButton.current?.focus({ preventScroll: true });
      else focusOption(next);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      focusOption(nextOptionIndex(active, options.length, event.key));
    } else if (event.key.length === 1 && event.key !== " ") {
      const now = Date.now();
      const text = (now - search.current.at < 600 ? search.current.text : "") + event.key;
      search.current = { text, at: now };
      const index = typeaheadMatch(options.map((option) => option.label), text, active);
      if (index >= 0) {
        event.preventDefault();
        focusOption(index);
      }
    }
  }

  function outside(event: { clientX: number; clientY: number }) {
    const rect = dialog.current?.getBoundingClientRect();
    return !!rect && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  }

  return (
    <>
      <button
        ref={trigger} type="button" className={styles.trigger}
        aria-label={`${label}: ${selected?.label ?? value}`}
        aria-haspopup="dialog" aria-expanded={open && !unavailable} aria-controls={id}
        aria-invalid={!selected || undefined} disabled={unavailable}
        data-value={value}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></svg>
        <bdi className={styles.current} lang={selected?.lang} dir={selected?.dir}>{selected?.label ?? value}</bdi>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg>
      </button>
      <dialog
        id={id} ref={dialog} className={styles.dialog} aria-labelledby={`${id}-label`}
        onKeyDown={onKeyDown}
        onCancel={(event) => { event.preventDefault(); setOpen(false); }}
        onClose={() => { if (!dialog.current?.open) setOpen(false); }}
        onPointerDown={(event) => { backdropPress.current = event.target === event.currentTarget && outside(event); }}
        onClick={(event) => { if (backdropPress.current && event.target === event.currentTarget && outside(event)) setOpen(false); backdropPress.current = false; }}
      >
        <div className={styles.header}>
          <h2 id={`${id}-label`}>{label}</h2>
          <button ref={closeButton} type="button" className={styles.close} aria-label={closeLabel} onClick={() => setOpen(false)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
        </div>
        <div className={styles.list} role="menu" aria-labelledby={`${id}-label`}>
          {options.map((option, index) => (
            <button key={option.value} ref={(element) => { items.current[index] = element; }}
              type="button" role="menuitemradio" aria-checked={option.value === value} dir={option.dir}
              tabIndex={index === active ? 0 : -1} className={styles.option}
              onFocus={() => setActive(index)} onClick={() => choose(option)}
            >
              <bdi lang={option.lang} dir={option.dir}>{option.label}</bdi>
              {option.value === value && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>}
            </button>
          ))}
        </div>
      </dialog>
    </>
  );
}
