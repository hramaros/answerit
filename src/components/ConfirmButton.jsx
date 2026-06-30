"use client";
import { useEffect, useRef, useState } from "react";

// Bouton de confirmation à deux temps (évite une modale pour les actions
// destructives) : 1er clic → « armé », 2e clic dans le délai → exécute.
export default function ConfirmButton({
  children,
  confirmLabel = "Confirmer ?",
  onConfirm,
  className = "btn btn--danger",
  style,
  disabled = false,
  timeout = 3000,
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function click() {
    if (disabled) return;
    if (armed) {
      clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
    } else {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), timeout);
    }
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      disabled={disabled}
      aria-live="polite"
      onClick={click}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
