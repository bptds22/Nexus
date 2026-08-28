/* ═══════════════════════════════════════════════════════════════
   Push — deux responsabilités, désormais séparées.

   · attachPushListeners() : branche les écouteurs. Appelée AU BOOT,
     sans condition d'auth. C'est ce qui permet au tap d'être capté
     quand l'app démarre à froid, ou quand personne n'est connecté.
   · registerPush() : permission + jeton FCM + enregistrement en base.
     Reste STRICTEMENT derrière l'auth et onboarding_complete, comme
     avant (voir PushRegistrar).

   Pourquoi les séparer. Les deux plateformes retiennent l'événement
   de tap jusqu'à ce qu'un écouteur JS s'attache
   (notifyListeners(..., retainUntilConsumed: true), vérifié dans la
   source du plugin, Android comme iOS). Mais un événement retenu
   n'est utile que si un écouteur finit par exister : tant que
   l'attache dépendait de l'auth ET de l'onboarding, un tap reçu par
   un usager déconnecté n'était JAMAIS consommé. La scission ne rend
   pas le listener « plus rapide », elle le rend inconditionnel.

   Ce qui NE change pas : aucun jeton n'est demandé, lu ou écrit avant
   l'authentification. persistToken() refuse d'écrire sans session —
   garde explicite, pas une conséquence de l'ordre des appels.
═══════════════════════════════════════════════════════════════ */

import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { createClient } from '@/lib/supabase/client';
import { parsePushData, savePendingIntent } from '@/lib/push/pushIntent';

let currentToken: string | null = null;
let listenersAttached = false;

/** Événement interne consommé par PushDeepLinkConsumer (idiome maison :
 *  cf. nx-auth-ready, notifications-updated, activities-updated). */
export const PUSH_DEEPLINK_EVENT = 'nx-push-deeplink';

// Enregistre le token FCM via le MÊME RPC (register_device_token) — serveur
// inchangé. iOS comme Android renvoient désormais un token FCM (le pont
// APNs→FCM est géré nativement par @capacitor-firebase/messaging).
async function persistToken(token: string, platform: 'ios' | 'android') {
  const supabase = createClient();

  // GARDE D'AUTH. Depuis que `tokenReceived` est écouté dès le boot, une
  // rotation de jeton peut arriver AVANT toute connexion. register_device_token
  // lève « appel non authentifié » dans ce cas : on ne l'appelle donc pas.
  // Le jeton n'est pas perdu — registerPush() le relira via getToken() une
  // fois l'usager connecté et son onboarding terminé.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    console.log('[push] jeton reçu hors session — enregistrement différé');
    return;
  }

  currentToken = token;
  const { error } = await supabase.rpc('register_device_token', {
    p_token: token,
    p_platform: platform,
  });
  if (error) console.error('[push] register_device_token', error);
  else console.log('[push] token FCM enregistré');
}

/**
 * Branche les écouteurs push. Idempotent, natif uniquement, no-op web.
 * À appeler le plus tôt possible dans le boot — AUCUNE condition d'auth.
 */
export async function attachPushListeners(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;            // web : no-op
  if (listenersAttached) return;
  const platform = Capacitor.getPlatform();
  if (platform !== 'ios' && platform !== 'android') return;
  listenersAttached = true;

  // Un seul endroit dans l'app manipule ces écouteurs — d'où le nettoyage
  // ici, et nulle part ailleurs (un removeAllListeners() dans le flux jeton
  // décrocherait le deep-link au premier enregistrement).
  await FirebaseMessaging.removeAllListeners();

  // Rotation de token FCM → ré-enregistre (si session, cf. persistToken).
  await FirebaseMessaging.addListener('tokenReceived', (event) => {
    if (event?.token) void persistToken(event.token, platform);
  });

  // Arrivée au premier plan : pas de navigation (l'usager n'a rien demandé),
  // mais l'inbox doit cesser de mentir. L'invalidation est portée par le
  // consommateur, qui a le QueryClient.
  await FirebaseMessaging.addListener('notificationReceived', () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nx-push-received'));
    }
  });

  // LE TAP. Deux gestes, dans cet ordre : on DÉPOSE l'intention (elle doit
  // survivre à un boot complet), puis on prévient l'app vivante. Si personne
  // n'écoute — cold start, usager déconnecté — postLoginDispatch la trouvera.
  await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    void (async () => {
      const data = (event as { notification?: { data?: unknown } })?.notification?.data;
      const intent = parsePushData(data);
      if (!intent) {
        // Type inconnu ou data absent : comportement d'avant, on ne fait rien.
        console.log('[push] action sans intention exploitable', event);
        return;
      }
      await savePendingIntent(intent);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(PUSH_DEEPLINK_EVENT));
      }
    })();
  });
}

/**
 * Demande la permission, récupère le jeton FCM et l'enregistre.
 * Appelée UNIQUEMENT après authentification + onboarding_complete
 * (PushRegistrar) — ce contrat est inchangé.
 */
export async function registerPush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;            // web : no-op
  const platform = Capacitor.getPlatform();             // 'ios' | 'android'
  if (platform !== 'ios' && platform !== 'android') return;

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
