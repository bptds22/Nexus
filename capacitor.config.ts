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
    // 'never' (pas 'always') : la WKWebView ne s'inset PAS nativement → modèle
    // edge-to-edge (pendant bas de overlaysWebView en haut). env(safe-area-inset-*)
    // reporte alors les vraies valeurs et nos paddings CSS réservent le home
    // indicator. 'always' insétait le bas nativement → app coupée en bas + boutons
    // fixed tronqués (env bottom amputé).
    contentInset: 'never',
    backgroundColor: '#111317',
    // App-shell : la WKWebView ne scrolle/bounce plus ; le scroll vit dans
    // le <main> borné (height:100dvh, overflow-y:auto) de chaque layout.
    scrollEnabled: false,
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
      // overlay → la WebView s'étend sous la status bar / Dynamic Island
      // (le dégradé rouge du dashboard bleed jusqu'en haut). La config
      // seule est honorée de façon inconstante selon la version → fiabilisé
      // au runtime par StatusBarBootstrap (setOverlaysWebView + Android
      // transparent). backgroundColor est ignoré quand overlay=true ; côté
      // Android le runtime force #00000000 pour laisser le rouge transparaître.
      style: 'DARK',
      backgroundColor: '#111317',
      overlaysWebView: true,
    },
    FirebaseMessaging: {
      // Présentation foreground iOS (lue par @capacitor-firebase/messaging,
      // remplace l'ancien bloc PushNotifications de @capacitor/push-notifications).
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      // Option B : KeyboardResize.Native ne redimensionne PAS la WKWebView sur
      // iOS 26.5 (bug connu, aggravé par scrollEnabled:false). On passe en None
      // (aucun resize auto) et on gère le clavier manuellement via les events
      // keyboardWillShow/Hide → CSS var --kbd-h → padding-bottom du shell
      // (MessageThreadShell). Fiable et indépendant du resize natif cassé.
      resize: KeyboardResize.None,
    },
  },
  experimental: {
    ios: {
      spm: {
        // Évite une collision d'identité de package SwiftPM avec
        // @capacitor-firebase/messaging (recommandé par le plugin ;
        // nécessite Capacitor CLI ≥ 8.4.0 — on a 8.4.1). Re-`cap sync` après ajout.
        packageOptions: {
          '@capacitor-firebase/messaging': {
            symlink: true,
          },
        },
      },
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
