"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Shape from "@/components/Shape";
import { apiPost } from "@/lib/api";
import { normalizeCode } from "@/lib/code";

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function participate(e) {
    e.preventDefault();
    const clean = normalizeCode(code);
    if (!clean) {
      setError("Entrez le code de la salle.");
      return;
    }
    setError("");
    setLoading(true);
    const { ok, data } = await apiPost(`/api/player/${clean}/join`);
    setLoading(false);
    if (!ok) {
      setError(data?.error || "Salle introuvable.");
      return;
    }
    router.push(`/join?code=${clean}`);
  }

  return (
    <div className="center-screen">
      <div className="container container--narrow stack gap-24">
        <div className="row row--between">
          <span className="brand">
            <span className="brand__mark">
              <i /><i /><i /><i />
            </span>
            answer<b>it</b>
          </span>
          <Link href="/host" className="pill">
            Espace formateur
          </Link>
        </div>

        <div className="hero stack gap-16">
          <div className="hero__shapes" aria-hidden>
            <span><Shape kind="circle" size={22} color="#161228" /></span>
            <span><Shape kind="triangle" size={22} color="#161228" /></span>
            <span><Shape kind="square" size={22} color="#161228" /></span>
            <span><Shape kind="diamond" size={22} color="#161228" /></span>
          </div>
          <h1>
            Un code, un pseudo, <em>et c'est parti.</em>
          </h1>
          <p className="muted">
            Rejoignez le quiz en direct lancé par votre formateur. Aucune
            inscription, juste le code de la salle.
          </p>
        </div>

        <form className="card stack gap-16" onSubmit={participate}>
          <div>
            <label className="label" htmlFor="code">
              Code de la salle
            </label>
            <input
              id="code"
              className="input input--code"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              autoComplete="off"
              autoFocus
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button
            type="submit"
            className="btn btn--primary btn--lg btn--block"
            disabled={loading}
          >
            {loading ? "Connexion…" : "Participer →"}
          </button>
        </form>

        <div className="divider-or">ou</div>
        <Link href="/host" className="btn btn--ghost btn--block">
          Créer un quiz (formateur)
        </Link>
      </div>
    </div>
  );
}
