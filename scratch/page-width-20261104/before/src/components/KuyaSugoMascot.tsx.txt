import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, AppStateStatus, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';

// Both clips show the same capped chibi courier (artwork/kuya-sugo/render_chibi_wave_clip.py, render_story_clip.py).
const HELLO = require('../../assets/mascot/kuya-sugo-chibi-hello.webp');
const HELLO_STILL = require('../../assets/mascot/kuya-sugo-chibi-hello-wave.png');
const STORY = require('../../assets/mascot/kuya-sugo-story.webp');
const STORY_STILL = require('../../assets/mascot/kuya-sugo-story-thumbs-up.png');

const CLIPS = {
  wave: { animated: HELLO, still: HELLO_STILL, aspect: 6 / 7, hint: 'Tap to make Kuya Sugo wave again' },
  delivery: { animated: STORY, still: STORY_STILL, aspect: 2.2, hint: undefined },
};

export interface KuyaSugoMascotProps {
  height?: number;
  interactive?: boolean;
  onPress?: () => void;
  action?: 'wave' | 'greeting' | 'delivery';
  accessibilityHint?: string;
}

/**
 * Blender frame sequences of chibi Kuya Sugo; no 3D engine runs on the customer's phone.
 * 'delivery' fills the width of its parent with one looping clip: he walks in past the left edge, trips, picks the
 * parcel up, turns to give a thumbs-up and walks out past the right edge. Every other action is the 5-second wave.
 */
export default function KuyaSugoMascot({
  height = 176,
  interactive = true,
  onPress,
  action = 'wave',
  accessibilityHint,
}: KuyaSugoMascotProps) {
  const navigation = useNavigation();
  const [reducedMotion, setReducedMotion] = useState(true);
  const [motionKnown, setMotionKnown] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState ?? 'active');
  const [focused, setFocused] = useState(() => navigation.isFocused?.() ?? true);
  const [imageFailed, setImageFailed] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const lastPressRef = React.useRef(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReducedMotion(value);
    }).catch(() => {}).finally(() => {
      if (mounted) setMotionKnown(true);
    });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const app = AppState.addEventListener('change', setAppState);
    const focus = navigation.addListener('focus', () => setFocused(true));
    const blur = navigation.addListener('blur', () => setFocused(false));
    return () => { mounted = false; motion.remove(); app.remove(); focus(); blur(); };
  }, [navigation]);

  const handlePress = () => {
    const now = Date.now();
    if (now - lastPressRef.current < 400) return;
    lastPressRef.current = now;
    if (onPress) {
      onPress();
    }
    if (!reducedMotion && !imageFailed) {
      // Re-trigger playback of the waving animation
      setReplayKey(prev => prev + 1);
    }
  };

  const crossing = action === 'delivery';
  const clip = crossing ? CLIPS.delivery : CLIPS.wave;
  const playing = focused && appState === 'active' && !reducedMotion && !imageFailed;
  const source = playing ? clip.animated : clip.still;

  if (crossing) {
    // The lane keeps the screen's layout height; narrower phones letterbox the clip rather than crop his entrance.
    // Until the motion preference is known the lane stays empty, so the thumbs-up still never flashes before he walks in.
    return (
      <View testID="kuya-sugo-lane" style={[styles.lane, { height }]}>
        <Image
          testID="kuya-sugo-mascot"
          style={styles.image}
          source={motionKnown || imageFailed ? source : null}
          autoplay={playing}
          contentFit="contain"
          transition={0}
          accessible
          accessibilityLabel="Kuya Sugo, your Sugo Express helper"
          onError={() => setImageFailed(true)}
        />
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={interactive ? 0.85 : 1}
      onPress={interactive ? handlePress : undefined}
      disabled={!interactive}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityHint={accessibilityHint ?? (interactive ? clip.hint : undefined)}
      style={[styles.frame, { height, width: height * clip.aspect }]}
    >
      <Image
        key={replayKey}
        testID="kuya-sugo-mascot"
        style={styles.image}
        source={source}
        autoplay={playing}
        contentFit="contain"
        transition={0}
        accessible
        accessibilityLabel="Kuya Sugo, your Sugo Express helper"
        onError={() => setImageFailed(true)}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', marginBottom: 16 },
  lane: { width: '100%', marginBottom: 16 },
  image: { width: '100%', height: '100%' },
});
