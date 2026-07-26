import { getDailyChallengeDateKey } from '../src/game/challenge';

const APP_URL = process.env.BETTER_AUTH_URL ?? 'https://www.jogarbumi.pt';
const MAX_CAMPAIGN_LEVEL = 500;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function formatDailyDate(dateKey: string): string {
  const date = new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(4, 6)) - 1, Number(dateKey.slice(6, 8)));
  return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
}

export default function handler(req: any, res: any) {
  const kind = Array.isArray(req.query.kind) ? req.query.kind[0] : req.query.kind;
  const value = Array.isArray(req.query.value) ? req.query.value[0] : req.query.value;
  const baseUrl = APP_URL.replace(/\/$/, '');

  let title = 'Bumi · Puzzle de lógica';
  let description = 'Divide a grelha em retângulos e resolve o puzzle.';
  let destination = `${baseUrl}/`;

  if (kind === 'nivel') {
    const level = Number(value);
    if (Number.isInteger(level) && level >= 1 && level <= MAX_CAMPAIGN_LEVEL) {
      title = `Bumi · Nível ${level}`;
      description = 'Consegues resolver este puzzle de lógica sem dicas?';
      destination = `${baseUrl}/?challenge=${level}`;
    }
  } else if (kind === 'diario') {
    const dateKey = getDailyChallengeDateKey(value);
    if (dateKey) {
      title = `Bumi · Desafio diário ${formatDailyDate(dateKey)}`;
      description = 'Resolve o desafio de hoje e compara a tua marca.';
      destination = `${baseUrl}/?daily=${dateKey}`;
    }
  }

  const cardUrl = `${baseUrl}/share-card.png`;
  const html = `<!doctype html>
<html lang="pt-PT"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Bumi" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(destination)}" />
<meta property="og:image" content="${escapeHtml(cardUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(cardUrl)}" />
<meta http-equiv="refresh" content="0;url=${escapeHtml(destination)}" />
</head><body><p>A abrir Bumi…</p><script>location.replace(${JSON.stringify(destination)});</script></body></html>`;

  res.status(200)
    .setHeader('content-type', 'text/html; charset=utf-8')
    .setHeader('cache-control', 'public, max-age=0, s-maxage=3600')
    .send(html);
}
