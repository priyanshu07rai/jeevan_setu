const { withSettingsGradle } = require('@expo/config-plugins');

const withMappls = (config) => {
  return withSettingsGradle(config, (config) => {
    // Prevent duplicate entries if plugin runs multiple times
    if (config.modResults.contents.includes('https://maven.mappls.com/repository/mappls/')) {
      return config;
    }

    const mavenStr = `
        maven { url 'https://maven.mappls.com/repository/mappls/' }`;

    // Injecting into dependencyResolutionManagement repositories block
    if (config.modResults.contents.includes('dependencyResolutionManagement {') && config.modResults.contents.includes('repositories {')) {
      // Find the inner repositories block inside dependencyResolutionManagement
      config.modResults.contents = config.modResults.contents.replace(
        /(dependencyResolutionManagement\s*\{[^}]*repositories\s*\{)/,
        `$1${mavenStr}`
      );
    } else {
       // Fallback for older gradle structures injecting into allprojects
       config.modResults.contents = config.modResults.contents.replace(
          /(allprojects\s*\{[^}]*repositories\s*\{)/,
          `$1${mavenStr}`
       );
    }

    return config;
  });
};

module.exports = withMappls;
