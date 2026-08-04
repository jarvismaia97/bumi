import { describe, expect, it } from 'vitest';
import { resolveCampaignSolve } from './results';

const clean = { hintsUsed: 0, mistakes: 0, rects: 12, milestone: false, unlockedIsland: false };

describe('what a campaign solve was worth', () => {
  it('records the medal earned and shows it when it is the best so far', () => {
    const outcome = resolveCampaignSolve(clean);

    expect(outcome.medal).toBe('gold');
    expect(outcome.displayedMedal).toBe('gold');
    expect(outcome.pointsGained).toBe(5);
  });

  it('records the worse medal but keeps showing the better one already held', () => {
    // A level keeps its best medal, so a scrappier replay must not look like a downgrade.
    const outcome = resolveCampaignSolve({ ...clean, hintsUsed: 2, bestMedal: 'gold' });

    expect(outcome.medal).toBe('bronze');
    expect(outcome.displayedMedal).toBe('gold');
    expect(outcome.pointsGained).toBe(0);
  });

  it('pays only the difference when a medal is improved', () => {
    const outcome = resolveCampaignSolve({ ...clean, bestMedal: 'silver' });

    expect(outcome.medal).toBe('gold');
    expect(outcome.pointsGained).toBe(2);
  });

  it('celebrates a first island above everything else it could be', () => {
    const outcome = resolveCampaignSolve({ ...clean, milestone: true, unlockedIsland: true });

    expect(outcome.tier).toBe('island');
  });

  it('ranks the celebration: milestone over the common medals, gold over milestone, island over both', () => {
    // A hint costs the gold and leaves silver, which a milestone outranks: a medal is won on
    // most solves, and the levels the catalogue marks are fixed and few.
    expect(resolveCampaignSolve({ ...clean, hintsUsed: 1, milestone: true }).tier).toBe('milestone');
    expect(resolveCampaignSolve({ ...clean, milestone: true }).tier).toBe('gold');
    expect(resolveCampaignSolve({ ...clean, hintsUsed: 1, unlockedIsland: true }).tier).toBe('island');
  });

  it('celebrates a silver, and leaves a bronze to the plain celebration', () => {
    // Spending one hint used to cost the whole celebration rather than just the gold. Bronze is
    // what a solve scores when nothing about it stood out, so it stays where it was.
    expect(resolveCampaignSolve({ ...clean, hintsUsed: 1 }).tier).toBe('silver');
    expect(resolveCampaignSolve({ ...clean, hintsUsed: 2 }).tier).toBe('normal');
  });

  it('scales the mistake budget with the board, as the medal rules do', () => {
    // Three mistakes is gold on a 47-rectangle board and bronze on a twelve-rectangle one.
    expect(resolveCampaignSolve({ ...clean, rects: 47, mistakes: 3 }).medal).toBe('gold');
    expect(resolveCampaignSolve({ ...clean, mistakes: 3 }).medal).toBe('silver');
  });
});
