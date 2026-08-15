import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
import { createDailySocialContent } from '../src/lib/socialContent';
import { resolveLanguage, translate } from '../src/i18n/messages';
import { getDailyDateKey, getDailyLevel } from '../src/game/daily';
import { getDailyChallengeDateKey } from '../src/game/challenge';
import type { Level, SolutionRect } from '../src/game/types';

const WIDTH = 1080;
const HEIGHT = 1920;
const GRID_SIZE = 880;
const GRID_X = (WIDTH - GRID_SIZE) / 2;
const GRID_Y = 475;
const FRAMES_PER_SECOND = 30;
const RECT_COLORS = ['#f7e98a', '#a3d096', '#9eb3d4', '#ce9ac4', '#8bcfd4', '#aa9be0'];
const RECT_DEPTH_COLORS = ['#d9c95b', '#72ad70', '#708bb8', '#a86f9f', '#58a9af', '#776bbb'];
const RECT_DEPTH = 18;

type Stage = {
  label: string;
  headline: string;
  fromRects: number;
  toRects: number;
  duration: number;
};

/**
 * The value after `name`, or undefined. A value that itself starts with `--` is refused rather
 * than returned: `--date --lang pt` would otherwise read as the date `"--lang"`, and a date that
 * nonsensical is silently accepted downstream — the flag reads as present and the run produces a
 * clip for the wrong day.
 */
function parseArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${name} needs a value`);
  }
  return value;
}

function toDate(dateKey: string): Date {
  return new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(4, 6)) - 1, Number(dateKey.slice(6, 8)));
}

function xml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] ?? char);
}

function wrapText(value: string, maxLength = 26): string[] {
  const words = value.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function drawRect(rect: SolutionRect, index: number, cell: number, visibility: number): string {
  if (visibility <= 0) return '';

  const x = GRID_X + rect.c1 * cell + 5;
  const y = GRID_Y + rect.r1 * cell + 5;
  const width = (rect.c2 - rect.c1) * cell - 10;
  const height = (rect.r2 - rect.r1) * cell - 10;
  const eased = easeOutCubic(visibility);
  const scale = 0.82 + eased * 0.18;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const scaledX = x + (width - scaledWidth) / 2;
  const scaledY = y + (height - scaledHeight) / 2 - (1 - eased) * 26;
  const depthY = scaledY + RECT_DEPTH;

  return `<g opacity="${eased}">
    <rect x="${scaledX}" y="${depthY}" width="${scaledWidth}" height="${scaledHeight}" rx="22" fill="${RECT_DEPTH_COLORS[index % RECT_DEPTH_COLORS.length]}" />
    <rect x="${scaledX}" y="${scaledY}" width="${scaledWidth}" height="${scaledHeight}" rx="22" fill="${RECT_COLORS[index % RECT_COLORS.length]}" />
  </g>`;
}

function renderOpeningFrame(progress: number, cafeDataUri: string, cafeForegroundDataUri: string): string {
  const eased = easeOutCubic(progress);
  const scale = 1 + eased * 5;
  const focalX = 592;
  const focalY = 1190;
  const translateX = 540 - focalX * scale;
  const translateY = 960 - focalY * scale;
  const gameOpacity = clamp((progress - 0.22) / 0.48);
  const fadeToGame = clamp((progress - 0.84) / 0.16);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <clipPath id="phone-screen"><rect x="510" y="1058" width="164" height="253" rx="18" /></clipPath>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f7f3f0" />
  <g transform="translate(${translateX} ${translateY}) scale(${scale})">
    <image href="${cafeDataUri}" x="0" y="0" width="1080" height="1920" />
    <g clip-path="url(#phone-screen)" opacity="${gameOpacity}">
      <rect x="510" y="1058" width="164" height="253" fill="#f7f3f0" />
      <rect x="518" y="1068" width="72" height="71" rx="10" fill="#f7e98a" />
      <rect x="596" y="1068" width="69" height="114" rx="10" fill="#a3d096" />
      <rect x="518" y="1146" width="70" height="78" rx="10" fill="#9eb3d4" />
      <rect x="595" y="1189" width="70" height="113" rx="10" fill="#aa9be0" />
      <rect x="518" y="1231" width="70" height="71" rx="10" fill="#8bcfd4" />
    </g>
    <image href="${cafeForegroundDataUri}" x="0" y="0" width="1080" height="1920" />
  </g>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f7f3f0" opacity="${fadeToGame}" />
</svg>`;
}

function rectVisibility(index: number, stage: Stage, progress: number): number {
  if (index < stage.fromRects) return 1;
  if (index >= stage.toRects) return 0;
  const ordinal = index - stage.fromRects;
  const totalNew = Math.max(1, stage.toRects - stage.fromRects);
  return clamp((progress * totalNew - ordinal) * 1.7);
}

function renderFrame(level: Level, stage: Stage, progress: number, logoDataUri: string, callToAction: string): string {
  const cell = GRID_SIZE / level.size;
  const rects = level.solution
    .map((rect, index) => drawRect(rect, index, cell, rectVisibility(index, stage, progress)))
    .join('');
  const lines = wrapText(stage.headline, 20).slice(0, 2);
  const headline = lines.map((line, index) => `<text x="540" y="${350 + index * 88}" text-anchor="middle" class="headline">${xml(line)}</text>`).join('');
  const gridLines = Array.from({ length: level.size + 1 }, (_, index) => {
    const offset = index * cell;
    return `<path d="M ${GRID_X + offset} ${GRID_Y} V ${GRID_Y + GRID_SIZE} M ${GRID_X} ${GRID_Y + offset} H ${GRID_X + GRID_SIZE}" class="grid-line" />`;
  }).join('');
  const clues = level.clues.map(clue => {
    const x = GRID_X + (clue.c + 0.5) * cell;
    const y = GRID_Y + (clue.r + 0.62) * cell;
    return `<text x="${x}" y="${y}" text-anchor="middle" class="clue">${clue.v}</text>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <style>
    .brand { font-family: Arial, sans-serif; font-size: 68px; font-weight: 800; fill: #292827; }
    .eyebrow { font-family: Arial, sans-serif; font-size: 34px; font-weight: 800; letter-spacing: 6px; fill: #718cc3; }
    .headline { font-family: Arial, sans-serif; font-size: 88px; font-weight: 800; fill: #292827; }
    .grid-line { stroke: #e4ddd8; stroke-width: 4; }
    .clue { font-family: Arial, sans-serif; font-size: 68px; font-weight: 800; fill: #6685bb; }
    .footer { font-family: Arial, sans-serif; font-size: 44px; font-weight: 800; fill: #5b728f; }
    .label { font-family: Arial, sans-serif; font-size: 42px; font-weight: 800; fill: #ffffff; letter-spacing: 2px; }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f7f3f0" />
  <image href="${logoDataUri}" x="78" y="68" width="104" height="104" />
  <text x="202" y="140" class="brand">Bumi</text>
  <text x="540" y="215" text-anchor="middle" class="eyebrow">${xml(stage.label)}</text>
  ${headline}
  <rect x="${GRID_X - 2}" y="${GRID_Y + 22}" width="${GRID_SIZE + 4}" height="${GRID_SIZE + 4}" rx="30" fill="#d8d0cb" />
  <g transform="skewX(-0.7)">
    <rect x="${GRID_X - 2}" y="${GRID_Y - 2}" width="${GRID_SIZE + 4}" height="${GRID_SIZE + 4}" rx="30" fill="#fffefd" />
    ${gridLines}
    ${rects}
    ${clues}
  </g>
  <rect x="110" y="1530" width="860" height="124" rx="28" fill="#718cc3" />
  <text x="540" y="1608" text-anchor="middle" class="label">${xml(callToAction)}</text>
  <text x="540" y="1755" text-anchor="middle" class="footer">jogarbumi.pt</text>
</svg>`;
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status ?? 'unknown'}`);
}

function main() {
  const requestedDate = parseArgument('--date')?.replace(/-/g, '') ?? getDailyDateKey();
  const dateKey = getDailyChallengeDateKey(requestedDate);
  if (!dateKey) throw new Error('Use --date AAAAMMDD or AAAA-MM-DD');

  const outputRoot = resolve(parseArgument('--output') ?? 'content/social');
  const outputDir = join(outputRoot, dateKey);
  mkdirSync(outputDir, { recursive: true });

  // `--lang es` produces the Spanish clip; anything unrecognised resolves the same way the
  // app does, so a typo yields English rather than a half-translated video.
  const language = resolveLanguage(parseArgument('--lang') ?? 'pt-PT');
  const t = (key: string) => translate(language, key);

  const baseUrl = process.env.EXPO_PUBLIC_SHARE_URL ?? 'https://www.jogarbumi.pt';
  const content = createDailySocialContent(dateKey, baseUrl, language);
  const level = getDailyLevel(toDate(dateKey));
  const logoDataUri = `data:image/png;base64,${readFileSync(resolve('public/icon-512.png')).toString('base64')}`;
  const cafeDataUri = `data:image/png;base64,${readFileSync(resolve('assets/social/cafe-opening.png')).toString('base64')}`;
  const cafeForegroundDataUri = `data:image/png;base64,${readFileSync(resolve('assets/social/cafe-foreground-alpha.png')).toString('base64')}`;
  const stages: Stage[] = [
    { label: t('social.stageDaily'), headline: content.hook, fromRects: 0, toRects: 0, duration: 1.8 },
    { label: t('social.stageRule'), headline: t('social.ruleBody'), fromRects: 0, toRects: 0, duration: 1.6 },
    { label: t('social.stageFirst'), headline: t('social.firstBody'), fromRects: 0, toRects: 1, duration: 1.8 },
    { label: t('social.stageLink'), headline: t('social.linkBody'), fromRects: 1, toRects: Math.min(3, level.solution.length), duration: 2.2 },
    { label: t('social.stageSolution'), headline: t('social.solutionBody'), fromRects: Math.min(3, level.solution.length), toRects: level.solution.length, duration: 2.6 },
    { label: t('social.stageYourTurn'), headline: t('social.yourTurnBody'), fromRects: level.solution.length, toRects: level.solution.length, duration: 2 },
  ];
  const tempDir = mkdtempSync(join(tmpdir(), 'bumi-social-'));

  try {
    const framePaths: string[] = [];
    const openingFrameCount = Math.round(2 * FRAMES_PER_SECOND);
    for (let frame = 0; frame < openingFrameCount; frame++) {
      const index = framePaths.length;
      const svgPath = join(tempDir, `frame-${String(index).padStart(4, '0')}.svg`);
      const pngPath = join(tempDir, `frame-${String(index).padStart(4, '0')}.png`);
      writeFileSync(svgPath, renderOpeningFrame((frame + 1) / openingFrameCount, cafeDataUri, cafeForegroundDataUri));
      writeFileSync(pngPath, new Resvg(readFileSync(svgPath)).render().asPng());
      framePaths.push(pngPath);
    }
    for (const stage of stages) {
      const frameCount = Math.round(stage.duration * FRAMES_PER_SECOND);
      for (let frame = 0; frame < frameCount; frame++) {
        const index = framePaths.length;
        const svgPath = join(tempDir, `frame-${String(index).padStart(4, '0')}.svg`);
        const pngPath = join(tempDir, `frame-${String(index).padStart(4, '0')}.png`);
        const progress = stage.fromRects === stage.toRects ? 1 : (frame + 1) / frameCount;
        const svg = renderFrame(level, stage, progress, logoDataUri, t('social.cta'));
        writeFileSync(svgPath, svg);
        writeFileSync(pngPath, new Resvg(svg).render().asPng());
        framePaths.push(pngPath);
      }
    }

    const videoPath = join(outputDir, `bumi-desafio-${dateKey}.mp4`);
    run('ffmpeg', [
      '-y',
      '-framerate', String(FRAMES_PER_SECOND),
      '-i', join(tempDir, 'frame-%04d.png'),
      '-vf', 'fps=30,format=yuv420p',
      '-r', '30',
      '-crf', '18',
      '-preset', 'slow',
      '-movflags', '+faststart',
      videoPath,
    ]);

    const thumbnailPath = join(outputDir, `bumi-desafio-${dateKey}.png`);
    copyFileSync(framePaths.at(-1)!, thumbnailPath);
    writeFileSync(join(outputDir, 'caption.txt'), `${content.caption}\n`);
    writeFileSync(join(outputDir, 'metadata.json'), `${JSON.stringify({
      ...content,
      video: basename(videoPath),
      thumbnail: basename(thumbnailPath),
      durationSeconds: 2 + stages.reduce((total, stage) => total + stage.duration, 0),
      generatedAt: new Date().toISOString(),
    }, null, 2)}\n`);

    process.stdout.write(`Created ${videoPath}\n`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
