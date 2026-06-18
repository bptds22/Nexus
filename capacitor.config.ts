import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

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
      // Iter 7.47 — launchAutoHide:false → la native splash reste tant
      // que React ne l'a pas hidée manuellement via SplashScreen.hide().
      // Permet le handoff invisible vers SplashAnimMobile (X rouge centré
      // statique → animation React qui prend le relais).
      launchShowDuration: 3000,
      launchAutoHide: false,
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
    Keyboard: {
      resize: KeyboardResize.Body,
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
