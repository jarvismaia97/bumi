import { describe, expect, it } from 'vitest';
import handler from './share';

function render(query: Record<string, string | string[]>, method = 'GET'): { status: number; html: string; headers: Record<string, string> } {
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
  // Only `query` and `method` are read; the rest of VercelRequest is Node's IncomingMessage and
  // would be 70 fields of noise to build here.
  handler({ query, method } as unknown as Parameters<typeof handler>[0], res);
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

  // This function runs at UTC on Vercel and the sharer does not. Judged against UTC midnight, a
  // sharer east of UTC has their genuine today read as a future date for as many hours a day as
  // their offset — and the card does not fail loudly, it degrades to the generic one with no
  // `?daily=` at all, dropping the receiver on the menu. The window opens at local midnight,
  // which is exactly when the daily resets and when people solve and share.
  it('accepts a key from a sharer whose local day is already ahead of UTC', () => {
    const utcNow = new Date();
    const aheadOfUtc = new Date(utcNow.getTime() + 13 * 60 * 60 * 1000);
    const key = `${aheadOfUtc.getUTCFullYear()}${String(aheadOfUtc.getUTCMonth() + 1).padStart(2, '0')}${String(aheadOfUtc.getUTCDate()).padStart(2, '0')}`;

    const { html } = render({ kind: 'diario', value: key });
    expect(html).toContain(`/?daily=${key}`);
    expect(html).toContain('Desafio diário');
  });

  // The slack is bounded at the largest real offset, so a date nobody could be standing in is
  // still turned down rather than minted into a shareable card.
  it('still refuses a date beyond any real timezone', () => {
    const far = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const key = `${far.getUTCFullYear()}${String(far.getUTCMonth() + 1).padStart(2, '0')}${String(far.getUTCDate()).padStart(2, '0')}`;

    const { html } = render({ kind: 'diario', value: key });
    expect(html).not.toContain('?daily=');
    expect(html).toContain('Bumi · Puzzle de lógica');
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

  it('renders for the two verbs a link is followed with, and refuses the rest', () => {
    for (const method of ['GET', 'HEAD']) {
      expect(render({ kind: 'nivel', value: '1' }, method).status).toBe(200);
    }
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const { status, html, headers } = render({ kind: 'nivel', value: '1' }, method);
      expect(status).toBe(405);
      expect(headers.allow).toBe('GET, HEAD');
      expect(html).not.toContain('<!doctype html>');
    }
  });

  it('escapes < in the redirect literal, so no value can close the script block early', () => {
    const { html } = render({ kind: 'nivel', value: '1' });
    // The only `<` inside the script block would be one JSON.stringify let through: the tag
    // opener and its closer are the block's own, and everything between them is escaped.
    const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.indexOf('</script>'));
    expect(script).not.toContain('<');
    expect(script).toContain('location.replace("');
  });
});
