import { useMemo } from 'react';
import { View } from 'react-native';
import { AVATAR_GRID, playerAvatar } from '@/lib/identity';

interface PlayerAvatarProps {
  userId: string | null | undefined;
  size?: number;
}

/** Mirrored mosaic derived from the account id — the player's stand-in for a photo. */
export function PlayerAvatarTile({ userId, size = 40 }: PlayerAvatarProps) {
  const { cells, fill, ink } = useMemo(() => playerAvatar(userId), [userId]);
  const padding = Math.round(size * 0.14);
  const cellSize = (size - padding * 2) / AVATAR_GRID;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        backgroundColor: fill,
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
                backgroundColor: cells[row * AVATAR_GRID + col] ? ink : 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
