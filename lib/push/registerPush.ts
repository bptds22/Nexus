import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { createClient } from '@/lib/supabase/client';

let currentToken: string | null = null;

export async function registerPush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;            // web : no-op
  const platform = Capacitor.getPlatform();             // 'ios' | 'android'
  if (platform !== 'ios' && platform !== 'android') return;

  // évite l'accumulation de listeners (ré-appel / hot reload)
  await PushNotifications.removeAllListeners();

  PushNotifications.addListener('registration', async (token) => {
    currentToken = token.value;
    const supabase = createClient();
    const { error } = await supabase.rpc('register_device_token', {
      p_token: token.value,
      p_platform: platform,
    });
    if (error) console.error('[push] register_device_token', error);
    else console.log('[push] token enregistré');
  });

  PushNotifications.addListener('registrationError', (err) =>
    console.error('[push] registrationError', err),
  );

  // premier plan + tap : log seulement (deep-link = Phase 6)
  PushNotifications.addListener('pushNotificationReceived', (n) =>
    console.log('[push] reçu (foreground)', n),
  );
  PushNotifications.addListener('pushNotificationActionPerformed', (a) =>
    console.log('[push] action', a),
  );

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive === 'granted') await PushNotifications.register();
  else console.log('[push] permission non accordée:', perm.receive);
}

// nettoyage au logout (à brancher plus tard)
export async function clearPushToken(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !currentToken) return;
  const supabase = createClient();
  await supabase.from('device_tokens').delete().eq('token', currentToken);
  currentToken = null;
}
