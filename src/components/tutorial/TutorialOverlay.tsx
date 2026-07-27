import { Pressable, StyleSheet, Text, View } from 'react-native';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import { useI18n } from '@/i18n';

/** Copy lives in the message catalogue under `tutorial.<lesson>.*`. */
const LESSONS = ['lesson1', 'lesson2', 'lesson3'] as const;

interface TutorialOverlayProps {
  visible: boolean;
  lessonIndex: number;
  readyToPlay: boolean;
  won: boolean;
  onStartLesson: () => void;
  onNextLesson: () => void;
  onPlayLevel1: () => void;
}

export function TutorialOverlay({ visible, lessonIndex, readyToPlay, won, onStartLesson, onNextLesson, onPlayLevel1 }: TutorialOverlayProps) {
  const { t } = useI18n();
  if (!visible) return null;

  const lesson = LESSONS[lessonIndex] ?? LESSONS.at(-1)!;
  const finalLesson = lessonIndex === LESSONS.length - 1;
  const title = won ? t(finalLesson ? 'tutorial.finalTitle' : 'tutorial.wonTitle') : t(`tutorial.${lesson}.title`);
  const body = won ? t(finalLesson ? 'tutorial.finalBody' : 'tutorial.wonBody') : t(`tutorial.${lesson}.body`);
  const button = won ? t(finalLesson ? 'tutorial.finalButton' : 'tutorial.wonButton') : t(`tutorial.${lesson}.button`);
  const onPress = won ? (finalLesson ? onPlayLevel1 : onNextLesson) : onStartLesson;

  if (readyToPlay && !won) return null;

  return (
    <View style={styles.card} pointerEvents="box-none">
      <View style={styles.inner}>
        <View style={styles.progress}>
          {LESSONS.map((_, index) => <View key={index} style={[styles.dot, { backgroundColor: index <= lessonIndex ? '#a8b9d8' : 'rgba(255,255,255,0.3)' }]} />)}
          <Text style={styles.progressText}>{lessonIndex + 1} / {LESSONS.length}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Pressable style={styles.button} onPress={onPress}>
          <Text style={styles.buttonText}>{button}</Text>
          <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 300 },
  inner: { backgroundColor: '#3a2d45', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32, maxWidth: 480, width: '100%', alignSelf: 'center' },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  progressText: { marginLeft: 'auto', fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.72)' },
  title: { fontSize: 17, fontWeight: '800', color: '#fffefd', marginBottom: 8 },
  body: { fontSize: 14, color: '#fffefd', opacity: 0.82, lineHeight: 21, marginBottom: 18 },
  button: { backgroundColor: '#718cc3', borderRadius: 8, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
