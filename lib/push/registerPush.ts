import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { createClient } from '@/lib/supabase/client';

let currentToken: string | null = null;

// Enregistre le token FCM via le MÊME RPC (register_device_token) — serveur
// inchangé. iOS comme Android renvoient désormais un token FCM (le pont
// APNs→FCM est géré nativement par @capacitor-firebase/messaging).
async function persistToken(token: string, platform: 'ios' | 'android') {
  currentToken = token;
  const supabase = createClient();
  const { error } = await supabase.rpc('register_device_token', {
    p_token: token,
    p_platform: platform,
  });
  if (error) console.error('[push] register_device_token', error);
  else console.log('[push] token FCM enregistré');
}

export async function registerPush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;            // web : no-op
  const platform = Capacitor.getPlatform();             // 'ios' | 'android'
  if (platform !== 'ios' && platform !== 'android') return;

  // évite l'accumulation de listeners (ré-appel / hot reload)
  await FirebaseMessaging.removeAllListeners();

  // rotation de token FCM → ré-enregistre
  await FirebaseMessaging.addListener('tokenReceived', (event) => {
    if (event?.token) void persistToken(event.token, platform);
  });

  // premier plan + tap : log seulement (deep-link = Phase 6)
  await FirebaseMessaging.addListener('notificationReceived', (event) =>
    console.log('[push] reçu (foreground)', event),
  );
  await FirebaseMessaging.addListener('notificationActionPerformed', (event) =>
    console.log('[push] action', event),
  );

  // permission : check, puis request si encore à l'état 'prompt*'
  let perm = await FirebaseMessaging.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await FirebaseMessaging.requestPermissions();
  }
  if (perm.receive !== 'granted') {
    console.log('[push] permission non accordée:', perm.receive);
    return;
  }

  // token FCM explicite (iOS : déclenche l'enregistrement APNs en interne)
  try {
    const { token } = await FirebaseMessaging.getToken();
    if (token) await persistToken(token, platform);
  } catch (err) {
    console.error('[push] getToken', err);
  }
}

// nettoyage au logout (à brancher plus tard)
export async function clearPushToken(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !currentToken) return;
  const supabase = createClient();
  await supabase.from('device_tokens').delete().eq('token', currentToken);
  currentToken = null;
  try { await FirebaseMessaging.deleteToken(); } catch { /* no-op */ }
}
