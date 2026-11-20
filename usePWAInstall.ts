import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __deferredPWAPrompt?: BeforeInstallPromptEvent | null;
  }
}

const INSTALLED_STORAGE_KEY = 'of_pwa_installed';
const INSTALLED_SYNC_EVENT = 'of:pwa-installed-change';

function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMatch = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const androidTwa = document.referrer?.startsWith('android-app://') ?? false;
  return standaloneMatch || iosStandalone || androidTwa;
}

function readStoredInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(INSTALLED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStoredInstalled(installed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (installed) {
      window.localStorage.setItem(INSTALLED_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(INSTALLED_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(INSTALLED_SYNC_EVENT, { detail: installed }));
  } catch {
    // ignore storage errors
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window !== 'undefined' ? window.__deferredPWAPrompt || null : null
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(
    () => isRunningStandalone() || readStoredInstalled()
  );
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  const markInstalled = useCallback(() => {
    setIsInstalled(true);
    window.__deferredPWAPrompt = null;
    setDeferredPrompt(null);
    writeStoredInstalled(true);
  }, []);

  useEffect(() => {
    const checkStandalone = () => {
      if (isRunningStandalone()) {
        writeStoredInstalled(true);
        setIsInstalled(true);
      } else if (readStoredInstalled()) {
        setIsInstalled(true);
      }
    };
    checkStandalone();

    // Check installed status on Chromium browsers supporting getInstalledRelatedApps
    const navWithRelated = window.navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<Array<{ platform?: string; url?: string }>>;
    };
    if (typeof navWithRelated.getInstalledRelatedApps === 'function') {
      navWithRelated
        .getInstalledRelatedApps()
        .then((apps) => {
          if (Array.isArray(apps) && apps.length > 0) {
            writeStoredInstalled(true);
            setIsInstalled(true);
          }
        })
        .catch(() => {
          // ignore unsupported browser context
        });
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);
    setIsAndroid(/android/.test(ua));

    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    if (window.__deferredPWAPrompt) {
      setDeferredPrompt(window.__deferredPWAPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__deferredPWAPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleEarlyPromptAvailable = () => {
      if (window.__deferredPWAPrompt) {
        setDeferredPrompt(window.__deferredPWAPrompt);
      }
    };

    const handleAppInstalled = () => {
      markInstalled();
    };

    const handleSyncInstalled = (e: Event) => {
      const next = (e as CustomEvent<boolean>).detail;
      setIsInstalled(Boolean(next) || isRunningStandalone());
    };

    const mql = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = () => checkStandalone();
    mql.addEventListener?.('change', handleDisplayChange);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handleEarlyPromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-app-installed', handleAppInstalled);
    window.addEventListener(INSTALLED_SYNC_EVENT, handleSyncInstalled);

    return () => {
      mql.removeEventListener?.('change', handleDisplayChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handleEarlyPromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-app-installed', handleAppInstalled);
      window.removeEventListener(INSTALLED_SYNC_EVENT, handleSyncInstalled);
    };
  }, [markInstalled]);

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptToUse = deferredPrompt || window.__deferredPWAPrompt;
    if (!promptToUse) return 'unavailable';
    try {
      await promptToUse.prompt();
      const { outcome } = await promptToUse.userChoice;
      window.__deferredPWAPrompt = null;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        markInstalled();
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      window.__deferredPWAPrompt = null;
      setDeferredPrompt(null);
      return 'unavailable';
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isInIframe,
    install,
    markInstalled,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
