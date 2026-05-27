import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform();

export * from './storage';
export * from './haptics';
export * from './notifications';
export * from './app';
