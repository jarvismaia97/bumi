import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { AZULEJO_LORE } from './lore';
import { getAzulejoMotif } from './patterns';

interface AzulejoToastProps {
  // Any value that changes each time a toast should (re)appear — e.g. the level index.
  // Using loreIndex alone wouldn't re-trigger the effect if two levels land on the same entry.
  triggerKey: string | number | null;
  loreIndex: number;
  patternIndex: number;
}

export function AzulejoToast({ triggerKey, loreIndex, patternIndex }: AzulejoToastProps) {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (triggerKey == null) return;
    setVisible(true);
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setVisible(false));
    }, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  if (!visible) return null;

  const n = AZULEJO_LORE.length;
  const lore = AZULEJO_LORE[((loreIndex % n) + n) % n];
  const { color } = getAzulejoMotif(patternIndex);

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <View style={[styles.preview, { backgroundColor: `rgb(${color})` }]} />
      <View style={styles.body}>
        <Text style={styles.name}>{lore.name}</Text>
        <Text style={styles.loc}>📍 {lore.loc}</Text>
        <Text style={styles.meta}>{lore.meta}</Text>
        <Text style={styles.fact}>{lore.fact}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderColor: '#d8e6f8',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  preview: { width: 52, height: 52, borderRadius: 8, borderWidth: 2, borderColor: '#1a3a70' },
  body: { flex: 1 },
  name: { fontWeight: '800', fontSize: 12.5, color: '#1a3a70', lineHeight: 16 },
  loc: { fontSize: 11, color: '#5a7ab0', marginTop: 3, marginBottom: 2 },
  meta: { fontSize: 10.5, color: '#999' },
  fact: { fontSize: 11, color: '#444', marginTop: 5, lineHeight: 15 },
});
