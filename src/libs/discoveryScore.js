/**
 * Sort priority and 0–100 display score derived from Maps rating + review volume.
 * Higher discoveryScore sorts first when listing account book prospects.
 */

export function computeMapsScores(totalScore = 0, reviewsCount = 0) {
  const r = typeof totalScore === "number" ? totalScore : Number(totalScore) || 0;
  const rev =
    typeof reviewsCount === "number"
      ? reviewsCount
      : Number(reviewsCount) || 0;
  const ratingComponent = Math.max(0, Math.min(r, 5)) / 5;
  const reviewComponent =
    rev > 0 ? Math.min(1, Math.log10(rev + 1) / Math.log10(1001)) : 0;
  const displayScore = Math.round(
    Math.min(100, ratingComponent * 65 + reviewComponent * 35)
  );

  const discoveryScore =
    r * 1_500_000 + Math.min(Math.max(rev, 0), 999_999) + displayScore;

  return { displayScore, discoveryScore, mapsRating: r, mapsReviewsCount: rev };
}

export function computeLeadBaselineScores(hasLinkedInUrl) {
  const displayScore = hasLinkedInUrl ? 72 : 64;
  const discoveryScore =
    200_000 + displayScore * 2_500 + (hasLinkedInUrl ? 15_000 : 0);

  return { displayScore, discoveryScore };
}

export function bumpScoreAfterLinkedinMerge(prevDisplay, prevDiscovery) {
  const displayScore = Math.min(96, Number(prevDisplay) + 8);
  const discoveryScore = Number(prevDiscovery) + 250_000;
  return { displayScore, discoveryScore };
}
