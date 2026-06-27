"use client";
import { useEffect, useState } from "react";

/**
 * Chrono global. `endsAt` est en horloge serveur (ms) ; `serverOffset` =
 * serverNow - clientNow au moment du fetch, pour rester synchronisé.
 * Appelle `onExpire` une fois quand le temps atteint 0.
 */
export default function Countdown({ endsAt, durationMs, serverOffset = 0, onExpire }) {
  const [now, setNow] = useState(() => Date.now() + serverOffset);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + serverOffset), 250);
    return () => clearInterval(id);
  }, [serverOffset]);

  const remainingMs = Math.max(0, endsAt - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const pct = durationMs ? Math.max(0, (remainingMs / durationMs) * 100) : 0;
  const low = remainingMs <= 10000;

  useEffect(() => {
    if (remainingMs <= 0 && onExpire) onExpire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs <= 0]);

  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div
      className={`ring${low ? " ring--low" : ""}`}
      style={{ "--p": pct }}
      role="timer"
      aria-label={`Temps restant ${seconds} secondes`}
    >
      <span className="ring__num">
        {seconds >= 60 ? `${mm}:${ss}` : seconds}
      </span>
    </div>
  );
}
