import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLanguageStore } from '@/state/languageStore';
import { TutorialOverlay } from './TutorialOverlay';

const noop = () => {};
const props = {
  lessonIndex: 0,
  readyToPlay: false,
  won: false,
  onStartLesson: noop,
  onNextLesson: noop,
  onPlayLevel1: noop,
};

afterEach(() => {
  useLanguageStore.setState({ preference: 'auto' });
});

describe('TutorialOverlay', () => {
  it('renders nothing when it is not the tutorial', () => {
    const { container } = render(<TutorialOverlay {...props} visible={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('gets out of the way once the player is ready to drag', () => {
    const { container } = render(<TutorialOverlay {...props} visible readyToPlay />);
    expect(container.innerHTML).toBe('');
  });

  it('comes back after a win so the player is told what happened', () => {
    render(<TutorialOverlay {...props} visible readyToPlay won />);
    expect(screen.getByText('Muito bem!')).toBeTruthy();
  });

  it('walks through the three lessons', () => {
    for (const [lessonIndex, expected] of [[0, 'Uma linha de cada vez'], [1, 'Agora um quadrado'], [2, 'Constrói o Bumi']] as const) {
      const { unmount } = render(<TutorialOverlay {...props} visible lessonIndex={lessonIndex} />);
      expect(screen.getByText(expected)).toBeTruthy();
      unmount();
    }
  });

  it('sends the player to level 1 only after the last lesson', () => {
    const { unmount } = render(<TutorialOverlay {...props} visible lessonIndex={1} won />);
    expect(screen.getByText('Próxima forma')).toBeTruthy();
    unmount();

    render(<TutorialOverlay {...props} visible lessonIndex={2} won />);
    expect(screen.getByText('Jogar nível 1')).toBeTruthy();
  });

  it('follows the language the player chose', () => {
    useLanguageStore.setState({ preference: 'en' });
    render(<TutorialOverlay {...props} visible />);
    expect(screen.getByText('One row at a time')).toBeTruthy();
    expect(screen.queryByText('Uma linha de cada vez')).toBeNull();
  });
});
