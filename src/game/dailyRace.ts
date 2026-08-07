/**
 * The daily seen as a race between friends. Deliberately free of imports: `api/progress.ts`
 * reaches for this on every post that carries a time, and `game/daily.ts` — the obvious home —
 * pulls the level generator with it, which a serverless function has no business bundling.
 * `lib/playerName.ts` is split from `lib/identity.ts` for the same reason.
 */

/**
 * Whether a solve at `currentMs` has just moved past a friend sitting at `theirMs`, given the
 * time this player held before (`null` when today was unplayed).
 *
 * Half-open on purpose: slower than the new time, and not already slower than the old one. A
 * friend who was behind before heard about it then, and telling them again on every replay is
 * how a useful notification turns into one people switch off.
 */
export function beatsFriendTime(previousMs: number | null, currentMs: number, theirMs: number): boolean {
  // A replay that did not improve on the record cannot have passed anybody, since the time kept
  // is the better of the two.
  if (previousMs !== null && currentMs >= previousMs) return false;
  return theirMs > currentMs && (previousMs === null || theirMs <= previousMs);
}
