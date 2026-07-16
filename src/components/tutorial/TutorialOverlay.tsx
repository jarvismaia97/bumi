import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TutStep {
  title: string;
  body: string;
  btn: string;
}

const TUT_STEPS: TutStep[] = [
  {
    title: 'Bem-vindo ao Bumi 🌴',
    body: 'O objetivo é dividir toda a grelha em retângulos — sem sobrepor e sem deixar espaços vazios.',
    btn: 'Continuar →',
  },
  {
    title: 'O número é uma pista',
    body: 'Cada número indica quantas casas o retângulo deve ter. O "3" ocupa 3 casas, o "4" ocupa 4 casas.',
    btn: 'Continuar →',
  },
  {
    title: 'Arrasta para criar',
    body: 'Toca e arrasta de um canto ao outro para criar um retângulo. Toca num retângulo já colocado para o apagar.',
    btn: 'Resolver o puzzle →',
  },
];

interface TutorialOverlayProps {
  visible: boolean;
  step: number;
  won: boolean;
  onNext: () => void;
  onPlayLevel1: () => void;
}

export function TutorialOverlay({ visible, step, won, onNext, onPlayLevel1 }: TutorialOverlayProps) {
  if (!visible) return null;

  if (won) {
    return (
      <View style={styles.card}>
        <View style={styles.inner}>
          <Text style={styles.title}>Fantástico! 🌴</Text>
          <Text style={styles.body}>Dominaste o tutorial! Agora vamos ao Nível 1 — desta vez sem dicas!</Text>
          <Pressable style={styles.btn} onPress={onPlayLevel1}>
            <Text style={styles.btnText}>Jogar Nível 1 →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const s = TUT_STEPS[step];
  return (
    <View style={styles.card}>
      <View style={styles.inner}>
        <View style={styles.dots}>
          {TUT_STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, { width: i === step ? 18 : 6, backgroundColor: i === step ? '#9b7bb8' : 'rgba(255,255,255,0.3)' }]} />
          ))}
        </View>
        <Text style={styles.title}>{s.title}</Text>
        <Text style={styles.body}>{s.body}</Text>
        <Pressable style={styles.btn} onPress={onNext}>
          <Text style={styles.btnText}>{s.btn}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 300 },
  inner: { backgroundColor: '#3a2d45', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32, maxWidth: 480, width: '100%', alignSelf: 'center' },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginBottom: 16 },
  dot: { height: 6, borderRadius: 3 },
  title: { fontSize: 17, fontWeight: '800', color: '#faf4fb', marginBottom: 8 },
  body: { fontSize: 14, color: '#faf4fb', opacity: 0.82, lineHeight: 21, marginBottom: 18 },
  btn: { backgroundColor: '#9b7bb8', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
