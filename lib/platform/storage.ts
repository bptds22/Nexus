import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

export async function storageGet(key: string): Promise<string | null> {
  if (isNative) {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key });
    return value;
  }
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(key);
  }
  return null;
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (isNative) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
    return;
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, value);
  }
}

export async function storageRemove(key: string): Promise<void> {
  if (isNative) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key });
    return;
  }
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(key);
  }
}
