import { getReviewData } from "@/lib/rooms";
import { json, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Vue formateur : réponses libres à valider, groupées par question.
// Anti-triche : le corrigé et les réponses ne sont exposés qu'une fois le chrono
// écoulé (phase de correction ou session terminée), jamais pendant le jeu.
export const GET = handler(async (_request, { params }) => {
  const code = await codeFromParams(params);
  const review = await getReviewData(code);
  if (!review) return json({ error: "Salle introuvable." }, 404);
  if (review.status !== "review" && review.status !== "ended")
    return json({ error: "Correction indisponible (quiz en cours)." }, 403);
  return json(review);
});
