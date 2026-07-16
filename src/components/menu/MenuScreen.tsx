import { Pressable, StyleSheet, Text, View } from 'react-native';
import { THEME_NAMES, THEMES, type ThemeName } from '@/theme/themes';
import { useThemeStore, useThemeTokens } from '@/state/themeStore';

interface MenuScreenProps {
  dailyDone: boolean;
  onStartGame: () => void;
  onStartDaily: () => void;
  onStartInfinite: () => void;
  onStartTraining: () => void;
}

const THEME_SWATCH_COLORS: Record<ThemeName, string> = {
  roxo:       '#9b7bb8',
  agua:       '#72cfa0',
  azulescuro: '#1a3a6a',
  rosa:       '#f4b8c8',
  amarelo:    '#f5c842',
};

const HOW_TO = [
  { strong: 'Desenha', rest: 'retângulos arrastando o dedo' },
  { strong: 'Cada número', rest: 'indica a área do retângulo' },
  { strong: 'Completa níveis', rest: 'para ganhar hints' },
];

export function MenuScreen({ dailyDone, onStartGame, onStartDaily, onStartInfinite, onStartTraining }: MenuScreenProps) {
  const theme = useThemeTokens();
  const { themeName, setTheme } = useThemeStore();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Bumi 🌴</Text>
      <Text style={[styles.sub, { color: theme.sub }]}>Divide a grelha em retângulos com os números.</Text>

      <View style={styles.howTo}>
        {HOW_TO.map((h, i) => (
          <View key={i} style={[styles.howToItem, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}>
            <Text style={[styles.howToText, { color: theme.text }]}>
              <Text style={styles.strong}>{h.strong}</Text> {h.rest}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.themeRow}>
        {THEME_NAMES.map(name => (
          <Pressable
            key={name}
            onPress={() => setTheme(name)}
            style={[
              styles.swatch,
              { backgroundColor: THEME_SWATCH_COLORS[name] },
              themeName === name && [styles.swatchActive, { borderColor: theme.text }],
            ]}
          />
        ))}
      </View>

      <View style={styles.menuBtns}>
        <Pressable
          style={[styles.dailyBtn, dailyDone && styles.dailyBtnDone]}
          onPress={onStartDaily}
        >
          <Text style={[styles.dailyBtnText, dailyDone && styles.dailyBtnTextDone]}>
            {dailyDone ? '✓ Desafio feito hoje' : '☀️ Desafio Diário'}
          </Text>
        </Pressable>
        <Pressable style={[styles.playBtn, { backgroundColor: theme.accent }]} onPress={onStartGame}>
          <Text style={styles.playBtnText}>Jogar →</Text>
        </Pressable>
      </View>

      <View style={styles.row2}>
        <Pressable style={styles.halfBtnBlue} onPress={onStartInfinite}>
          <Text style={styles.halfBtnBlueText}>∞ Modo Infinito</Text>
        </Pressable>
        <Pressable style={styles.halfBtnPink} onPress={onStartTraining}>
          <Text style={styles.halfBtnPinkText}>Modo Treino</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  sub: { fontSize: 12, textAlign: 'center', lineHeight: 17, maxWidth: 260, marginBottom: 8 },
  howTo: { gap: 6, width: '100%', maxWidth: 300, marginBottom: 8 },
  howToItem: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1.5 },
  howToText: { fontSize: 12, lineHeight: 17 },
  strong: { fontWeight: '700' },
  themeRow: { flexDirection: 'row', gap: 10, marginBottom: 20, justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: 'transparent' },
  swatchActive: { transform: [{ scale: 1.15 }] },
  cbSwatch: { alignItems: 'center', justifyContent: 'center' },
  cbSwatchText: { fontSize: 9, fontWeight: '800' },
  menuBtns: { gap: 7, width: '100%', maxWidth: 300 },
  dailyBtn: { backgroundColor: '#ffe870', borderWidth: 1.5, borderColor: '#f0c820', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  dailyBtnDone: { backgroundColor: '#e8f5ee', borderColor: '#90d0a0' },
  dailyBtnText: { fontSize: 15, fontWeight: '700', color: '#8a6000' },
  dailyBtnTextDone: { color: '#2e8a50' },
  playBtn: { borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  playBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  row2: { flexDirection: 'row', gap: 7, width: '100%', maxWidth: 300, marginTop: 7 },
  halfBtnBlue: { flex: 1, backgroundColor: '#c5e3ff', borderWidth: 1.5, borderColor: '#c0b8e8', borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  halfBtnBlueText: { fontSize: 13, fontWeight: '600', color: '#5060a0' },
  halfBtnPink: { flex: 1, backgroundColor: '#ffd6e0', borderWidth: 1.5, borderColor: '#ffb3c6', borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  halfBtnPinkText: { fontSize: 13, fontWeight: '600', color: '#b03060' },
});
