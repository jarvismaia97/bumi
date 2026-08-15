/**
 * Size, weight, radius and space as a fixed set of steps.
 *
 * Nothing here is wired up yet — no component imports it. It exists so the migration is a
 * lookup rather than a judgement call, and so the next person adding a screen has somewhere
 * obvious to reach instead of picking a number.
 *
 * What the audit found, counted over `src/**`:
 *
 * - 126 `fontSize` declarations across 18 distinct values. Six of them — 10, 11, 12, 13, 14,
 *   15 — account for 95 of the 126, and the steps between them are ratios of 1.10, 1.09, 1.08,
 *   1.08 and 1.07. A reader cannot see an 8% difference in isolation, so six of the eighteen
 *   sizes in the app are doing the work of about one. Size is carrying almost no hierarchy.
 * - 98 `fontWeight` declarations, of which 97 are 600, 700 or 800 and 44 are 800 alone. Weight
 *   is carrying none either: when nearly everything is bold, nothing is.
 *
 * The fix is fewer steps, far enough apart to be seen. The sizes below step 1.18, 1.15, 1.20,
 * 1.22 and 1.36 — not a strict geometric ratio, because the small end is where legibility
 * floors matter more than arithmetic, but every step is over 15% and so is visible.
 *
 * Weight then means something specific rather than "important": 400 is prose, 600 is a label
 * or a control, and 800 is reserved for numerals and `display`, which is what the game is
 * actually made of — clues, counters, timers, scores.
 */
export const TYPE = {
  /** Grid labels, tier names, timestamps. The floor: nothing smaller ships. */
  caption: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  /** Prose. Island stories, explanations, sheet copy. */
  body: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  /** A line of prose that has to win — button labels, list rows, the active item. */
  bodyStrong: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  /** Card and section headings inside a sheet. */
  title: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  /** The heading a screen or sheet opens with. */
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  /** One per screen at most: the streak count, the final time, the score. */
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
} as const;

export type TypeStep = keyof typeof TYPE;

/**
 * 15 distinct `borderRadius` values ship today, and 2/3/4/5/6 are all in use — differences of
 * a single pixel on a curve nobody can see. These six are the whole vocabulary: `xs` for a
 * chip or a dot, `sm` for the common case (33 of the current declarations are already 8),
 * `md` and `lg` for cards, `sheet` for the bottom sheet's own corner, `pill` for anything
 * fully rounded.
 */
export const RADIUS = { xs: 4, sm: 8, md: 12, lg: 16, sheet: 20, pill: 999 } as const;

/**
 * Padding, margin and gap on a 4px grid. Four steps cover almost everything; `xxl` and `xxxl`
 * are for separating whole regions, not for padding inside one.
 */
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
