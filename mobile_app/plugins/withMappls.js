const { withProjectBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

const withMappls = (config, props) => {
  // 1. Hook for android/build.gradle (Maven Repository)
  config = withProjectBuildGradle(config, (config) => {
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

  // 2. Hook for AndroidManifest.xml (Credentials)
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    
    const credentials = [
      { name: "com.mappls.sdk.maps.REST_API_KEY", value: props.restKey },
      { name: "com.mappls.sdk.maps.MAP_SDK_KEY", value: props.mapSDKKey || props.restKey },
      { name: "com.mappls.sdk.atlas.CLIENT_ID", value: props.clientId },
      { name: "com.mappls.sdk.atlas.CLIENT_SECRET", value: props.clientSecret }
    ];

    credentials.forEach(cred => {
      if (cred.value) {
        // Ensure meta-data array exists
        if (!mainApplication['meta-data']) {
          mainApplication['meta-data'] = [];
        }

        // Prevent duplicate entries
        const exists = mainApplication['meta-data'].some(item => item.$['android:name'] === cred.name);
        if (!exists) {
          mainApplication['meta-data'].push({
            $: {
              'android:name': cred.name,
              'android:value': cred.value
            }
          });
        }
      }
    });

    return config;
  });

  return config;
};

module.exports = withMappls;
