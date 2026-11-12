module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const existingPlugins = config.plugins || [];
  const additionalPlugins = [
    "expo-secure-store",
    "expo-status-bar",
    [
      "expo-navigation-bar",
      {
        "enforceContrast": false
      }
    ],
    "expo-font",
    "@react-native-google-signin/google-signin",
    "expo-updates"
  ];

  const existingNames = new Set(
    existingPlugins.map((p) => (Array.isArray(p) ? p[0] : p))
  );

  const filteredAdditional = additionalPlugins.filter((p) => {
    const name = Array.isArray(p) ? p[0] : p;
    return !existingNames.has(name);
  });

  return {
    ...config,
    plugins: [...existingPlugins, ...filteredAdditional],
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
