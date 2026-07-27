import { useLocales } from 'expo-localization';

export type SupportedLanguage = 'pt-PT' | 'en';
type Variables = Record<string, number | string>;

const messages: Record<SupportedLanguage, Record<string, string>> = {
  'pt-PT': {
    'auth.signInGoogle': 'Entrar com Google',
    'auth.opening': 'A abrir...',
    'auth.description': 'Entra para guardar progresso, sincronizar níveis resolvidos e continuar em qualquer dispositivo.',
    'menu.settings': 'Abrir definições',
    'menu.theme': 'Alterar tema. Tema atual: {theme}',
    'menu.solved': 'níveis resolvidos',
    'menu.gold': 'medalhas de ouro',
    'menu.islands': '{completed} / {total} ilhas descobertas',
    'menu.weeklyGoal': 'Meta da semana',
    'menu.remainingDaily': '{count} {label} em falta',
    'menu.dailyChallenge': 'desafio diário',
    'menu.dailyChallenges': 'desafios diários',
    'menu.weeklyDone': 'Meta semanal concluída',
    'menu.campaign': 'CAMPANHA',
    'menu.playAgain': 'Jogar novamente',
    'menu.startCampaign': 'Começar campanha',
    'menu.continueLevel': 'Continuar no nível {level}',
    'menu.levelsComplete': '{count} níveis concluídos',
    'menu.levelsExplore': '{count} níveis por explorar',
    'menu.dailyDone': 'Desafio feito hoje',
    'menu.daily': 'Desafio diário',
    'menu.streak': 'Sequência: {count} {label}',
    'menu.day': 'dia',
    'menu.days': 'dias',
    'menu.startStreak': 'Começa a tua sequência',
    'settings.title': 'Definições',
    'settings.syncing': 'A sincronizar progresso...',
    'settings.synced': 'Progresso sincronizado na tua conta.',
    'settings.offline': 'Progresso guardado neste dispositivo. Sincroniza quando voltares a ter rede.',
    'settings.retrying': 'A sincronização será tentada novamente automaticamente.',
    'settings.signOut': 'Sair da conta',
    'settings.privacySupport': 'PRIVACIDADE E SUPORTE',
    'settings.privacy': 'Política de privacidade',
    'settings.support': 'Contactar suporte',
    'settings.reminder': 'LEMBRETE',
    'settings.dailyReminder': 'Desafio diário',
    'settings.reminderTime': 'Todos os dias às 19:00',
    'settings.account': 'CONTA',
    'settings.delete': 'Eliminar conta e dados',
    'settings.deleteTitle': 'Eliminar conta?',
    'settings.deleteBody': 'O teu progresso guardado, medalhas e desafios concluídos serão apagados permanentemente.',
    'settings.cancel': 'Cancelar',
    'settings.deleteConfirm': 'Eliminar',
    'settings.permissionTitle': 'Permissão necessária',
    'settings.permissionBody': 'Ativa as notificações do Bumi nas definições do dispositivo para receberes o lembrete diário.',
    'settings.player': 'Jogador',
    'settings.playerHint': 'O teu nome de jogador no Bumi',
  },
  en: {
    'auth.signInGoogle': 'Continue with Google',
    'auth.opening': 'Opening...',
    'auth.description': 'Sign in to save your progress, sync solved levels and continue on any device.',
    'menu.settings': 'Open settings',
    'menu.theme': 'Change theme. Current theme: {theme}',
    'menu.solved': 'levels solved',
    'menu.gold': 'gold medals',
    'menu.islands': '{completed} / {total} islands discovered',
    'menu.weeklyGoal': 'Weekly goal',
    'menu.remainingDaily': '{count} {label} left',
    'menu.dailyChallenge': 'daily challenge',
    'menu.dailyChallenges': 'daily challenges',
    'menu.weeklyDone': 'Weekly goal complete',
    'menu.campaign': 'CAMPAIGN',
    'menu.playAgain': 'Play again',
    'menu.startCampaign': 'Start campaign',
    'menu.continueLevel': 'Continue at level {level}',
    'menu.levelsComplete': '{count} levels complete',
    'menu.levelsExplore': '{count} levels to explore',
    'menu.dailyDone': 'Daily challenge complete',
    'menu.daily': 'Daily challenge',
    'menu.streak': 'Streak: {count} {label}',
    'menu.day': 'day',
    'menu.days': 'days',
    'menu.startStreak': 'Start your streak',
    'settings.title': 'Settings',
    'settings.syncing': 'Syncing progress...',
    'settings.synced': 'Progress is synced to your account.',
    'settings.offline': 'Progress is saved on this device. It will sync when you are back online.',
    'settings.retrying': 'Sync will be retried automatically.',
    'settings.signOut': 'Sign out',
    'settings.privacySupport': 'PRIVACY AND SUPPORT',
    'settings.privacy': 'Privacy policy',
    'settings.support': 'Contact support',
    'settings.reminder': 'REMINDER',
    'settings.dailyReminder': 'Daily challenge',
    'settings.reminderTime': 'Every day at 19:00',
    'settings.account': 'ACCOUNT',
    'settings.delete': 'Delete account and data',
    'settings.deleteTitle': 'Delete account?',
    'settings.deleteBody': 'Your saved progress, medals and completed challenges will be permanently deleted.',
    'settings.cancel': 'Cancel',
    'settings.deleteConfirm': 'Delete',
    'settings.permissionTitle': 'Permission needed',
    'settings.permissionBody': 'Enable Bumi notifications in device settings to receive the daily reminder.',
    'settings.player': 'Player',
    'settings.playerHint': 'Your Bumi player name',
  },
};

export function resolveLanguage(languageCode: string | null | undefined): SupportedLanguage {
  return languageCode?.toLowerCase().startsWith('en') ? 'en' : 'pt-PT';
}

export function translate(language: SupportedLanguage, key: string, variables: Variables = {}): string {
  const template = messages[language][key] ?? messages['pt-PT'][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(variables[name] ?? `{${name}}`));
}

export function useI18n() {
  const locales = useLocales();
  const language = resolveLanguage(locales[0]?.languageCode);
  return {
    language,
    t: (key: string, variables?: Variables) => translate(language, key, variables),
  };
}
