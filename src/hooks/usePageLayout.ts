import { useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPageLayout, type PageLayoutOptions } from '../utils/responsive';

/** Apply frameStyle once per page; nested sections only need gutterStyle. */
export function usePageLayout(options: Pick<PageLayoutOptions, 'horizontalSafeAreaApplied' | 'tabletGutter'> = {}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = getPageLayout(width, {
    ...options,
    leftInset: insets.left,
    rightInset: insets.right,
  });
  const frameStyle: ViewStyle | undefined = layout.isPhone ? {
    width: layout.frameWidth,
    maxWidth: layout.frameWidth,
    alignSelf: 'center',
    marginLeft: layout.leftMargin,
    marginRight: layout.rightMargin,
  } : undefined;
  const gutterStyle: ViewStyle | undefined = layout.isPhone ? { paddingHorizontal: layout.gutter } : undefined;
  // For full-width surfaces (e.g. an auth hero) that keep their background
  // edge-to-edge and consume the horizontal safe area through padding.
  const insetStyle: ViewStyle | undefined = layout.isPhone ? {
    paddingLeft: layout.gutter + layout.leftMargin,
    paddingRight: layout.gutter + layout.rightMargin,
  } : undefined;
  const bleedStyle: ViewStyle | undefined = layout.isPhone ? { marginHorizontal: -layout.gutter } : undefined;
  // A SafeAreaView must keep its full outer width: it applies its own insets
  // inside that width. Use frameStyle on its children, never on that root.
  const safeAreaFrameStyle: ViewStyle | undefined = layout.isPhone ? {
    width: '100%', maxWidth: '100%', alignSelf: 'stretch',
  } : undefined;
  const contentStyle: ViewStyle | undefined = layout.isPhone ? {
    width: '100%', maxWidth: layout.contentWidth,
  } : undefined;
  return { ...layout, frameStyle, gutterStyle, insetStyle, bleedStyle, safeAreaFrameStyle, contentStyle };
}
