import { describe, expect, it } from 'vitest';
import { createDailySocialContent } from './socialContent';

describe('createDailySocialContent', () => {
  it('creates a deterministic, public social package for a daily challenge', () => {
    const content = createDailySocialContent('20260721', 'https://www.jogarbumi.pt');

    expect(content.title).toContain('21 de julho');
    expect(content.hook.length).toBeGreaterThan(10);
    expect(content.challengeUrl).toBe('https://www.jogarbumi.pt/partilha/diario/20260721');
    expect(content.caption).toContain(content.challengeUrl);
  });

  it('translates the whole package, link included', () => {
    const content = createDailySocialContent('20260721', 'https://www.jogarbumi.pt', 'es');

    expect(content.title).toContain('21 de julio');
    expect(content.challengeUrl).toBe('https://www.jogarbumi.pt/partilha/diario/20260721?lang=es');
    expect(content.caption).toContain('Resuelve el reto diario');
  });

  it('rejects invalid dates', () => {
    expect(() => createDailySocialContent('20260230', 'https://www.jogarbumi.pt')).toThrow('Invalid daily challenge date');
  });
});
