export default function Leaderboard({ players, meId }) {
  if (!players || players.length === 0) {
    return <p className="muted">Aucun participant.</p>;
  }
  return (
    <div className="lb">
      {players.map((p) => (
        <div
          key={p.id}
          className={`lb-row${p.id === meId ? " lb-row--me" : ""}`}
        >
          <div className="lb-rank">{p.rank}</div>
          <div>
            <div style={{ fontWeight: 700 }}>{p.pseudo}</div>
            <div className="lb-note">
              {p.note}/20 · {p.nbCorrect} bonne{p.nbCorrect > 1 ? "s" : ""} réponse
              {p.nbCorrect > 1 ? "s" : ""}
            </div>
          </div>
          <div className="lb-score">{p.score}</div>
        </div>
      ))}
    </div>
  );
}
