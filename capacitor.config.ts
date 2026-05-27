import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ca.nexussports.app',
  appName: 'Nexus',
  webDir: 'out',
  android: {
    allowMixedContent: false,
    backgroundColor: '#111317',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#111317',
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#111317',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#111317',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: false,
    // SPA fallback: any unresolved URL inside the WebView (e.g. a navigated
    // /coach/athletes/<real-id> that's not pre-rendered) serves index.html,
    // which then routes client-side via Next.js — required because
    // output:'export' only emits the sentinel /<segment>/placeholder.
    errorPath: 'index.html',
  },
};

export default config;
