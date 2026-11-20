import type {
  Announcement,
  AppNotification,
  BirthdayEntry,
  BirthdayWish,
  ChatMessage,
  ChatRoom,
  EventEntry,
  Family,
  FamilyMember,
  GalleryItem,
  MediaAsset,
  SiteSettings,
  TripEntry,
} from '../types';

export const DEFAULT_ABOUT_STORY_EN =
  'Our families stay connected across cities and generations — sharing milestones, birthdays, family trips, cherished photographs, and everyday moments together.';
export const DEFAULT_ABOUT_STORY_SI =
  'නගර හා පරම්පරා හරහා ආදරයෙන් බැඳුණු අපේ පවුල්වල සතුට, උපන්දින, චාරිකා, වටිනා ඡායාරූප සහ එදිනෙදා සුන්දර මතකයන් එකම තැනකින් බෙදාගනිමු.';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteTitleEn: 'OUR FAMILIES',
  siteTitleSi: 'අපේ පවුල්',
  heroKickerEn: 'Connected Families · Colombo · Kandy · Galle · Melbourne',
  heroKickerSi: 'සබැඳි පවුල් එකමුතුව · කොළඹ · මහනුවර · ගාල්ල · මෙල්බර්න්',
  heroPhotoUrl: '/src/assets/images/hero_family_gathering_1794925789784.jpg',
  welcomeEn:
    'Connected families bound by heritage, shared memories, celebrations, and love — always close across every mile.',
  welcomeSi:
    'ආදරයෙන්, සාමයෙන් සහ සුන්දර මතකයන්ගෙන් බැඳුණු අපේ පවුල්වල සදාතනික එකමුතුව.',
  aboutTitleEn: 'ABOUT OUR FAMILIES ❤️',
  aboutTitleSi: 'අපේ පවුල් ගැන ❤️',
  aboutStoryEn: DEFAULT_ABOUT_STORY_EN,
  aboutStorySi: DEFAULT_ABOUT_STORY_SI,
  updatedAt: new Date().toISOString(),
};

const FAMILY_COVER_IMAGES = [
  '/src/assets/images/hero_family_gathering_1794925789784.jpg',
  '/src/assets/images/feature_family_trip_1794925793319.jpg',
  '/src/assets/images/feature_birthday_celebration_1794925789421.jpg',
  '/src/assets/images/feature_special_events_1794925790435.jpg',
  '/src/assets/images/feature_family_trip_1794925793319.jpg',
  '/src/assets/images/feature_birthday_celebration_1794925789421.jpg',
  '/src/assets/images/hero_family_gathering_1794925789784.jpg',
  '/src/assets/images/feature_special_events_1794925790435.jpg',
];

export const DEFAULT_FAMILIES: Family[] = Array.from({ length: 8 }, (_, idx) => {
  const num = idx + 1;
  return {
    id: `family-${num}`,
    sortOrder: num,
    nameEn: `Family ${num}`,
    nameSi: `පවුල ${num}`,
    descriptionEn: '',
    descriptionSi: '',
    coverPhotoUrl: FAMILY_COVER_IMAGES[idx],
    memberCount: 0,
  };
});

interface StaticWishRecord extends BirthdayWish {
  targetKey: string;
}

interface StaticLikeRecord {
  targetType: string;
  targetId: string;
  clientId: string;
}

interface StaticNotificationRecord extends AppNotification {
  readBy: string[];
}

interface StaticDatabase {
  initialized?: boolean;
  version: number;
  siteSettings: SiteSettings;
  families: Family[];
  members: FamilyMember[];
  birthdays: Array<{
    id: string;
    familyId: string | null;
    memberName: string;
    birthDate: string;
    photoUrl: string;
    notes: string;
    createdAt: string;
  }>;
  wishes: StaticWishRecord[];
  trips: Array<TripEntry & { createdAt: string }>;
  events: Array<EventEntry & { createdAt: string }>;
  gallery: Array<GalleryItem & { createdAt: string }>;
  likes: StaticLikeRecord[];
  announcements: Announcement[];
  notifications: StaticNotificationRecord[];
  chatMessages: ChatMessage[];
  chatReadAt: Record<string, string>;
}

const STORAGE_KEY = 'of_static_db_v1';
const SYNC_CHANNEL_NAME = 'of_static_sync';
const IDB_NAME = 'of_media_v1';
const IDB_STORE = 'blobs';

let staticHostDetected = false;
let offlineFallbackActive = false;
let broadcastChannel: BroadcastChannel | null = null;

// Synchronous lookup maps between persisted "idb://<key>" and live "blob:..." object URLs
const idbToObjectUrl = new Map<string, string>();
const objectUrlToIdb = new Map<string, string>();
let mediaHydrated = false;

export function isStaticModeActive(): boolean {
  return staticHostDetected || offlineFallbackActive;
}

export function resetOfflineFallback(): void {
  offlineFallbackActive = false;
}

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return broadcastChannel;
}

function openMediaDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function storeBlobInIdb(key: string, blob: Blob): Promise<string | null> {
  const db = await openMediaDb();
  if (!db) return null;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const ref = `idb://${key}`;
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const prev = idbToObjectUrl.get(ref);
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          // ignore
        }
      }
      const objUrl = URL.createObjectURL(blob);
      idbToObjectUrl.set(ref, objUrl);
      objectUrlToIdb.set(objUrl, ref);
      return objUrl;
    }
    return ref;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function hydrateStaticMedia(): Promise<void> {
  if (mediaHydrated || typeof indexedDB === 'undefined' || typeof URL === 'undefined') return;
  mediaHydrated = true;
  const db = await openMediaDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        const key = String(cursor.key);
        const val = cursor.value;
        if (val instanceof Blob) {
          const ref = `idb://${key}`;
          if (!idbToObjectUrl.has(ref)) {
            const objUrl = URL.createObjectURL(val);
            idbToObjectUrl.set(ref, objUrl);
            objectUrlToIdb.set(objUrl, ref);
          }
        }
        cursor.continue();
      };
      req.onerror = () => resolve();
    });
  } catch {
    // ignore idb hydration failure
  } finally {
    db.close();
  }
}

function dehydrateUrl(url: string): string {
  if (!url) return url;
  return objectUrlToIdb.get(url) || url;
}

function hydrateUrl(url: string): string {
  if (!url) return url;
  return idbToObjectUrl.get(url) || url;
}

function transformUrlsDeep<T>(val: T, fn: (u: string) => string): T {
  if (typeof val === 'string') {
    if (val.startsWith('idb://') || val.startsWith('blob:')) {
      return fn(val) as unknown as T;
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => transformUrlsDeep(item, fn)) as unknown as T;
  }
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = transformUrlsDeep(v, fn);
    }
    return out as T;
  }
  return val;
}

function createInitialDb(): StaticDatabase {
  return {
    initialized: true,
    version: Date.now(),
    siteSettings: { ...DEFAULT_SITE_SETTINGS },
    families: DEFAULT_FAMILIES.map((f) => ({ ...f })),
    members: [],
    birthdays: [],
    wishes: [],
    trips: [],
    events: [],
    gallery: [],
    likes: [],
    announcements: [],
    notifications: [],
    chatMessages: [],
    chatReadAt: {},
  };
}

function mergeSiteSettings(partial?: Partial<SiteSettings>): SiteSettings {
  return {
    ...DEFAULT_SITE_SETTINGS,
    ...(partial || {}),
    heroPhotoUrl: partial?.heroPhotoUrl ?? DEFAULT_SITE_SETTINGS.heroPhotoUrl,
    welcomeEn: partial?.welcomeEn ?? DEFAULT_SITE_SETTINGS.welcomeEn,
    welcomeSi: partial?.welcomeSi ?? DEFAULT_SITE_SETTINGS.welcomeSi,
    aboutTitleEn: partial?.aboutTitleEn || DEFAULT_SITE_SETTINGS.aboutTitleEn,
    aboutTitleSi: partial?.aboutTitleSi || DEFAULT_SITE_SETTINGS.aboutTitleSi,
    aboutStoryEn: partial?.aboutStoryEn || DEFAULT_ABOUT_STORY_EN,
    aboutStorySi: partial?.aboutStorySi || DEFAULT_ABOUT_STORY_SI,
  };
}

function readDb(): StaticDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StaticDatabase>;
      const hasValidFamilies =
        parsed &&
        Array.isArray(parsed.families) &&
        (parsed.families.length > 0 || parsed.initialized === true);
      if (hasValidFamilies) {
        const merged: StaticDatabase = {
          ...createInitialDb(),
          ...parsed,
          initialized: true,
          siteSettings: mergeSiteSettings(parsed.siteSettings),
          families: parsed.families || [],
        };
        return transformUrlsDeep(merged, hydrateUrl);
      }
    }
  } catch {
    // ignore corrupted local storage
  }
  const initial = createInitialDb();
  writeDb(initial, false);
  return initial;
}

function writeDb(db: StaticDatabase, notify = true): void {
  db.initialized = true;
  db.version = Math.max(Date.now(), (db.version || 0) + 1);
  const persisted = transformUrlsDeep(db, dehydrateUrl);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // ignore storage quota exceeded errors
  }
  if (notify && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('of:static-sync', { detail: { version: db.version } }));
    try {
      getChannel()?.postMessage({ type: 'data:sync', version: db.version });
    } catch {
      // ignore channel post errors
    }
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDaysUntilBirthday(birthDate: string): number {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return 999;
  const [, mStr, dStr] = birthDate.split('-');
  const m = Number(mStr) - 1;
  const d = Number(dStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m, d);
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getHeader(init: RequestInit | undefined, name: string): string {
  const headers = init?.headers;
  if (!headers) return '';
  if (headers instanceof Headers) return headers.get(name) || '';
  if (Array.isArray(headers)) {
    const found = headers.find(([k]) => k.toLowerCase() === name.toLowerCase());
    return found ? found[1] : '';
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? record[key] || '' : '';
}

function getClientId(init?: RequestInit): string {
  return getHeader(init, 'x-client-id') || 'local-client';
}

function getAuthorName(init?: RequestInit): string {
  const raw = getHeader(init, 'x-author-name');
  if (!raw) return 'Family Member';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function parseBody(init?: RequestInit): Record<string, any> {
  if (!init?.body || typeof init.body !== 'string') return {};
  try {
    return JSON.parse(init.body) as Record<string, any>;
  } catch {
    return {};
  }
}

function withMemberCounts(db: StaticDatabase): Family[] {
  return [...db.families]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => ({
      ...f,
      memberCount: db.members.filter((m) => m.familyId === f.id).length,
    }));
}

function getLikeStats(db: StaticDatabase, targetType: string, targetId: string, clientId: string) {
  const matching = db.likes.filter((l) => l.targetType === targetType && l.targetId === targetId);
  return {
    likeCount: matching.length,
    likedByMe: matching.some((l) => l.clientId === clientId),
  };
}

function getUnifiedBirthdays(db: StaticDatabase, familyFilterId?: string): BirthdayEntry[] {
  const famMap = new Map(db.families.map((f) => [f.id, f]));
  const wishesFor = (key: string): BirthdayWish[] =>
    db.wishes
      .filter((w) => w.targetKey === key)
      .map(({ targetKey: _tk, ...rest }) => rest);

  const list: BirthdayEntry[] = [];

  for (const b of db.birthdays) {
    if (familyFilterId && b.familyId !== familyFilterId) continue;
    const fam = b.familyId ? famMap.get(b.familyId) : undefined;
    const targetKey = `birthday-${b.id}`;
    list.push({
      id: b.id,
      targetKey,
      source: 'birthday',
      memberName: b.memberName,
      birthDate: b.birthDate,
      familyId: b.familyId,
      familyNameEn: fam?.nameEn || '',
      familyNameSi: fam?.nameSi || '',
      photoUrl: b.photoUrl,
      notes: b.notes,
      wishes: wishesFor(targetKey),
    });
  }

  for (const m of db.members) {
    if (!m.birthday || !m.birthday.trim()) continue;
    if (familyFilterId && m.familyId !== familyFilterId) continue;
    const fam = famMap.get(m.familyId);
    const targetKey = `member-${m.id}`;
    list.push({
      id: m.id,
      targetKey,
      source: 'member',
      memberName: m.name,
      birthDate: m.birthday,
      familyId: m.familyId,
      familyNameEn: fam?.nameEn || '',
      familyNameSi: fam?.nameSi || '',
      photoUrl: m.photoUrl,
      notes: m.relationship,
      wishes: wishesFor(targetKey),
    });
  }

  return list.sort(
    (a, b) => getDaysUntilBirthday(a.birthDate) - getDaysUntilBirthday(b.birthDate)
  );
}

function pushNotification(
  db: StaticDatabase,
  params: {
    titleEn: string;
    titleSi: string;
    bodyEn: string;
    bodySi: string;
    linkTab: string;
    sourceClientId: string;
  }
) {
  db.notifications.unshift({
    id: uid('notif'),
    titleEn: params.titleEn,
    titleSi: params.titleSi,
    bodyEn: params.bodyEn,
    bodySi: params.bodySi,
    linkTab: params.linkTab,
    isRead: false,
    createdAt: new Date().toISOString(),
    readBy: [params.sourceClientId],
  });
  if (db.notifications.length > 50) {
    db.notifications = db.notifications.slice(0, 50);
  }
}

async function compressFileToDataUrl(file: File): Promise<string> {
  if (file.type.startsWith('image/')) {
    try {
      const objectUrl = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Failed to decode image'));
          el.src = objectUrl;
        });
        const maxDim = 1200;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.8);
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      // fall through
    }
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(transformUrlsDeep(data, hydrateUrl)), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleStaticApi(pathname: string, searchParams: URLSearchParams, init?: RequestInit): Promise<Response> {
  await hydrateStaticMedia();
  const method = (init?.method || 'GET').toUpperCase();
  const clientId = getClientId(init);
  const authorName = getAuthorName(init);
  const db = readDb();

  if (pathname === '/api/health' && method === 'GET') {
    return jsonResponse({ ok: true, status: 'static-fallback' });
  }

  if (pathname === '/api/sync-version' && method === 'GET') {
    return jsonResponse({ version: db.version });
  }

  if (pathname === '/api/bootstrap' && method === 'GET') {
    const families = withMemberCounts(db);
    const famMap = new Map(families.map((f) => [f.id, f]));
    const allMembers = db.members.map((m) => ({
      ...m,
      familyNameEn: famMap.get(m.familyId)?.nameEn || '',
      familyNameSi: famMap.get(m.familyId)?.nameSi || '',
    }));
    const upcomingBirthdays = getUnifiedBirthdays(db).filter(
      (b) => getDaysUntilBirthday(b.birthDate) <= 30
    );
    return jsonResponse({
      siteSettings: db.siteSettings,
      families,
      upcomingBirthdays,
      allMembers,
    });
  }

  if (pathname === '/api/site-settings' && method === 'PATCH') {
    const body = parseBody(init);
    db.siteSettings = {
      siteTitleEn:
        typeof body.siteTitleEn === 'string' ? body.siteTitleEn : db.siteSettings.siteTitleEn,
      siteTitleSi:
        typeof body.siteTitleSi === 'string' ? body.siteTitleSi : db.siteSettings.siteTitleSi,
      heroKickerEn:
        typeof body.heroKickerEn === 'string' ? body.heroKickerEn : db.siteSettings.heroKickerEn,
      heroKickerSi:
        typeof body.heroKickerSi === 'string' ? body.heroKickerSi : db.siteSettings.heroKickerSi,
      heroPhotoUrl:
        typeof body.heroPhotoUrl === 'string' ? body.heroPhotoUrl : db.siteSettings.heroPhotoUrl,
      welcomeEn: typeof body.welcomeEn === 'string' ? body.welcomeEn : db.siteSettings.welcomeEn,
      welcomeSi: typeof body.welcomeSi === 'string' ? body.welcomeSi : db.siteSettings.welcomeSi,
      aboutTitleEn:
        typeof body.aboutTitleEn === 'string' ? body.aboutTitleEn : db.siteSettings.aboutTitleEn,
      aboutTitleSi:
        typeof body.aboutTitleSi === 'string' ? body.aboutTitleSi : db.siteSettings.aboutTitleSi,
      aboutStoryEn:
        typeof body.aboutStoryEn === 'string' ? body.aboutStoryEn : db.siteSettings.aboutStoryEn,
      aboutStorySi:
        typeof body.aboutStorySi === 'string' ? body.aboutStorySi : db.siteSettings.aboutStorySi,
      updatedAt: new Date().toISOString(),
    };
    pushNotification(db, {
      titleEn: 'Site Settings Updated',
      titleSi: 'වෙබ් අඩවි තොරතුරු යාවත්කාලීන විය',
      bodyEn: `${authorName} updated the portal settings or welcome message.`,
      bodySi: `${authorName} වෙබ් අඩවි තොරතුරු හෝ පිළිගැනීමේ පණිවිඩය වෙනස් කළේය.`,
      linkTab: 'home',
      sourceClientId: clientId,
    });
    writeDb(db);
    return jsonResponse(db.siteSettings);
  }

  if (pathname === '/api/upload' && method === 'POST') {
    if (init?.body instanceof FormData) {
      const file = init.body.get('file');
      if (file instanceof File) {
        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|ogg|3gp)$/i.test(file.name);
        // Store large media directly in IndexedDB so localStorage 5MB limit never breaks uploads
        const idbUrl = await storeBlobInIdb(uid('media'), file);
        const url = idbUrl || (await compressFileToDataUrl(file));
        return jsonResponse({
          url,
          type: isVideo ? 'video' : 'image',
          name: file.name,
        });
      }
    }
    return jsonResponse({ error: 'No file uploaded' }, 400);
  }

  if (pathname === '/api/members/search' && method === 'GET') {
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    if (!q) return jsonResponse({ members: [] });
    const famMap = new Map(db.families.map((f) => [f.id, f]));
    const members = db.members
      .filter((m) => {
        const fam = famMap.get(m.familyId);
        return (
          m.name.toLowerCase().includes(q) ||
          m.relationship.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          (fam?.nameEn || '').toLowerCase().includes(q) ||
          (fam?.nameSi || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 25)
      .map((m) => ({
        ...m,
        familyNameEn: famMap.get(m.familyId)?.nameEn || '',
        familyNameSi: famMap.get(m.familyId)?.nameSi || '',
      }));
    return jsonResponse({ members });
  }

  if (pathname === '/api/families' && method === 'POST') {
    const body = parseBody(init);
    const cleanEn = typeof body.nameEn === 'string' ? body.nameEn.trim() : '';
    const cleanSi = typeof body.nameSi === 'string' ? body.nameSi.trim() : '';
    if (!cleanEn && !cleanSi) {
      return jsonResponse({ error: 'Family name is required' }, 400);
    }
    const maxOrder = db.families.reduce((acc, f) => Math.max(acc, f.sortOrder), 0);
    const family: Family = {
      id: uid('family'),
      sortOrder:
        typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
          ? body.sortOrder
          : maxOrder + 1,
      nameEn: cleanEn || cleanSi,
      nameSi: cleanSi || cleanEn,
      descriptionEn: typeof body.descriptionEn === 'string' ? body.descriptionEn : '',
      descriptionSi: typeof body.descriptionSi === 'string' ? body.descriptionSi : '',
      coverPhotoUrl: typeof body.coverPhotoUrl === 'string' ? body.coverPhotoUrl : '',
      memberCount: 0,
    };
    db.families.push(family);
    pushNotification(db, {
      titleEn: `New Family Added: ${family.nameEn}`,
      titleSi: `නව පවුලක් එක් විය: ${family.nameSi}`,
      bodyEn: `${authorName} added ${family.nameEn} to Our Families.`,
      bodySi: `${authorName} ${family.nameSi} පවුල එක් කළේය.`,
      linkTab: 'families',
      sourceClientId: clientId,
    });
    writeDb(db);
    return jsonResponse({ family }, 201);
  }

  if (pathname === '/api/families/reorder' && method === 'POST') {
    const body = parseBody(init);
    const orderedIds = Array.isArray(body.orderedIds) ? (body.orderedIds as string[]) : [];
    const orderMap = new Map(orderedIds.map((id, idx) => [String(id), idx + 1]));
    db.families = db.families.map((f) =>
      orderMap.has(f.id) ? { ...f, sortOrder: orderMap.get(f.id)! } : f
    );
    writeDb(db);
    return jsonResponse({ ok: true });
  }

  const familyMembersMatch = pathname.match(/^\/api\/families\/([^/]+)\/members$/);
  if (familyMembersMatch && method === 'POST') {
    const familyId = decodeURIComponent(familyMembersMatch[1]);
    const fam = db.families.find((f) => f.id === familyId);
    if (!fam) return jsonResponse({ error: 'Family not found' }, 404);
    const body = parseBody(init);
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return jsonResponse({ error: 'Member name is required' }, 400);
    }
    const member: FamilyMember = {
      id: uid('mem'),
      familyId,
      name: body.name.trim(),
      relationship: typeof body.relationship === 'string' && body.relationship ? body.relationship : 'Other',
      birthday: typeof body.birthday === 'string' ? body.birthday : '',
      photoUrl: typeof body.photoUrl === 'string' ? body.photoUrl : '',
      description: typeof body.description === 'string' ? body.description : '',
      familyNameEn: fam.nameEn,
      familyNameSi: fam.nameSi,
    };
    db.members.push(member);
    pushNotification(db, {
      titleEn: 'New Family Member Added',
      titleSi: 'නව පවුලේ සාමාජිකයෙකු එක් විය',
      bodyEn: `${authorName} added ${member.name} to ${fam.nameEn}.`,
      bodySi: `${authorName} ${fam.nameSi} වෙත ${member.name} එක් කළේය.`,
      linkTab: 'families',
      sourceClientId: clientId,
    });
    writeDb(db);
    return jsonResponse({ member }, 201);
  }

  const familyMatch = pathname.match(/^\/api\/families\/([^/]+)$/);
  if (familyMatch) {
    const familyId = decodeURIComponent(familyMatch[1]);
    const idx = db.families.findIndex((f) => f.id === familyId);
    if (idx === -1) return jsonResponse({ error: 'Family not found' }, 404);

    if (method === 'GET') {
      const fam = withMemberCounts(db).find((f) => f.id === familyId)!;
      const members = db.members
        .filter((m) => m.familyId === familyId)
        .map((m) => ({ ...m, familyNameEn: fam.nameEn, familyNameSi: fam.nameSi }));
      const trips = db.trips
        .filter((t) => t.familyId === familyId)
        .map((t) => ({
          ...t,
          familyNameEn: fam.nameEn,
          familyNameSi: fam.nameSi,
          ...getLikeStats(db, 'trip', t.id, clientId),
        }));
      const pictures = db.gallery
        .filter((g) => g.familyId === familyId)
        .map((g) => ({
          ...g,
          familyNameEn: fam.nameEn,
          familyNameSi: fam.nameSi,
          ...getLikeStats(db, 'gallery', g.id, clientId),
        }));
      const events = db.events
        .filter((e) => e.familyId === familyId)
        .map((e) => ({
          ...e,
          ...getLikeStats(db, 'event', e.id, clientId),
        }));
      const birthdays = getUnifiedBirthdays(db, familyId);
      return jsonResponse({
        family: fam,
        members,
        history: { trips, pictures, events, birthdays },
      });
    }

    if (method === 'PATCH') {
      const body = parseBody(init);
      const existing = db.families[idx];
      db.families[idx] = {
        ...existing,
        sortOrder:
          typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
            ? body.sortOrder
            : existing.sortOrder,
        nameEn: typeof body.nameEn === 'string' && body.nameEn.trim() ? body.nameEn.trim() : existing.nameEn,
        nameSi: typeof body.nameSi === 'string' && body.nameSi.trim() ? body.nameSi.trim() : existing.nameSi,
        descriptionEn: typeof body.descriptionEn === 'string' ? body.descriptionEn : existing.descriptionEn,
        descriptionSi: typeof body.descriptionSi === 'string' ? body.descriptionSi : existing.descriptionSi,
        coverPhotoUrl: typeof body.coverPhotoUrl === 'string' ? body.coverPhotoUrl : existing.coverPhotoUrl,
      };
      const updated = withMemberCounts(db).find((f) => f.id === familyId)!;
      pushNotification(db, {
        titleEn: `${updated.nameEn} Updated`,
        titleSi: `${updated.nameSi} යාවත්කාලීන විය`,
        bodyEn: `${authorName} updated details for ${updated.nameEn}.`,
        bodySi: `${authorName} ${updated.nameSi} පිළිබඳ තොරතුරු යාවත්කාලීන කළේය.`,
        linkTab: 'families',
        sourceClientId: clientId,
      });
      writeDb(db);
      return jsonResponse({ family: updated });
    }

    if (method === 'DELETE') {
      db.families = db.families.filter((f) => f.id !== familyId);
      db.members = db.members.filter((m) => m.familyId !== familyId);
      db.trips = db.trips.filter((t) => t.familyId !== familyId);
      db.birthdays = db.birthdays.map((b) => (b.familyId === familyId ? { ...b, familyId: null } : b));
      db.events = db.events.map((e) => (e.familyId === familyId ? { ...e, familyId: null } : e));
      db.gallery = db.gallery.map((g) => (g.familyId === familyId ? { ...g, familyId: null } : g));
      db.announcements = db.announcements.map((a) =>
        a.familyId === familyId ? { ...a, familyId: null } : a
      );
      db.chatMessages = db.chatMessages.filter((m) => m.roomId !== familyId);
      writeDb(db);
      return jsonResponse({ ok: true });
    }
  }

  const memberMatch = pathname.match(/^\/api\/members\/([^/]+)$/);
  if (memberMatch) {
    const memberId = decodeURIComponent(memberMatch[1]);
    if (method === 'PATCH') {
      const idx = db.members.findIndex((m) => m.id === memberId);
      if (idx === -1) return jsonResponse({ error: 'Member not found' }, 404);
      const body = parseBody(init);
      const cur = db.members[idx];
      db.members[idx] = {
        ...cur,
        name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : cur.name,
        relationship: typeof body.relationship === 'string' && body.relationship ? body.relationship : cur.relationship,
        birthday: typeof body.birthday === 'string' ? body.birthday : cur.birthday,
        photoUrl: typeof body.photoUrl === 'string' ? body.photoUrl : cur.photoUrl,
        description: typeof body.description === 'string' ? body.description : cur.description,
      };
      writeDb(db);
      return jsonResponse({ member: db.members[idx] });
    }
    if (method === 'DELETE') {
      db.members = db.members.filter((m) => m.id !== memberId);
      writeDb(db);
      return jsonResponse({ ok: true });
    }
  }

  if (pathname === '/api/birthdays') {
    if (method === 'GET') {
      return jsonResponse({ birthdays: getUnifiedBirthdays(db) });
    }
    if (method === 'POST') {
      const body = parseBody(init);
      if (!body.memberName || !body.birthDate) {
        return jsonResponse({ error: 'Name and birth date are required' }, 400);
      }
      const id = uid('bday');
      db.birthdays.push({
        id,
        familyId: body.familyId || null,
        memberName: String(body.memberName).trim(),
        birthDate: String(body.birthDate).trim(),
        photoUrl: typeof body.photoUrl === 'string' ? body.photoUrl : '',
        notes: typeof body.notes === 'string' ? body.notes : '',
        createdAt: new Date().toISOString(),
      });
      pushNotification(db, {
        titleEn: 'Birthday Added',
        titleSi: 'උපන්දිනයක් එක් කරන ලදී',
        bodyEn: `${authorName} added ${String(body.memberName).trim()}'s birthday (${body.birthDate}).`,
        bodySi: `${authorName} ${String(body.memberName).trim()} ගේ උපන්දිනය එක් කළේය (${body.birthDate}).`,
        linkTab: 'features',
        sourceClientId: clientId,
      });
      writeDb(db);
      const birthday = getUnifiedBirthdays(db).find((b) => b.id === id);
      return jsonResponse({ birthday }, 201);
    }
  }

  const wishMatch = pathname.match(/^\/api\/birthdays\/([^/]+)\/wishes$/);
  if (wishMatch && method === 'POST') {
    const targetKey = decodeURIComponent(wishMatch[1]);
    const body = parseBody(init);
    if (!body.message || !String(body.message).trim()) {
      return jsonResponse({ error: 'Message is required' }, 400);
    }
    const cleanAuthor =
      typeof body.authorName === 'string' && body.authorName.trim() ? body.authorName.trim() : authorName;
    const wish: StaticWishRecord = {
      id: uid('wish'),
      targetKey,
      authorName: cleanAuthor,
      authorAvatar: typeof body.authorAvatar === 'string' ? body.authorAvatar : '',
      authorAvatars: Array.isArray(body.authorAvatars) ? body.authorAvatars : [],
      message: String(body.message).trim(),
      createdAt: new Date().toISOString(),
    };
    db.wishes.unshift(wish);
    pushNotification(db, {
      titleEn: 'New Birthday Wish 🎂',
      titleSi: 'නව උපන්දින සුභ පැතුමක් 🎂',
      bodyEn: `${cleanAuthor} sent a birthday wish: "${wish.message}"`,
      bodySi: `${cleanAuthor} උපන්දින සුභ පැතුමක් එව්වා: "${wish.message}"`,
      linkTab: 'features',
      sourceClientId: clientId,
    });
    writeDb(db);
    const { targetKey: _tk, ...plainWish } = wish;
    return jsonResponse({ wish: plainWish }, 201);
  }

  const bdayMatch = pathname.match(/^\/api\/birthdays\/([^/]+)$/);
  if (bdayMatch) {
    const id = decodeURIComponent(bdayMatch[1]);
    if (method === 'PATCH') {
      const item = db.birthdays.find((b) => b.id === id);
      if (item) {
        const body = parseBody(init);
        if (typeof body.memberName === 'string' && body.memberName.trim()) {
          item.memberName = body.memberName.trim();
        }
        if (typeof body.birthDate === 'string' && body.birthDate.trim()) {
          item.birthDate = body.birthDate.trim();
        }
        if (body.familyId !== undefined) item.familyId = body.familyId || null;
        if (typeof body.photoUrl === 'string') item.photoUrl = body.photoUrl;
        if (typeof body.notes === 'string') item.notes = body.notes;
        writeDb(db);
      }
      return jsonResponse({ ok: true });
    }
    if (method === 'DELETE') {
      db.birthdays = db.birthdays.filter((b) => b.id !== id);
      db.wishes = db.wishes.filter((w) => w.targetKey !== `birthday-${id}`);
      writeDb(db);
      return jsonResponse({ ok: true });
    }
  }

  if (pathname === '/api/trips') {
    if (method === 'GET') {
      const famMap = new Map(db.families.map((f) => [f.id, f]));
      return jsonResponse({
        trips: db.trips.map((t) => ({
          ...t,
          familyNameEn: famMap.get(t.familyId)?.nameEn || '',
          familyNameSi: famMap.get(t.familyId)?.nameSi || '',
          ...getLikeStats(db, 'trip', t.id, clientId),
        })),
      });
    }
    if (method === 'POST') {
      const body = parseBody(init);
      if (!body.title || !body.destination || !body.tripDate || !body.familyId) {
        return jsonResponse({ error: 'Title, destination, date, and family are required' }, 400);
      }
      const fam = db.families.find((f) => f.id === body.familyId);
      const cleanAuthor =
        typeof body.createdByName === 'string' && body.createdByName.trim()
          ? body.createdByName.trim()
          : typeof body.authorName === 'string' && body.authorName.trim()
            ? body.authorName.trim()
            : authorName;
      const trip = {
        id: uid('trip'),
        familyId: String(body.familyId),
        familyNameEn: fam?.nameEn || '',
        familyNameSi: fam?.nameSi || '',
        title: String(body.title).trim(),
        destination: String(body.destination).trim(),
        tripDate: String(body.tripDate).trim(),
        description: typeof body.description === 'string' ? body.description : '',
        media: Array.isArray(body.media) ? (body.media as MediaAsset[]) : [],
        createdByName: cleanAuthor,
        createdAt: new Date().toISOString(),
      };
      db.trips.unshift(trip);
      pushNotification(db, {
        titleEn: `New Family Trip: ${trip.title}`,
        titleSi: `නව පවුලේ සංචාරයක්: ${trip.title}`,
        bodyEn: `${cleanAuthor} shared trip memories from ${trip.destination}.`,
        bodySi: `${cleanAuthor} ${trip.destination} සංචාර මතකයන් එක් කළේය.`,
        linkTab: 'features',
        sourceClientId: clientId,
      });
      writeDb(db);
      return jsonResponse({ trip: { ...trip, likeCount: 0, likedByMe: false } }, 201);
    }
  }

  const tripMatch = pathname.match(/^\/api\/trips\/([^/]+)$/);
  if (tripMatch) {
    const id = decodeURIComponent(tripMatch[1]);
    if (method === 'PATCH') {
      const trip = db.trips.find((t) => t.id === id);
      if (trip) {
        const body = parseBody(init);
        if (typeof body.title === 'string' && body.title.trim()) trip.title = body.title.trim();
        if (typeof body.destination === 'string' && body.destination.trim())
          trip.destination = body.destination.trim();
        if (typeof body.tripDate === 'string' && body.tripDate.trim())
          trip.tripDate = body.tripDate.trim();
        if (typeof body.familyId === 'string' && body.familyId) trip.familyId = body.familyId;
        if (typeof body.description === 'string') trip.description = body.description;
        writeDb(db);
      }
      return jsonResponse({ ok: true });
    }
    if (method === 'DELETE') {
      db.trips = db.trips.filter((t) => t.id !== id);
      writeDb(db);
      return jsonResponse({ ok: true });
    }
  }

  if (pathname === '/api/events') {
    if (method === 'GET') {
      return jsonResponse({
        events: db.events.map((e) => ({
          ...e,
          ...getLikeStats(db, 'event', e.id, clientId),
        })),
      });
    }
    if (method === 'POST') {
      const body = parseBody(init);
      if (!body.title || !body.eventDate) {
        return jsonResponse({ error: 'Title and event date are required' }, 400);
      }
      const cleanAuthor =
        typeof body.createdByName === 'string' && body.createdByName.trim()
          ? body.createdByName.trim()
          : typeof body.authorName === 'string' && body.authorName.trim()
            ? body.authorName.trim()
            : authorName;
      const event = {
        id: uid('evt'),
        familyId: body.familyId || null,
        title: String(body.title).trim(),
        category: String(body.category || 'celebration'),
        eventDate: String(body.eventDate).trim(),
        location: typeof body.location === 'string' ? body.location : '',
        description: typeof body.description === 'string' ? body.description : '',
        media: Array.isArray(body.media) ? (body.media as MediaAsset[]) : [],
        status: 'approved' as const,
        createdByName: cleanAuthor,
        createdAt: new Date().toISOString(),
      };
      db.events.unshift(event);
      pushNotification(db, {
        titleEn: `New Special Event: ${event.title}`,
        titleSi: `නව විශේෂ උත්සවයක්: ${event.title}`,
        bodyEn: `${cleanAuthor} scheduled "${event.title}" on ${event.eventDate}.`,
        bodySi: `${cleanAuthor} "${event.title}" (${event.eventDate}) එක් කළේය.`,
        linkTab: 'features',
        sourceClientId: clientId,
      });
      writeDb(db);
      return jsonResponse({ event: { ...event, likeCount: 0, likedByMe: false } }, 201);
    }
  }

  const eventMatch = pathname.match(/^\/api\/events\/([^/]+)$/);
  if (eventMatch) {
    const id = decodeURIComponent(eventMatch[1]);
    if (method === 'PATCH') {
      const body = parseBody(init);
      const evt = db.events.find((e) => e.id === id);
      if (evt) {
        if (typeof body.title === 'string' && body.title.trim()) evt.title = body.title.trim();
        if (typeof body.category === 'string' && body.category) evt.category = body.category;
        if (typeof body.eventDate === 'string' && body.eventDate.trim())
          evt.eventDate = body.eventDate.trim();
        if (typeof body.location === 'string') evt.location = body.location;
        if (body.familyId !== undefined) evt.familyId = body.familyId || null;
        if (typeof body.description === 'string') evt.description = body.description;
        if (body.status === 'suggested' || body.status === 'approved') evt.status = body.status;
        writeDb(db);
      }
      return jsonResponse({ ok: true });
    }
    if (method === 'DELETE') {
      db.events = db.events.filter((e) => e.id !== id);
      writeDb(db);
      return jsonResponse({ ok: true });
    }
  }

  if (pathname === '/api/gallery') {
    if (method === 'GET') {
      const famMap = new Map(db.families.map((f) => [f.id, f]));
      return jsonResponse({
        items: db.gallery.map((g) => {
          const fam = g.familyId ? famMap.get(g.familyId) : undefined;
          return {
            ...g,
            familyNameEn: fam?.nameEn || '',
            familyNameSi: fam?.nameSi || '',
            ...getLikeStats(db, 'gallery', g.id, clientId),
          };
        }),
      });
    }
    if (method === 'POST') {
      const body = parseBody(init);
      if (!body.title || !body.mediaUrl) {
        return jsonResponse({ error: 'Title and media are required' }, 400);
      }
      const fam = body.familyId ? db.families.find((f) => f.id === body.familyId) : undefined;
      const cleanAuthor =
        typeof body.uploadedByName === 'string' && body.uploadedByName.trim()
          ? body.uploadedByName.trim()
          : typeof body.authorName === 'string' && body.authorName.trim()
            ? body.authorName.trim()
            : authorName;
      const item = {
        id: uid('gal'),
        familyId: body.familyId || null,
        familyNameEn: fam?.nameEn || '',
        familyNameSi: fam?.nameSi || '',
        title: String(body.title).trim(),
        location: typeof body.location === 'string' ? body.location.trim() : '',
        caption: typeof body.caption === 'string' ? body.caption.trim() : '',
        momentDate:
          typeof body.momentDate === 'string' && body.momentDate
            ? body.momentDate
            : new Date().toISOString().slice(0, 10),
        kind: (body.kind === 'timeline' || body.kind === 'moment' ? body.kind : 'gallery') as
          | 'gallery'
          | 'timeline'
          | 'moment',
        mediaUrl: String(body.mediaUrl),
        mediaType: (body.mediaType === 'video' ? 'video' : 'image') as 'image' | 'video',
        uploadedByName: cleanAuthor,
        likeCount: 0,
        likedByMe: false,
        createdAt: new Date().toISOString(),
      };
      db.gallery.unshift(item);
      pushNotification(db, {
        titleEn: `New Shared Memory: ${item.title}`,
        titleSi: `නව මතකයක් බෙදාගන්නා ලදී: ${item.title}`,
        bodyEn: `${cleanAuthor} posted a new ${item.mediaType} in Gallery & Moments.`,
        bodySi: `${cleanAuthor} ගැලරිය සහ සුන්දර මතකයන් වෙත නව ${item.mediaType === 'video' ? 'වීඩියෝවක්' : 'ඡායාරූපයක්'} එක් කළේය.`,
        linkTab: 'moments',
        sourceClientId: clientId,
      });
      writeDb(db);
      return jsonResponse({ item }, 201);
    }
  }

  const galleryMatch = pathname.match(/^\/api\/gallery\/([^/]+)$/);
  if (galleryMatch) {
    const id = decodeURIComponent(galleryMatch[1]);
    if (method === 'PATCH') {
      const item = db.gallery.find((g) => g.id === id);
      if (item) {
        const body = parseBody(init);
        if (typeof body.title === 'string' && body.title.trim()) item.title = body.title.trim();
        if (typeof body.location === 'string') item.location = body.location;
        if (typeof body.caption === 'string') item.caption = body.caption;
        if (typeof body.momentDate === 'string' && body.momentDate) item.momentDate = body.momentDate;
        if (body.kind === 'gallery' || body.kind === 'timeline' || body.kind === 'moment')
          item.kind = body.kind;
        if (body.familyId !== undefined) item.familyId = body.familyId || null;
        writeDb(db);
      }
      return jsonResponse({ ok: true });
    }
    if (method === 'DELETE') {
      db.gallery = db.gallery.filter((g) => g.id !== id);
      writeDb(db);
      return jsonResponse({ ok: true });
    }
  }

  if (pathname === '/api/likes/toggle' && method === 'POST') {
    const body = parseBody(init);
    const targetType = String(body.targetType || '');
    const targetId = String(body.targetId || '');
    if (!targetType || !targetId) {
      return jsonResponse({ error: 'targetType and targetId are required' }, 400);
    }
    const existingIdx = db.likes.findIndex(
      (l) => l.targetType === targetType && l.targetId === targetId && l.clientId === clientId
    );
    let likedByMe = false;
    if (existingIdx >= 0) {
      db.likes.splice(existingIdx, 1);
      likedByMe = false;
    } else {
      db.likes.push({ targetType, targetId, clientId });
      likedByMe = true;
    }
    writeDb(db);
    const stats = getLikeStats(db, targetType, targetId, clientId);
    return jsonResponse({ likedByMe, likeCount: stats.likeCount });
  }

  if (pathname === '/api/announcements') {
    if (method === 'GET') {
      return jsonResponse({ announcements: db.announcements });
    }
    if (method === 'POST') {
      const body = parseBody(init);
      if (!body.title || !body.body) {
        return jsonResponse({ error: 'Title and message body are required' }, 400);
      }
      const cleanAuthor =
        typeof body.authorName === 'string' && body.authorName.trim() ? body.authorName.trim() : authorName;
      const announcement: Announcement = {
        id: uid('ann'),
        familyId: body.familyId || null,
        title: String(body.title).trim(),
        body: String(body.body).trim(),
        priority: body.priority === 'important' ? 'important' : 'normal',
        authorName: cleanAuthor,
        createdAt: new Date().toISOString(),
      };
      db.announcements.unshift(announcement);
      pushNotification(db, {
        titleEn: `Announcement: ${announcement.title}`,
        titleSi: `නිවේදනය: ${announcement.title}`,
        bodyEn: `${cleanAuthor}: ${announcement.body}`,
        bodySi: `${cleanAuthor}: ${announcement.body}`,
        linkTab: 'moments',
        sourceClientId: clientId,
      });
      writeDb(db);
      return jsonResponse({ announcement }, 201);
    }
  }

  const annMatch = pathname.match(/^\/api\/announcements\/([^/]+)$/);
  if (annMatch) {
    const id = decodeURIComponent(annMatch[1]);
    if (method === 'PATCH') {
      const ann = db.announcements.find((a) => a.id === id);
      if (ann) {
        const body = parseBody(init);
        if (typeof body.title === 'string' && body.title.trim()) ann.title = body.title.trim();
        if (typeof body.body === 'string' && body.body.trim()) ann.body = body.body.trim();
        if (body.priority === 'important' || body.priority === 'normal')
          ann.priority = body.priority;
        if (body.familyId !== undefined) ann.familyId = body.familyId || null;
        writeDb(db);
      }
      return jsonResponse({ ok: true });
    }
    if (method === 'DELETE') {
      db.announcements = db.announcements.filter((a) => a.id !== id);
      writeDb(db);
      return jsonResponse({ ok: true });
    }
  }

  if (pathname === '/api/notifications' && method === 'GET') {
    return jsonResponse({
      notifications: db.notifications.map(({ readBy, ...rest }) => ({
        ...rest,
        isRead: readBy.includes(clientId),
      })),
    });
  }

  if (pathname === '/api/notifications/read-all' && method === 'POST') {
    for (const n of db.notifications) {
      if (!n.readBy.includes(clientId)) n.readBy.push(clientId);
    }
    writeDb(db, false);
    return jsonResponse({ ok: true });
  }

  if (pathname === '/api/chat/rooms' && method === 'GET') {
    const roomsList: Array<{ roomId: string; nameEn: string; nameSi: string; coverPhotoUrl: string }> = [
      {
        roomId: 'all',
        nameEn: 'All Families Group',
        nameSi: 'සියලුම පවුල් සමූහ චැට්',
        coverPhotoUrl: '',
      },
      ...db.families
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((f) => ({
          roomId: f.id,
          nameEn: f.nameEn,
          nameSi: f.nameSi,
          coverPhotoUrl: f.coverPhotoUrl,
        })),
    ];

    const rooms: ChatRoom[] = roomsList.map((room) => {
      const readAt = db.chatReadAt[`${room.roomId}:${clientId}`] || '1970-01-01T00:00:00.000Z';
      const roomMsgs = db.chatMessages.filter((m) => m.roomId === room.roomId);
      const unreadCount = roomMsgs.filter(
        (m) => m.createdAt > readAt && m.senderId !== clientId
      ).length;
      const last = roomMsgs[roomMsgs.length - 1];
      return {
        roomId: room.roomId,
        nameEn: room.nameEn,
        nameSi: room.nameSi,
        coverPhotoUrl: room.coverPhotoUrl,
        unreadCount,
        lastMessage: last
          ? {
              senderName: last.senderName,
              text: last.text,
              mediaType: last.mediaType,
            }
          : undefined,
      };
    });
    return jsonResponse({ rooms });
  }

  if (pathname === '/api/chat/messages') {
    if (method === 'GET') {
      const roomId = searchParams.get('roomId') || 'all';
      db.chatReadAt[`${roomId}:${clientId}`] = new Date().toISOString();
      writeDb(db, false);
      return jsonResponse({
        messages: db.chatMessages.filter((m) => m.roomId === roomId).slice(-200),
      });
    }
    if (method === 'POST') {
      const body = parseBody(init);
      const roomId = String(body.roomId || 'all');
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      const mediaUrl = typeof body.mediaUrl === 'string' ? body.mediaUrl : '';
      if (!text && !mediaUrl) {
        return jsonResponse({ error: 'Message text or media is required' }, 400);
      }
      const message: ChatMessage = {
        id: uid('msg'),
        roomId,
        senderId: clientId,
        senderName:
          typeof body.senderName === 'string' && body.senderName.trim()
            ? body.senderName.trim()
            : 'Family Member',
        senderAvatar: typeof body.senderAvatar === 'string' ? body.senderAvatar : '',
        senderAvatars: Array.isArray(body.senderAvatars) ? body.senderAvatars : [],
        text,
        mediaUrl,
        mediaType: body.mediaType || null,
        createdAt: new Date().toISOString(),
      };
      db.chatMessages.push(message);
      db.chatReadAt[`${roomId}:${clientId}`] = message.createdAt;
      writeDb(db);
      return jsonResponse({ message }, 201);
    }
  }

  const chatMsgDelete = pathname.match(/^\/api\/chat\/messages\/([^/]+)$/);
  if (chatMsgDelete && method === 'DELETE') {
    const id = decodeURIComponent(chatMsgDelete[1]);
    db.chatMessages = db.chatMessages.filter((m) => m.id !== id);
    writeDb(db);
    return jsonResponse({ ok: true });
  }

  if (pathname === '/api/chat/read' && method === 'POST') {
    const body = parseBody(init);
    const roomId = String(body.roomId || 'all');
    db.chatReadAt[`${roomId}:${clientId}`] = new Date().toISOString();
    writeDb(db, false);
    return jsonResponse({ ok: true });
  }

  if (pathname === '/api/admin/export' && method === 'GET') {
    return jsonResponse({
      exportedAt: new Date().toISOString(),
      ...db,
    });
  }

  if (pathname === '/api/admin/import' && method === 'POST') {
    const body = parseBody(init);
    if (!body || !Array.isArray(body.families)) {
      return jsonResponse({ error: 'Invalid backup file' }, 400);
    }
    const nextDb: StaticDatabase = {
      ...createInitialDb(),
      siteSettings: mergeSiteSettings(body.siteSettings),
      families: body.families,
      members: Array.isArray(body.members) ? body.members : [],
      birthdays: Array.isArray(body.birthdays) ? body.birthdays : [],
      wishes: Array.isArray(body.wishes) ? body.wishes : [],
      trips: Array.isArray(body.trips) ? body.trips : [],
      events: Array.isArray(body.events) ? body.events : [],
      gallery: Array.isArray(body.gallery)
        ? body.gallery
        : Array.isArray(body.galleryItems)
          ? body.galleryItems
          : [],
      announcements: Array.isArray(body.announcements) ? body.announcements : [],
      chatMessages: Array.isArray(body.chatMessages) ? body.chatMessages : [],
    };
    writeDb(nextDb);
    return jsonResponse({ ok: true });
  }

  if (pathname === '/api/admin/reset' && method === 'POST') {
    const fresh = createInitialDb();
    writeDb(fresh);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

let listenerInstalled = false;

export function installStaticApiFallback(): void {
  if (listenerInstalled || typeof window === 'undefined') return;
  listenerInstalled = true;

  window.addEventListener('online', () => {
    if (!staticHostDetected) {
      offlineFallbackActive = false;
    }
  });
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  if (typeof window === 'undefined') {
    return nativeFetch(input, init);
  }

  let urlObj: URL | null = null;
  try {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    urlObj = new URL(rawUrl, window.location.origin);
  } catch {
    return nativeFetch(input, init);
  }

  if (urlObj.origin !== window.location.origin || !urlObj.pathname.startsWith('/api/')) {
    return nativeFetch(input, init);
  }

  if (isStaticModeActive()) {
    return handleStaticApi(urlObj.pathname, urlObj.searchParams, init);
  }

  try {
    const res = await nativeFetch(input, init);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const isMissingBackend =
      res.status === 404 ||
      res.status === 405 ||
      res.status === 501 ||
      !contentType.includes('application/json');

    if (isMissingBackend) {
      staticHostDetected = true;
      window.dispatchEvent(new CustomEvent('of:static-mode', { detail: { kind: 'static-host' } }));
      return handleStaticApi(urlObj.pathname, urlObj.searchParams, init);
    }
    return res;
  } catch {
    offlineFallbackActive = true;
    window.dispatchEvent(new CustomEvent('of:static-mode', { detail: { kind: 'offline' } }));
    return handleStaticApi(urlObj.pathname, urlObj.searchParams, init);
  }
}
