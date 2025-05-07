const { getDefaultConfig } = require('@expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable package exports and add additional resolver settings
config.resolver.unstable_enablePackageExports = false;
config.resolver.unstable_conditionNames = ["require"];

// Add custom resolveRequest function
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "axios") {
    return context.resolveRequest(
      { ...context, unstable_conditionNames: ["browser"] },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Add transformer configuration
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
};

module.exports = config; 