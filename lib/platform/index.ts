import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform();

export * from './storage';
/* './haptics' a été SUPPRIMÉ : 0 importateur direct, 0 importateur de ce baril,
   et aucun de ses noms (tap, tapMedium, tapHeavy, notificationSuccess,
   notificationError) n'était utilisé nulle part. Il n'avait surtout PAS de
   try/catch : un plugin qui lève y cassait l'action appelante. L'haptique vit
   désormais dans lib/haptics.ts, seul et unique helper. */
export * from './notifications';
export * from './app';
