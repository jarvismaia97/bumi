import { describe, expect, it } from 'vitest';
import handler from './share';

function render(query: Record<string, string | string[]>): { status: number; html: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  let status = 0;
  let html = '';
  const res: any = {
    status(code: number) {
      status = code;
      return res;
    },
    setHeader(key: string, value: string) {
      headers[key] = value;
      return res;
    },
    send(body: string) {
      html = body;
      return res;
    },
  };
  handler({ query }, res);
  return { status, html, headers };
}

describe('share card handler', () => {
  it('renders a level card in Portuguese by default', () => {
    const { status, html } = render({ kind: 'nivel', value: '42' });
    expect(status).toBe(200);
    expect(html).toContain('<html lang="pt-PT">');
    expect(html).toContain('Bumi · Nível 42');
    expect(html).toContain('sem dicas');
  });

  it('renders the same card in English when the sharer stamped lang=en', () => {
    const { html } = render({ kind: 'nivel', value: '42', lang: 'en' });
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Bumi · Level 42');
    expect(html).toContain('without hints');
    expect(html).not.toContain('Nível');
  });

  it('translates the daily card, including the date', () => {
    const portuguese = render({ kind: 'diario', value: '20260720' }).html;
    const english = render({ kind: 'diario', value: '20260720', lang: 'en' }).html;
    expect(portuguese).toContain('Desafio diário');
    expect(portuguese).toContain('julho');
    expect(english).toContain('Daily challenge');
    expect(english).toContain('July');
  });

  it('does not forward the sharer language to the app, so the receiver keeps their own', () => {
    const { html } = render({ kind: 'nivel', value: '42', lang: 'en' });
    expect(html).toContain('/?challenge=42');
    expect(html).not.toContain('challenge=42&lang');
  });

  it('falls back to the generic card for junk rather than failing', () => {
    for (const query of [{}, { kind: 'nivel', value: '0' }, { kind: 'nivel', value: '501' }, { kind: 'diario', value: '20260230' }, { kind: 'wat', value: 'x' }]) {
      const { status, html } = render(query as Record<string, string>);
      expect(status).toBe(200);
      expect(html).toContain('Bumi · Puzzle de lógica');
    }
  });

  it('survives an unknown or malformed lang instead of 500ing on a shared link', () => {
    expect(render({ kind: 'nivel', value: '7', lang: 'klingon' }).html).toContain('<html lang="en">');
    expect(render({ kind: 'nivel', value: '7', lang: ['en', 'pt'] }).html).toContain('<html lang="en">');
    expect(render({ kind: 'nivel', value: '7', lang: '' }).html).toContain('<html lang="pt-PT">');
  });

  it('escapes interpolated text so a card cannot inject markup', () => {
    const { html } = render({ kind: 'nivel', value: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('sets the cache header the CDN relies on', () => {
    expect(render({ kind: 'nivel', value: '1' }).headers['cache-control']).toBe('public, max-age=0, s-maxage=3600');
  });
});
