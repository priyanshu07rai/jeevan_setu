const { withProjectBuildGradle, withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withMappls = (config, props) => {
  // 1. Hook for android/app/ (Licensing Stubs)
  // This ensures the build doesn't throw a GradleException if files are missing
  config = withAndroidManifest(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const appDir = path.join(projectRoot, 'android', 'app');
    
    // Create directory if it exists (it should after prebuild starts)
    if (fs.existsSync(appDir)) {
      const olfFile = path.join(appDir, 'stub.a.olf');
      const confFile = path.join(appDir, 'stub.a.conf');
      
      if (!fs.existsSync(olfFile)) {
        fs.writeFileSync(olfFile, 'STUB_DATA_FOR_COMPILATION_ONLY');
      }
      if (!fs.existsSync(confFile)) {
        fs.writeFileSync(confFile, 'STUB_DATA_FOR_COMPILATION_ONLY');
      }
    }
    return config;
  });

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

  // 2. Hook for gradle.properties (Mappls Config)
  config = withGradleProperties(config, (config) => {
    const properties = [
      { name: "com.mappls.reactnative.locationEngine", value: "default" },
      { name: "com.mappls.reactnative.mapplsAndroidSDK", value: "3.2.3" },
      { name: "com.mappls.reactnative.markerViewSDK", value: "3.1.20" },
      { name: "com.mappls.reactnative.annotationPluginSDK", value: "3.0.18" },
      { name: "com.mappls.reactnative.geoanalyticsPluginSDK", value: "3.0.42" },
      { name: "com.mappls.reactnative.minSdkVersion", value: "21" },
      { name: "com.mappls.reactnative.targetSdkVersion", value: "34" },
      { name: "com.mappls.reactnative.compileSdkVersion", value: "34" }
    ];

    properties.forEach(prop => {
      const index = config.modResults.findIndex(p => p.key === prop.name);
      if (index === -1) {
        config.modResults.push({ type: 'property', key: prop.name, value: prop.value });
      }
    });

    return config;
  });

  // 3. Hook for AndroidManifest.xml (Credentials)
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
