import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Faint line-art for the gradient hero shared by LoginScreen and
 * RegisterScreen. Deliberately drawn rather than shipped as a PNG: it sits on a
 * gradient built from the theme's brand colour, and a flattened image would
 * carry a baked-in background edge.
 */
export default function AuthHeroPattern({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx={width - 30} cy={38} r={120} stroke="#FFFFFF" strokeOpacity={0.13} strokeWidth={1.5} fill="none" />
      <Circle cx={width - 30} cy={38} r={168} stroke="#FFFFFF" strokeOpacity={0.09} strokeWidth={1.5} fill="none" />
      <Circle cx={width - 30} cy={38} r={216} stroke="#FFFFFF" strokeOpacity={0.06} strokeWidth={1.5} fill="none" />
      <Circle cx={36} cy={height - 70} r={64} fill="#FFFFFF" fillOpacity={0.05} />
      <Path
        d={`M -20 ${height - 30} Q ${width * 0.45} ${height - 130} ${width + 20} ${height - 56}`}
        stroke="#FFFFFF"
        strokeOpacity={0.12}
        strokeWidth={1.5}
        fill="none"
      />
    </Svg>
  );
}
