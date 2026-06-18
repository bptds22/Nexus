import { Capacitor } from '@capacitor/core';

export async function tap(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Light });
}

export async function tapMedium(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Medium });
}

export async function tapHeavy(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Heavy });
}

export async function notificationSuccess(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { Haptics, NotificationType } = await import('@capacitor/haptics');
  await Haptics.notification({ type: NotificationType.Success });
}

export async function notificationError(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { Haptics, NotificationType } = await import('@capacitor/haptics');
  await Haptics.notification({ type: NotificationType.Error });
}
