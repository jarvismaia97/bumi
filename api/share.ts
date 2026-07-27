import { getDailyChallengeDateKey } from '../src/game/challenge';
import { resolveLanguage, translate, type SupportedLanguage } from '../src/i18n/messages';

const APP_URL = process.env.BETTER_AUTH_URL ?? 'https://www.jogarbumi.pt';
const MAX_CAMPAIGN_LEVEL = 500;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function formatDailyDate(dateKey: string, language: SupportedLanguage): string {
  const date = new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(4, 6)) - 1, Number(dateKey.slice(6, 8)));
  return date.toLocaleDateString(language, { day: 'numeric', month: 'long' });
}

function first(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw : undefined;
}

export default function handler(req: any, res: any) {
  const kind = first(req.query.kind);
  const value = first(req.query.value);
  // `lang` is stamped on the URL by whoever shared it: the card is rendered once, server
  // side, so the receiver's device language cannot be consulted. It is deliberately not
  // forwarded to the app — once the link opens, the receiver's own setting should win.
  // Anything unexpected falls back through resolveLanguage rather than 500ing on a link.
  const language = resolveLanguage(first(req.query.lang));
  const baseUrl = APP_URL.replace(/\/$/, '');

  let title = translate(language, 'card.title');
  let description = translate(language, 'card.description');
  let destination = `${baseUrl}/`;

  if (kind === 'nivel') {
    const level = Number(value);
    if (Number.isInteger(level) && level >= 1 && level <= MAX_CAMPAIGN_LEVEL) {
      title = translate(language, 'card.levelTitle', { level });
      description = translate(language, 'card.levelDescription');
      destination = `${baseUrl}/?challenge=${level}`;
    }
  } else if (kind === 'diario') {
    const dateKey = getDailyChallengeDateKey(value);
    if (dateKey) {
      title = translate(language, 'card.dailyTitle', { date: formatDailyDate(dateKey, language) });
      description = translate(language, 'card.dailyDescription');
      destination = `${baseUrl}/?daily=${dateKey}`;
    }
  }

  const cardUrl = `${baseUrl}/share-card.png`;
  const html = `<!doctype html>
<html lang="${language}"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Bumi" />
<meta property="og:locale" content="${language === 'pt-PT' ? 'pt_PT' : 'en_GB'}" />
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
</head><body><p>${escapeHtml(translate(language, 'card.opening'))}</p><script>location.replace(${JSON.stringify(destination)});</script></body></html>`;

  res.status(200)
    .setHeader('content-type', 'text/html; charset=utf-8')
    .setHeader('cache-control', 'public, max-age=0, s-maxage=3600')
    .send(html);
}
