import { useMemo } from 'react';
import { View } from 'react-native';
import { AVATAR_GRID, playerAvatar } from '@/lib/identity';

interface PlayerAvatarProps {
  userId: string | null | undefined;
  size?: number;
  /** The tier colour of an earned title, or nothing while none has been. */
  frame?: string;
}

/** Mirrored mosaic derived from the account id — the player's stand-in for a photo. */
/**
 * A border in React Native eats the content box, so the padding gives back exactly what the
 * frame takes. The mosaic comes out the same size framed or bare, and a row of avatars keeps
 * its rhythm as players earn their first title.
 */
export function avatarMetrics(size: number, framed: boolean) {
  const frameWidth = framed ? Math.max(2, Math.round(size * 0.06)) : 0;
  const padding = Math.max(0, Math.round(size * 0.14) - frameWidth);
  return { frameWidth, padding, cellSize: (size - frameWidth * 2 - padding * 2) / AVATAR_GRID };
}

export function PlayerAvatarTile({ userId, size = 40, frame }: PlayerAvatarProps) {
  const { cells, fill } = useMemo(() => playerAvatar(userId), [userId]);
  const { frameWidth, padding, cellSize } = avatarMetrics(size, !!frame);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        backgroundColor: fill,
        borderWidth: frameWidth,
        borderColor: frame,
        padding,
      }}
    >
      {Array.from({ length: AVATAR_GRID }).map((_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {Array.from({ length: AVATAR_GRID }).map((_, col) => (
            <View
              key={col}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: cells[row * AVATAR_GRID + col] ?? 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
