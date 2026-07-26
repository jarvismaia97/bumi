import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '@/state/themeStore';

export default function PrivacyScreen() {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={[styles.screen, { backgroundColor: theme.bg }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}>
      <Pressable style={[styles.back, { borderColor: theme.gridSep, backgroundColor: theme.surface }]} onPress={() => router.back()} accessibilityLabel="Voltar">
        <ArrowLeft size={19} color={theme.text} strokeWidth={2.3} />
      </Pressable>
      <Text style={[styles.title, { color: theme.text }]}>Política de privacidade</Text>
      <Text style={[styles.updated, { color: theme.sub }]}>Atualizada em 22 de julho de 2026</Text>

      <Section title="Dados que guardamos" theme={theme}>
        Quando entras com Google ou Apple, guardamos o nome, email e identificador da conta. Guardamos também o teu progresso, medalhas, dicas e desafios diários concluídos.
      </Section>
      <Section title="Para que servem" theme={theme}>
        Estes dados permitem sincronizar o jogo entre dispositivos, manter a tua progressão e disponibilizar apoio quando nos contactas.
      </Section>
      <Section title="Onde ficam" theme={theme}>
        Os dados são guardados numa base de dados protegida e só são usados para operar o Bumi. Não vendemos dados pessoais nem mostramos publicidade personalizada nesta versão.
      </Section>
      <Section title="Eliminar dados" theme={theme}>
        Podes eliminar a conta e todos os dados associados em Definições, dentro do jogo. A eliminação é permanente.
      </Section>
      <Section title="Contacto" theme={theme}>
        Para questões sobre privacidade ou suporte, escreve para suporte@jogarbumi.pt.
      </Section>
    </ScrollView>
  );
}

function Section({ title, children, theme }: { title: string; children: string; theme: { text: string; sub: string } }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.sub }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24 },
  back: { width: 38, height: 38, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  title: { fontSize: 28, fontWeight: '800' },
  updated: { fontSize: 12, marginTop: 5, marginBottom: 28 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 21 },
});
