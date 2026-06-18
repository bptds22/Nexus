// Push notifications stub. Wired up once Firebase Cloud Messaging (Android)
// and APNs (iOS) are configured. For the first Android emulator build we
// don't need to register for push.

import { Capacitor } from '@capacitor/core';

export async function requestPushPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return false;
}
