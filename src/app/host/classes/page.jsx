"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useAccount } from "@/lib/account-client";

export default function HostClassesPage() {
  const { account, loading } = useAccount();
  const [classes, setClasses] = useState(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(null); // détail complet d'une classe
  const [studentName, setStudentName] = useState("");
  const [gradebook, setGradebook] = useState(null);

  const refreshList = useCallback(async () => {
    const { ok, data } = await apiGet("/api/host/classes");
    if (ok) setClasses(data.classes);
  }, []);

  useEffect(() => {
    if (account) refreshList();
  }, [account, refreshList]);

  async function createCls(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const { ok } = await apiPost("/api/host/classes", { name: name.trim() });
    if (ok) {
      setName("");
      refreshList();
    }
  }

  async function openClass(id) {
    setGradebook(null);
    const { ok, data } = await apiGet(`/api/host/classes/${id}`);
    if (ok) setSelected(data.classroom);
  }

  async function openGradebook() {
    if (!selected) return;
    const { ok, data } = await apiGet(`/api/host/classes/${selected.id}/gradebook`);
    if (ok) setGradebook(data.gradebook);
  }

  async function addStu(e) {
    e.preventDefault();
    if (!studentName.trim() || !selected) return;
    const { ok, data } = await apiPost(
      `/api/host/classes/${selected.id}/students`,
      { name: studentName.trim() },
    );
    if (ok) {
      setStudentName("");
      setSelected(data.classroom);
      refreshList();
    }
  }

  async function removeStu(studentId) {
    const { ok, data } = await apiDelete(
      `/api/host/classes/${selected.id}/students`,
      { studentId },
    );
    if (ok) setSelected(data.classroom);
  }

  async function deleteCls(id) {
    const { ok } = await apiDelete(`/api/host/classes/${id}`);
    if (ok) {
      if (selected?.id === id) setSelected(null);
      refreshList();
    }
  }

  if (loading) {
    return <div className="center-screen"><div className="spin" /></div>;
  }

  if (!account) {
    return (
      <div className="center-screen">
        <div className="card stack gap-16" style={{ textAlign: "center" }}>
          <h2>Mes classes</h2>
          <p className="muted">Connectez-vous pour gérer vos classes.</p>
          <Link href="/host" className="btn btn--primary">Espace formateur</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container stack gap-24">
      <div className="row row--between wrap gap-12">
        <Link href="/" className="brand">
          <img src="/logo.png" alt="valio" className="brand__logo" />
          <b>.fanontaniana</b>
        </Link>
        <Link href="/host" className="pill">← Espace formateur</Link>
      </div>

      <div className="stack gap-8">
        <span className="eyebrow">{account.email}</span>
        <h1 style={{ fontSize: "2rem" }}>Mes classes</h1>
      </div>

      <form className="card row gap-12 wrap" onSubmit={createCls}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 180 }}
          placeholder="Nom de la classe (ex. 6ème A)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <button type="submit" className="btn btn--primary">Créer la classe</button>
      </form>

      {!classes ? (
        <div className="spin" style={{ margin: "0 auto" }} />
      ) : classes.length === 0 ? (
        <div className="panel" style={{ textAlign: "center" }}>
          <p className="muted">Aucune classe pour l'instant.</p>
        </div>
      ) : (
        <div className="stack gap-8">
          {classes.map((c) => (
            <div key={c.id} className="grade-row">
              <div className="grade-row__ans">
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div className="muted tiny">
                  {c.studentCount} élève{c.studentCount > 1 ? "s" : ""}
                </div>
              </div>
              <div className="row gap-8">
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ padding: "8px 12px" }}
                  onClick={() => openClass(c.id)}
                >
                  Gérer
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  style={{ padding: "8px 12px" }}
                  onClick={() => deleteCls(c.id)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal stack gap-16"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480 }}
          >
            <div className="row row--between">
              <h2 style={{ fontSize: "1.3rem" }}>{selected.name}</h2>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ padding: "6px 10px" }}
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>

            <form className="row gap-8 wrap" onSubmit={addStu}>
              <input
                className="input"
                style={{ flex: 1, minWidth: 160 }}
                placeholder="Nom de l'élève"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                maxLength={60}
                autoFocus
              />
              <button type="submit" className="btn btn--primary">Ajouter</button>
            </form>

            {selected.students.length === 0 ? (
              <p className="muted tiny">Aucun élève. Ajoutez-les ci-dessus.</p>
            ) : (
              <div className="stack gap-8">
                {selected.students.map((s) => (
                  <div key={s.id} className="grade-row">
                    <div className="grade-row__ans">{s.name}</div>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: "6px 10px" }}
                      onClick={() => removeStu(s.id)}
                      aria-label={`Retirer ${s.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={openGradebook}
            >
              📊 Carnet de notes
            </button>
            {gradebook && (
              gradebook.exams.length === 0 ? (
                <p className="muted tiny">Aucun examen pour cette classe.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="gradebook">
                    <thead>
                      <tr>
                        <th>Élève</th>
                        {gradebook.exams.map((e) => (
                          <th key={e.id}>{e.title}</th>
                        ))}
                        <th>Moy.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradebook.rows.map((row) => (
                        <tr key={row.studentId}>
                          <td>{row.name}</td>
                          {gradebook.exams.map((e) => (
                            <td key={e.id}>
                              {row.notes[e.id] == null ? "—" : row.notes[e.id]}
                            </td>
                          ))}
                          <td>
                            <strong>{row.avgNote == null ? "—" : row.avgNote}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
