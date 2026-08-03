import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useI18n } from '@/i18n';
import { useAppearance, useAppearanceStore } from '@/state/appearanceStore';
import { markHydrated, resetHydrationForTests, useHydrated } from './hydration';

function Copy() {
  const { t, language } = useI18n();
  return <Text>{`${language}:${t('menu.settings')}`}</Text>;
}

function Flag() {
  return <Text>{useHydrated() ? 'hydrated' : 'waiting'}</Text>;
}

function Palette() {
  return <Text>{useAppearance()}</Text>;
}

describe('hydration gate', () => {
  afterEach(() => {
    markHydrated();
    useAppearanceStore.setState({ preference: 'auto' });
  });

  it('reports the static language until the tree has hydrated', () => {
    // The document is rendered with no locale, so its copy is Portuguese whatever the device
    // reports. Answering anything else on the first pass is what threw React #418.
    resetHydrationForTests(false);
    render(<Copy />);

    expect(screen.getByText('pt-PT:Abrir definições')).toBeTruthy();
  });

  it('paints the static appearance until the tree has hydrated', () => {
    // A saved `dark` is as unrenderable on the first pass as a dark device is: the document was
    // painted light, and React keeps the server's classes rather than repaint them.
    resetHydrationForTests(false);
    useAppearanceStore.setState({ preference: 'dark' });
    render(<Palette />);
    expect(screen.getByText('light')).toBeTruthy();

    act(() => markHydrated());

    expect(screen.getByText('dark')).toBeTruthy();
  });

  it('switches every subscriber in one go', () => {
    resetHydrationForTests(false);
    render(<Flag />);
    expect(screen.getByText('waiting')).toBeTruthy();

    act(() => markHydrated());

    expect(screen.getByText('hydrated')).toBeTruthy();
  });

  it('stays hydrated once marked, so a later mount does not flicker back', () => {
    resetHydrationForTests(false);
    markHydrated();
    render(<Flag />);

    expect(screen.getByText('hydrated')).toBeTruthy();
  });
});
