const { withProjectBuildGradle } = require('@expo/config-plugins');

const withMappls = (config) => {
  return withProjectBuildGradle(config, (config) => {
    // Prevent duplicate entries
    if (config.modResults.contents.includes('https://maven.mappls.com/repository/mappls/')) {
      return config;
    }

    const mavenStr = `
        maven { url 'https://maven.mappls.com/repository/mappls/' }`;

    if (config.modResults.contents.includes('allprojects {')) {
      config.modResults.contents = config.modResults.contents.replace(
        /(allprojects\s*\{[^}]*repositories\s*\{)/,
        `$1${mavenStr}`
      );
    }
    
    return config;
  });
};

module.exports = withMappls;
