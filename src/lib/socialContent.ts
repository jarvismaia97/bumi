import { createDailyChallengeUrl, getDailyChallengeDateKey } from '../game/challenge';

const HOOKS = [
  'Consegues ver o primeiro retângulo?',
  'Este puzzle parece fácil. Não é.',
  'Sem dicas: qual é o teu primeiro passo?',
  'Há uma única solução. Encontras-la?',
];

export interface DailySocialContent {
  dateKey: string;
  hook: string;
  title: string;
  caption: string;
  challengeUrl: string;
}

export function createDailySocialContent(dateKey: string, baseUrl: string): DailySocialContent {
  const validDateKey = getDailyChallengeDateKey(dateKey);
  if (!validDateKey) throw new Error('Invalid daily challenge date');

  const date = new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(4, 6)) - 1, Number(dateKey.slice(6, 8)));
  const label = date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
  const hook = HOOKS[Number(dateKey) % HOOKS.length];
  const challengeUrl = createDailyChallengeUrl(dateKey, baseUrl);

  return {
    dateKey,
    hook,
    title: `Bumi · Desafio diário ${label}`,
    caption: `${hook}\n\nResolve o desafio diário Bumi e compara a tua marca.\n${challengeUrl}\n\n#Bumi #Shikaku #PuzzleDeLogica #JogosDeRaciocinio`,
    challengeUrl,
  };
}
