import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, Loader2 } from 'lucide-react';
import { AboutFamiliesView } from './components/AboutFamiliesView';
import { HomeView } from './components/HomeView';
import { MemberIdentityModal } from './components/MemberIdentityModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { StartupInstallPrompt } from './components/PWAInstallButton';
import { TopBar } from './components/TopBar';

const AdminPanelView = lazy(() =>
  import('./components/AdminPanelView').then((m) => ({ default: m.AdminPanelView }))
);
const FamilyChatView = lazy(() =>
  import('./components/FamilyChatView').then((m) => ({ default: m.FamilyChatView }))
);
const FamilyDetailView = lazy(() =>
  import('./components/FamilyDetailView').then((m) => ({ default: m.FamilyDetailView }))
);
const GalleryMomentsView = lazy(() =>
  import('./components/GalleryMomentsView').then((m) => ({ default: m.GalleryMomentsView }))
);
const SpecialFeaturesView = lazy(() =>
  import('./components/SpecialFeaturesView').then((m) => ({ default: m.SpecialFeaturesView }))
);
import { T } from './i18n';
import {
  DEFAULT_FAMILIES,
  DEFAULT_SITE_SETTINGS,
  apiFetch,
  isStaticModeActive,
} from './lib/staticFallback';
import type {
  AppNotification,
  BirthdayEntry,
  ChatMessage,
  Family,
  FamilyMember,
  FeatureSubTab,
  Lang,
  LocalProfile,
  PageTab,
  SiteSettings,
} from './types';

function loadOrCreateLocalProfile(): LocalProfile {
  try {
    const raw = localStorage.getItem('of_profile');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.clientId === 'string' && parsed.clientId) {
        return {
          clientId: parsed.clientId,
          name: typeof parsed.name === 'string' ? parsed.name : '',
          avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : '',
        };
      }
    }
  } catch {
    // ignore invalid storage
  }
  const clientId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const initial: LocalProfile = { clientId, name: '', avatarUrl: '' };
  try {
    localStorage.setItem('of_profile', JSON.stringify(initial));
  } catch {
    // ignore storage quota errors
  }
  return initial;
}

function playBellChime() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.12);
    gain2.gain.setValueAtTime(0.08, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch {
    // ignore autoplay restriction
  }
}

function getInitialTabFromPath(): PageTab {
  if (typeof window === 'undefined') return 'home';
  const p = window.location.pathname.toLowerCase();
  if (p === '/about' || p === '/families') return 'families';
  if (p === '/admin') return 'admin';
  if (p === '/events' || p === '/features') return 'features';
  if (p === '/chat') return 'chat';
  if (p === '/moments' || p === '/gallery') return 'moments';
  return 'home';
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('of_lang');
    return saved === 'si' ? 'si' : 'en';
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('of_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [localProfile, setLocalProfile] = useState<LocalProfile>(loadOrCreateLocalProfile);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<PageTab>(getInitialTabFromPath);
  const [featureSubTab, setFeatureSubTab] = useState<FeatureSubTab>('birthdays');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('family-1');

  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [families, setFamilies] = useState<Family[]>(DEFAULT_FAMILIES);
  const [allMembers, setAllMembers] = useState<FamilyMember[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayEntry[]>([]);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [bellPulse, setBellPulse] = useState(false);
  const [liveNotificationToast, setLiveNotificationToast] = useState<AppNotification | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [incomingChatMessage, setIncomingChatMessage] = useState<ChatMessage | null>(null);
  const [typingUser, setTypingUser] = useState<{ roomId: string; userName: string } | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [liveSyncNotice, setLiveSyncNotice] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const lastSyncVersionRef = useRef<number>(0);
  const typingTimeoutRef = useRef<number | null>(null);
  const syncToastTimeoutRef = useRef<number | null>(null);
  const bellPulseTimeoutRef = useRef<number | null>(null);
  const notifToastTimeoutRef = useRef<number | null>(null);
  const activeTabRef = useRef<PageTab>(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    localStorage.setItem('of_lang', lang);
    document.documentElement.lang = lang === 'si' ? 'si' : 'en';
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('of_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleSaveProfile = (next: LocalProfile) => {
    setLocalProfile(next);
    try {
      localStorage.setItem('of_profile', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await apiFetch('/api/bootstrap', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.siteSettings) {
          setSiteSettings((prev) => ({ ...prev, ...data.siteSettings }));
        }
        if (Array.isArray(data.families)) {
          setFamilies(data.families);
        }
        setUpcomingBirthdays(data.upcomingBirthdays || []);
        setAllMembers(data.allMembers || []);
      }
    } catch {
      // offline mode fallback
    }
  }, []);

  const loadExtras = useCallback(async () => {
    try {
      const [nRes, rRes] = await Promise.all([
        apiFetch('/api/notifications', {
          cache: 'no-store',
          headers: { 'x-client-id': localProfile.clientId },
        }),
        apiFetch('/api/chat/rooms', {
          cache: 'no-store',
          headers: { 'x-client-id': localProfile.clientId },
        }),
      ]);
      if (nRes.ok) {
        const nData = await nRes.json();
        setNotifications(nData.notifications || []);
      }
      if (rRes.ok) {
        const rData = await rRes.json();
        const totalUnread = (rData.rooms || []).reduce(
          (acc: number, r: any) => acc + (r.unreadCount || 0),
          0
        );
        setUnreadChatCount(totalUnread);
      }
    } catch {
      // ignore offline cache mode
    }
  }, [localProfile.clientId]);

  const triggerLiveResync = useCallback(
    (showToast = false) => {
      loadBootstrap();
      loadExtras();
      setRefreshSignal((s) => s + 1);
      if (showToast) {
        setLiveSyncNotice(true);
        if (syncToastTimeoutRef.current) window.clearTimeout(syncToastTimeoutRef.current);
        syncToastTimeoutRef.current = window.setTimeout(() => setLiveSyncNotice(false), 3000);
      }
    },
    [loadBootstrap, loadExtras]
  );

  useEffect(() => {
    loadBootstrap();
    loadExtras();
  }, [loadBootstrap, loadExtras]);

  // Resync immediately when a phone wakes up, gains focus, or comes back online
  useEffect(() => {
    const handleResync = () => {
      if (document.visibilityState === 'visible') {
        loadBootstrap();
        loadExtras();
        setRefreshSignal((s) => s + 1);
      }
    };
    window.addEventListener('visibilitychange', handleResync);
    window.addEventListener('focus', handleResync);
    window.addEventListener('online', handleResync);
    return () => {
      window.removeEventListener('visibilitychange', handleResync);
      window.removeEventListener('focus', handleResync);
      window.removeEventListener('online', handleResync);
    };
  }, [loadBootstrap, loadExtras]);

  // Lightweight safety-net version check so updates never get missed behind mobile proxies
  useEffect(() => {
    const checkVersion = async () => {
      if (document.visibilityState !== 'visible' || isStaticModeActive()) return;
      try {
        const res = await apiFetch('/api/sync-version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const serverVer = Number(data?.version || 0);
        if (!serverVer) return;
        if (lastSyncVersionRef.current === 0) {
          lastSyncVersionRef.current = serverVer;
        } else if (serverVer > lastSyncVersionRef.current) {
          lastSyncVersionRef.current = serverVer;
          triggerLiveResync(true);
        }
      } catch {
        // ignore offline polling failure
      }
    };

    checkVersion();
    const timer = window.setInterval(checkVersion, 3500);
    return () => window.clearInterval(timer);
  }, [triggerLiveResync]);

  // Same-device / cross-tab live sync listener for static hosting & offline mode
  useEffect(() => {
    const onStaticSync = () => {
      triggerLiveResync(false);
    };
    window.addEventListener('of:static-sync', onStaticSync);
    window.addEventListener('storage', onStaticSync);
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('of_static_sync');
        bc.onmessage = () => triggerLiveResync(true);
      } catch {
        bc = null;
      }
    }
    return () => {
      window.removeEventListener('of:static-sync', onStaticSync);
      window.removeEventListener('storage', onStaticSync);
      bc?.close();
    };
  }, [triggerLiveResync]);

  // Real-time WebSocket synchronization across all connected phones & devices
  useEffect(() => {
    let closed = false;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;

    const stopWs = () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (pingTimer) window.clearInterval(pingTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };

    const handleStaticMode = () => {
      stopWs();
    };
    window.addEventListener('of:static-mode', handleStaticMode);

    const connect = () => {
      if (closed || isStaticModeActive()) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (pingTimer) window.clearInterval(pingTimer);
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'ws:ready' || payload.type === 'pong') {
            const ver = Number(payload.version || 0);
            if (ver) {
              if (lastSyncVersionRef.current === 0) {
                lastSyncVersionRef.current = ver;
              } else if (ver > lastSyncVersionRef.current) {
                lastSyncVersionRef.current = ver;
                triggerLiveResync(false);
              }
            }
          } else if (payload.type === 'chat:message' && payload.message) {
            const ver = Number(payload.version || 0);
            if (ver > lastSyncVersionRef.current) lastSyncVersionRef.current = ver;
            setIncomingChatMessage(payload.message);
            if (
              payload.message.senderId !== localProfile.clientId &&
              activeTabRef.current !== 'chat'
            ) {
              setUnreadChatCount((c) => c + 1);
            }
          } else if (payload.type === 'chat:typing') {
            if (payload.clientId === localProfile.clientId) return;
            setTypingUser({ roomId: payload.roomId, userName: payload.userName });
            if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = window.setTimeout(() => setTypingUser(null), 2200);
          } else if (payload.type === 'notification:new' && payload.notification) {
            const ver = Number(payload.version || 0);
            if (ver > lastSyncVersionRef.current) lastSyncVersionRef.current = ver;
            const notif: AppNotification = payload.notification;
            setNotifications((prev) => {
              if (prev.some((x) => x.id === notif.id)) return prev;
              return [notif, ...prev];
            });
            if (payload.sourceClientId !== localProfile.clientId) {
              setBellPulse(true);
              playBellChime();
              setLiveNotificationToast(notif);
              if (bellPulseTimeoutRef.current) window.clearTimeout(bellPulseTimeoutRef.current);
              bellPulseTimeoutRef.current = window.setTimeout(() => setBellPulse(false), 4500);
              if (notifToastTimeoutRef.current) window.clearTimeout(notifToastTimeoutRef.current);
              notifToastTimeoutRef.current = window.setTimeout(
                () => setLiveNotificationToast(null),
                4500
              );
            }
          } else if (payload.type === 'data:sync') {
            const ver = Number(payload.version || 0);
            if (ver > lastSyncVersionRef.current) {
              lastSyncVersionRef.current = ver;
            }
            triggerLiveResync(payload.sourceClientId !== localProfile.clientId);
          }
        } catch {
          // ignore invalid frames
        }
      };

      ws.onerror = () => {
        // handled cleanly on reconnect
      };

      ws.onclose = () => {
        if (pingTimer) {
          window.clearInterval(pingTimer);
          pingTimer = null;
        }
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 1800);
        }
      };
    };

    connect();

    return () => {
      window.removeEventListener('of:static-mode', handleStaticMode);
      stopWs();
    };
  }, [localProfile.clientId, triggerLiveResync]);

  const handleSendTyping = (roomId: string, overrideUserName?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat:typing',
          roomId,
          clientId: localProfile.clientId,
          userName:
            (overrideUserName && overrideUserName.trim()) ||
            localProfile.name ||
            (lang === 'si' ? 'පවුලේ සාමාජික' : 'Family Member'),
        })
      );
    }
  };

  const handleMarkAllRead = async () => {
    const res = await apiFetch('/api/notifications/read-all', {
      method: 'POST',
      headers: { 'x-client-id': localProfile.clientId },
    });
    if (res.ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const openFamilyDetail = (familyId: string) => {
    setSelectedFamilyId(familyId);
    setActiveTab('family-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigate = (tab: PageTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const t = T[lang];

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f7] dark:bg-[#0f0f12] text-stone-900 dark:text-stone-100">
      <TopBar
        lang={lang}
        siteSettings={siteSettings}
        onToggleLang={() => setLang((l) => (l === 'en' ? 'si' : 'en'))}
        theme={theme}
        onToggleTheme={() => setTheme((th) => (th === 'light' ? 'dark' : 'light'))}
        activeTab={activeTab}
        onNavigate={navigate}
        localProfile={localProfile}
        onOpenProfileModal={() => setProfileModalOpen(true)}
        unreadChatCount={unreadChatCount}
        notifications={notifications}
        bellPulse={bellPulse}
        onMarkAllNotificationsRead={handleMarkAllRead}
        onSelectSearchMember={openFamilyDetail}
      />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab === 'family-detail' ? `family-detail-${selectedFamilyId}` : activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {activeTab === 'home' && (
              <HomeView
                lang={lang}
                siteSettings={siteSettings}
                families={families}
                allMembers={allMembers}
                upcomingBirthdays={upcomingBirthdays}
                localProfile={localProfile}
                onViewFamily={openFamilyDetail}
                onFamilyUpdated={(updated) =>
                  setFamilies((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
                }
                onSiteSettingsUpdated={setSiteSettings}
                onGoToAbout={() => navigate('families')}
                onOpenBirthdays={() => {
                  setFeatureSubTab('birthdays');
                  navigate('features');
                }}
                onWishSent={loadBootstrap}
              />
            )}

            {activeTab === 'families' && (
              <AboutFamiliesView
                lang={lang}
                siteSettings={siteSettings}
                families={families}
                allMembersCount={allMembers.length}
                localProfile={localProfile}
                onSelectFamily={openFamilyDetail}
                onFamilyUpdated={(updated) =>
                  setFamilies((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
                }
                onFamilyAdded={() => triggerLiveResync(false)}
                onOpenAdmin={() => navigate('admin')}
              />
            )}

            <Suspense
              fallback={
                <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center gap-2 text-sm text-stone-500">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-700" />
                  <span>{t.loading}</span>
                </div>
              }
            >
              {activeTab === 'family-detail' && (
                <FamilyDetailView
                  lang={lang}
                  familyId={selectedFamilyId}
                  families={families}
                  allMembers={allMembers}
                  localProfile={localProfile}
                  onBack={() => navigate('families')}
                  onFamilyUpdated={(updated) =>
                    setFamilies((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
                  }
                  refreshSignal={refreshSignal}
                />
              )}

              {activeTab === 'features' && (
                <SpecialFeaturesView
                  lang={lang}
                  families={families}
                  allMembers={allMembers}
                  localProfile={localProfile}
                  refreshSignal={refreshSignal}
                  initialSubTab={featureSubTab}
                />
              )}

              {activeTab === 'chat' && (
                <FamilyChatView
                  lang={lang}
                  families={families}
                  allMembers={allMembers}
                  localProfile={localProfile}
                  onOpenProfileModal={() => setProfileModalOpen(true)}
                  incomingMessage={incomingChatMessage}
                  typingUser={typingUser}
                  onSendTyping={handleSendTyping}
                  onUnreadCountChange={setUnreadChatCount}
                  refreshSignal={refreshSignal}
                />
              )}

              {activeTab === 'moments' && (
                <GalleryMomentsView
                  lang={lang}
                  families={families}
                  localProfile={localProfile}
                  refreshSignal={refreshSignal}
                />
              )}

              {activeTab === 'admin' && (
                <AdminPanelView
                  lang={lang}
                  siteSettings={siteSettings}
                  families={families}
                  allMembers={allMembers}
                  localProfile={localProfile}
                  onSiteSettingsUpdated={setSiteSettings}
                  onFamiliesChanged={() => triggerLiveResync(false)}
                  onSelectFamily={openFamilyDetail}
                />
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 mb-16 lg:mb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <img
              src="/emblem.png"
              alt="Our Families"
              className="w-9 h-9 rounded-full object-cover shrink-0 shadow-xs"
            />
            <div>
              <p className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                {(lang === 'si' ? siteSettings.siteTitleSi : siteSettings.siteTitleEn) || t.siteTitle}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{t.footerNote}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-medium text-stone-600 dark:text-stone-400">
            <button type="button" onClick={() => navigate('home')} className="hover:text-rose-700">
              {t.navHome}
            </button>
            <button type="button" onClick={() => navigate('families')} className="hover:text-rose-700">
              {t.navFamilies}
            </button>
            <button type="button" onClick={() => navigate('features')} className="hover:text-rose-700">
              {t.navFeatures}
            </button>
            <button type="button" onClick={() => navigate('chat')} className="hover:text-rose-700">
              {t.navChat}
            </button>
            <button type="button" onClick={() => navigate('moments')} className="hover:text-rose-700">
              {t.navMoments}
            </button>
            <button type="button" onClick={() => navigate('admin')} className="hover:text-rose-700">
              {t.navAdmin}
            </button>
          </div>
        </div>
      </footer>

      {profileModalOpen && (
        <MemberIdentityModal
          lang={lang}
          profile={localProfile}
          onSave={handleSaveProfile}
          onClose={() => setProfileModalOpen(false)}
        />
      )}

      <AnimatePresence>
        {liveNotificationToast && (
          <motion.button
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            type="button"
            onClick={() => {
              setLiveNotificationToast(null);
              navigate((liveNotificationToast.linkTab as PageTab) || 'home');
            }}
            className="fixed bottom-20 lg:bottom-5 right-4 z-50 max-w-xs text-left rounded-2xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-stone-900 px-4 py-3 shadow-xl flex items-start gap-3"
          >
            <span className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 animate-bounce" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                {lang === 'si' ? liveNotificationToast.titleSi : liveNotificationToast.titleEn}
              </p>
              <p className="text-[11px] text-stone-600 dark:text-stone-400 line-clamp-2 mt-0.5">
                {lang === 'si' ? liveNotificationToast.bodySi : liveNotificationToast.bodyEn}
              </p>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!liveNotificationToast && liveSyncNotice && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            role="status"
            className="fixed bottom-20 lg:bottom-5 right-4 z-50 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2.5 text-xs font-medium shadow-lg"
          >
            {t.liveUpdatedToast}
          </motion.div>
        )}
      </AnimatePresence>

      <StartupInstallPrompt lang={lang} />
      <OfflineIndicator lang={lang} />
    </div>
  );
}
