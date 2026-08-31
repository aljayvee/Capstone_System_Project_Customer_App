module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      "expo-secure-store",
      "expo-status-bar",
      "expo-navigation-bar",
      "expo-notifications",
      "expo-font"
    ],
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey,
      },
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          ...config.android?.config?.googleMaps,
          apiKey: googleMapsApiKey,
        },
      },
    },
  };
};
