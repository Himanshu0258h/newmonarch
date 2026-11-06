import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as Haptics from 'expo-haptics';

type Frame = { x: number; y: number; width: number; height: number };
type TileData = {
  key: string;
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sparkleSize: number;
  color: string;
  radius: number;
  delay: number;
  dx: number;
  dy: number;
  rotation: number;
  scale: number;
  sparkle: boolean;
};

type Props = {
  active: boolean;
  cardId: string;
  colors: readonly string[];
  card: ViewInstance | null;
  overlayRootRef: React.RefObject<ViewInstance | null>;
  closeGap: Animated.Value;
  onPrepareSnapshot: (cardId: string) => void;
  onCardHidden: (cardId: string, hidden: boolean) => void;
  onReducedMotionMode: (cardId: string, enabled: boolean) => void;
  onMeasureFailure: (cardId: string) => void;
  onComplete: (cardId: string) => void;
};

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function parseHexColor(color: string) {
  const hex = color.replace('#', '');
  if (!/^[\da-f]{6}$/i.test(hex)) return [0, 0, 0] as const;
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ] as const;
}

function gradientColor(colors: readonly string[], position: number) {
  if (colors.length < 2) return colors[0] ?? '#000000';
  const scaledPosition = Math.max(0, Math.min(1, position)) * (colors.length - 1);
  const stop = Math.min(Math.floor(scaledPosition), colors.length - 2);
  const progress = scaledPosition - stop;
  const from = parseHexColor(colors[stop]);
  const to = parseHexColor(colors[stop + 1]);
  const channels = from.map((value, index) =>
    Math.round(value + (to[index] - value) * progress)
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${channels.join('')}`;
}

function buildTiles(
  cardId: string,
  colors: readonly string[],
  width: number,
  height: number,
): TileData[] {
  const columns = 8;
  const rows = 12;
  const cellWidth = Math.ceil(width / columns);
  const cellHeight = Math.ceil(height / rows);
  const seed = Array.from(cardId).reduce((value, char) => value * 31 + char.charCodeAt(0), 17);
  const random = seededRandom(seed);
  const tiles: TileData[] = [];

  for (let row = 0; row < rows && tiles.length < 96; row += 1) {
    for (let column = 0; column < columns && tiles.length < 96; column += 1) {
      const normalizedX = (column + 0.5) / columns;
      const normalizedY = (row + 0.5) / rows;
      const gradientPosition = Math.max(
        0,
        Math.min(1, (0.95 * (normalizedX - 0.05) + normalizedY) / 1.9025),
      );
      const delay =
        0.45 * (normalizedX * 0.6 + (1 - normalizedY) * 0.4) + random() * 0.08;

      tiles.push({
        key: `${row}-${column}`,
        column,
        row,
        x: column * cellWidth,
        y: row * cellHeight,
        width: cellWidth + 1,
        height: cellHeight + 1,
        sparkleSize: 3 + random() * 2,
        color: gradientColor(colors, gradientPosition),
        radius:
          (column === 0 || column === columns - 1) &&
          (row === 0 || row === rows - 1)
            ? 22
            : 0,
        delay,
        dx: 20 + random() * 70,
        dy: -140 + random() * 120,
        rotation: -180 + random() * 360,
        scale: 0.1 + random() * 0.3,
        sparkle: random() < 0.06,
      });
    }
  }
  return tiles;
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

const ParticleTile = React.memo(function ParticleTile({
  tile,
  frame,
  snapshotUri,
  burst,
  useSnapshot,
}: {
  tile: TileData;
  frame: Frame;
  snapshotUri: string | null;
  burst: Animated.Value;
  useSnapshot: boolean;
}) {
  const fadeStart = tile.delay + (1 - tile.delay) * 0.35;
  const opacity = React.useMemo(
    () =>
      burst.interpolate({
        inputRange: [0, tile.delay, fadeStart, 1],
        outputRange: [1, 1, 0.8, 0],
        extrapolate: 'clamp',
      }),
    [burst, fadeStart, tile.delay],
  );
  const translateX = React.useMemo(
    () =>
      burst.interpolate({
        inputRange: [tile.delay, 1],
        outputRange: [0, tile.dx],
        extrapolate: 'clamp',
      }),
    [burst, tile.delay, tile.dx],
  );
  const translateY = React.useMemo(
    () =>
      burst.interpolate({
        inputRange: [tile.delay, 0.84, 1],
        outputRange: [0, tile.dy, tile.dy + 8],
        extrapolate: 'clamp',
      }),
    [burst, tile.delay, tile.dy],
  );
  const rotate = React.useMemo(
    () =>
      burst.interpolate({
        inputRange: [tile.delay, 1],
        outputRange: ['0deg', `${tile.rotation}deg`],
        extrapolate: 'clamp',
      }),
    [burst, tile.delay, tile.rotation],
  );
  const scale = React.useMemo(
    () =>
      burst.interpolate({
        inputRange: [tile.delay, 1],
        outputRange: [1, tile.scale],
        extrapolate: 'clamp',
      }),
    [burst, tile.delay, tile.scale],
  );
  const sparkleOpacity = React.useMemo(
    () =>
      burst.interpolate({
        inputRange: [
          tile.delay,
          tile.delay + (1 - tile.delay) * 0.25,
          tile.delay + (1 - tile.delay) * 0.37,
          1,
        ],
        outputRange: [0, 0, 0.8, 0],
        extrapolate: 'clamp',
      }),
    [burst, tile.delay],
  );

  return (
    <Animated.View
      renderToHardwareTextureAndroid
      style={[
        styles.tile,
        {
          left: frame.x + tile.x,
          top: frame.y + tile.y,
          width: tile.width,
          height: tile.height,
          borderRadius: tile.radius,
          opacity,
          transform: [
            { translateX },
            { translateY },
            { rotate },
            { scale },
          ],
        },
      ]}
    >
      {useSnapshot && snapshotUri ? (
        <Image
          source={{ uri: snapshotUri }}
          resizeMode="stretch"
          style={{
            position: 'absolute',
            width: frame.width,
            height: frame.height,
            left: -tile.x,
            top: -tile.y,
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tile.color }]} />
      )}
      {tile.sparkle ? (
        <Animated.View
          style={[
            styles.sparkle,
            {
              opacity: sparkleOpacity,
              width: tile.sparkleSize,
              height: tile.sparkleSize,
              borderRadius: tile.sparkleSize / 2,
              marginLeft: -tile.sparkleSize / 2,
              marginTop: -tile.sparkleSize / 2,
            },
          ]}
        />
      ) : null}
    </Animated.View>
  );
});

export default function CardDisintegrate({
  active,
  cardId,
  colors,
  card,
  overlayRootRef,
  closeGap,
  onPrepareSnapshot,
  onCardHidden,
  onReducedMotionMode,
  onMeasureFailure,
  onComplete,
}: Props) {
  const [frame, setFrame] = React.useState<Frame | null>(null);
  const [snapshotUri, setSnapshotUri] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const burst = React.useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  const completed = React.useRef(false);
  const gapStarted = React.useRef(false);
  const warningTriggered = React.useRef(false);
  const finishedAnimationCount = React.useRef(0);
  const tiles = React.useMemo(
    () => frame ? buildTiles(cardId, colors, frame.width, frame.height) : [],
    [cardId, colors, frame],
  );

  const finish = React.useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    onComplete(cardId);
  }, [cardId, onComplete]);

  const maybeFinish = React.useCallback(() => {
    if (finishedAnimationCount.current === 2) finish();
  }, [finish]);

  const startGapClose = React.useCallback(() => {
    if (gapStarted.current) return;
    gapStarted.current = true;
    Animated.spring(closeGap, {
      toValue: 1,
      damping: 20,
      stiffness: 170,
      mass: 0.9,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      finishedAnimationCount.current += 1;
      maybeFinish();
    });
  }, [closeGap, maybeFinish]);

  React.useEffect(() => {
    if (!active) {
      setFrame(null);
      setSnapshotUri(null);
      setReady(false);
      completed.current = false;
      gapStarted.current = false;
      warningTriggered.current = false;
      finishedAnimationCount.current = 0;
      burst.setValue(0);
      onReducedMotionMode(cardId, false);
      return;
    }
    if (reducedMotion === null) return;

    let cancelled = false;
    const root = overlayRootRef.current;
    if (!card || !root) {
      onMeasureFailure(cardId);
      return;
    }

    onPrepareSnapshot(cardId);
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        if (cancelled) return;
        try {
          let uri: string | null = null;
          if (!reducedMotion) {
            uri = await captureRef(card, {
              format: 'png',
              quality: 1,
              result: 'tmpfile',
            });
          }
          if (cancelled) {
            if (uri) releaseCapture(uri);
            return;
          }

          root.measureInWindow((rootX, rootY) => {
            card.measureInWindow((cardX, cardY, width, height) => {
              if (cancelled) {
                if (uri) releaseCapture(uri);
                return;
              }
              if (width <= 0 || height <= 0) {
                if (uri) releaseCapture(uri);
                onMeasureFailure(cardId);
                return;
              }

              setSnapshotUri(uri);
              setFrame({ x: cardX - rootX, y: cardY - rootY, width, height });
              onReducedMotionMode(cardId, reducedMotion);
              if (reducedMotion) {
                setReady(true);
              } else if (!uri) {
                onCardHidden(cardId, true);
                setReady(true);
              }
            });
          });
        } catch {
          if (cancelled) return;
          root.measureInWindow((rootX, rootY) => {
            card.measureInWindow((cardX, cardY, width, height) => {
              if (width <= 0 || height <= 0) {
                onMeasureFailure(cardId);
                return;
              }
              setSnapshotUri(null);
              setFrame({ x: cardX - rootX, y: cardY - rootY, width, height });
              onReducedMotionMode(cardId, reducedMotion);
              if (!reducedMotion) onCardHidden(cardId, true);
              setReady(true);
            });
          });
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    active,
    burst,
    cardId,
    card,
    onCardHidden,
    onMeasureFailure,
    onPrepareSnapshot,
    onReducedMotionMode,
    overlayRootRef,
    reducedMotion,
  ]);

  React.useEffect(() => {
    if (!active || !frame || !ready || reducedMotion === null) return;
    completed.current = false;
    gapStarted.current = false;
    warningTriggered.current = false;
    finishedAnimationCount.current = 0;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (reducedMotion) {
      startGapClose();
      Animated.timing(burst, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        finishedAnimationCount.current += 1;
        maybeFinish();
      });
      return;
    }

    const listener = burst.addListener(({ value }) => {
      if (value >= 0.12 && !warningTriggered.current) {
        warningTriggered.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      if (value >= 0.25) startGapClose();
    });

    Animated.timing(burst, {
      toValue: 1,
      duration: 950,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      burst.removeListener(listener);
      if (!finished) return;
      finishedAnimationCount.current += 1;
      maybeFinish();
    });

    return () => {
      burst.removeListener(listener);
    };
  }, [active, frame, ready, burst, maybeFinish, reducedMotion, startGapClose]);

  React.useEffect(() => {
    if (!snapshotUri) return;
    return () => releaseCapture(snapshotUri);
  }, [snapshotUri]);

  if (!active || !frame || reducedMotion !== false) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {tiles.map((tile) => (
        <ParticleTile
          key={tile.key}
          tile={tile}
          frame={frame}
          snapshotUri={snapshotUri}
          burst={burst}
          useSnapshot={snapshotUri !== null}
        />
      ))}
      {snapshotUri ? (
        <Image
          source={{ uri: snapshotUri }}
          onLoad={() => {
            if (!ready) {
              onCardHidden(cardId, true);
              setReady(true);
            }
          }}
          onError={() => {
            if (!ready) {
              setSnapshotUri(null);
              onCardHidden(cardId, true);
              setReady(true);
            }
          }}
          style={styles.snapshotPreloader}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
    elevation: 999,
  },
  tile: {
    position: 'absolute',
    overflow: 'hidden',
  },
  sparkle: {
    position: 'absolute',
    width: 4,
    height: 4,
    left: '50%',
    top: '50%',
    marginLeft: -2,
    marginTop: -2,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  snapshotPreloader: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
