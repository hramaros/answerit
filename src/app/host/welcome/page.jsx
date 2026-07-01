"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Brand from "@/components/Brand";

const STEPS = [
  {
    title: "Le quiz live qui donne une vraie note",
    lines: [
      "valio lance des quiz en direct façon Kahoot — mais qui produisent une note /20 exploitable.",
      "Deux modes : Libre (gratuit, QCM, jusqu'à 10 participants, sans compte) et Examen (pro).",
    ],
  },
  {
    title: "Le mode Examen & les crédits",
    lines: [
      "En mode Examen, vous rechargez un solde en Ariary. Lancer un examen débite 1 000 Ar (≤ 20 participants) ou 2 000 Ar (illimité), en fin de session.",
      "L'Examen débloque la réponse libre corrigée à la main, l'export PDF, l'historique et le tableau de bord.",
    ],
  },
  {
    title: "Classes & carnet de notes",
    lines: [
      "Créez une classe avec vos élèves, lancez un examen nominatif (chacun choisit son nom), et retrouvez la note /20 de chaque élève dans le carnet de notes.",
    ],
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;

  function done(href = "/host") {
    try {
      localStorage.setItem("valio:onboarded", "1");
    } catch {}
    router.push(href);
  }

  const s = STEPS[step];

  return (
    <div className="center-screen">
      <div className="container container--narrow stack gap-24">
        <div className="row row--between">
          <Brand />
          <button type="button" className="pill" onClick={() => done()}>
            Passer
          </button>
        </div>

        <div className="card stack gap-16">
          <span className="eyebrow">
            Bienvenue · {step + 1} / {STEPS.length}
          </span>
          <h1 style={{ fontSize: "1.9rem" }}>{s.title}</h1>
          <div className="stack gap-12">
            {s.lines.map((l, i) => (
              <p key={i} className="muted">{l}</p>
            ))}
          </div>

          <div className="onb-dots" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`onb-dot${i === step ? " onb-dot--on" : ""}`} />
            ))}
          </div>

          {last ? (
            <div className="stack gap-8">
              <button
                className="btn btn--primary btn--lg btn--block"
                onClick={() => done("/host")}
              >
                Créer mon premier quiz
              </button>
              <button
                className="btn btn--ghost btn--block"
                onClick={() => done("/host/classes")}
              >
                Créer une classe
              </button>
            </div>
          ) : (
            <div className="row gap-12">
              {step > 0 && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setStep((n) => n - 1)}
                >
                  Retour
                </button>
              )}
              <button
                type="button"
                className="btn btn--primary btn--block"
                style={{ flex: 1 }}
                onClick={() => setStep((n) => n + 1)}
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
