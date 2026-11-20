import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { WebSocket, WebSocketServer } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const DIST_DIR = path.resolve(__dirname, 'dist');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'family_portal.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// --- Database Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS site_settings (
    id TEXT PRIMARY KEY,
    hero_photo_url TEXT NOT NULL,
    welcome_en TEXT NOT NULL,
    welcome_si TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS families (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL,
    name_en TEXT NOT NULL,
    name_si TEXT NOT NULL,
    description_en TEXT NOT NULL,
    description_si TEXT NOT NULL,
    cover_photo_url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    birthday TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS birthdays (
    id TEXT PRIMARY KEY,
    family_id TEXT,
    member_name TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    photo_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS birthday_wishes (
    id TEXT PRIMARY KEY,
    target_key TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_avatar TEXT NOT NULL DEFAULT '',
    author_avatars TEXT NOT NULL DEFAULT '[]',
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    title TEXT NOT NULL,
    destination TEXT NOT NULL,
    trip_date TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    media_json TEXT NOT NULL DEFAULT '[]',
    created_by_name TEXT NOT NULL DEFAULT 'Family Member',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    family_id TEXT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'celebration',
    event_date TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    media_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'approved',
    created_by_name TEXT NOT NULL DEFAULT 'Family Member',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gallery_items (
    id TEXT PRIMARY KEY,
    family_id TEXT,
    title TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    caption TEXT NOT NULL DEFAULT '',
    moment_date TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'gallery',
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image',
    uploaded_by_name TEXT NOT NULL DEFAULT 'Family Member',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS likes (
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (target_type, target_id, client_id)
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    family_id TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    author_name TEXT NOT NULL DEFAULT 'Family Member',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title_en TEXT NOT NULL,
    title_si TEXT NOT NULL,
    body_en TEXT NOT NULL,
    body_si TEXT NOT NULL,
    link_tab TEXT NOT NULL DEFAULT 'home',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    PRIMARY KEY (notification_id, client_id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_avatar TEXT NOT NULL DEFAULT '',
    sender_avatars TEXT NOT NULL DEFAULT '[]',
    text TEXT NOT NULL DEFAULT '',
    media_url TEXT NOT NULL DEFAULT '',
    media_type TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_room_reads (
    room_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    last_read_at TEXT NOT NULL,
    PRIMARY KEY (room_id, client_id)
  );

  CREATE TABLE IF NOT EXISTS uploaded_files (
    filename TEXT PRIMARY KEY,
    mime_type TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// --- Helpers ---
function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getClientId(req: Request): string {
  const h = req.header('x-client-id');
  return (h && h.trim()) || 'anonymous';
}

function getAuthorHeader(req: Request, fallback = 'Family Member'): string {
  const raw = req.header('x-author-name');
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw).trim() || fallback;
  } catch {
    return raw.trim() || fallback;
  }
}

function getDaysUntilBirthday(birthDate: string): number {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return 999;
  const parts = birthDate.split('-');
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m, d);
  if (next < today) {
    next = new Date(now.getFullYear() + 1, m, d);
  }
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// --- Safe Schema Migration ---
const DEFAULT_ABOUT_STORY_EN =
  'Our families stay connected across cities and generations — sharing milestones, birthdays, family trips, cherished photographs, and everyday moments together.';
const DEFAULT_ABOUT_STORY_SI =
  'නගර හා පරම්පරා හරහා ආදරයෙන් බැඳුණු අපේ පවුල්වල සතුට, උපන්දින, චාරිකා, වටිනා ඡායාරූප සහ එදිනෙදා සුන්දර මතකයන් එකම තැනකින් බෙදාගනිමු.';

function ensureSiteSettingsColumns() {
  const cols = db.prepare('PRAGMA table_info(site_settings)').all() as { name: string }[];
  const existing = new Set(cols.map((c) => c.name));
  const additions: Array<[string, string]> = [
    ['site_title_en', "TEXT NOT NULL DEFAULT 'OUR FAMILIES'"],
    ['site_title_si', "TEXT NOT NULL DEFAULT 'අපේ පවුල්'"],
    ['hero_kicker_en', "TEXT NOT NULL DEFAULT 'Connected Families · Colombo · Kandy · Galle · Melbourne'"],
    ['hero_kicker_si', "TEXT NOT NULL DEFAULT 'සබැඳි පවුල් එකමුතුව · කොළඹ · මහනුවර · ගාල්ල · මෙල්බර්න්'"],
    ['about_title_en', "TEXT NOT NULL DEFAULT 'ABOUT OUR FAMILIES ❤️'"],
    ['about_title_si', "TEXT NOT NULL DEFAULT 'අපේ පවුල් ගැන ❤️'"],
    ['about_story_en', `TEXT NOT NULL DEFAULT '${DEFAULT_ABOUT_STORY_EN.replace(/'/g, "''")}'`],
    ['about_story_si', `TEXT NOT NULL DEFAULT '${DEFAULT_ABOUT_STORY_SI.replace(/'/g, "''")}'`],
  ];
  for (const [col, def] of additions) {
    if (!existing.has(col)) {
      db.exec(`ALTER TABLE site_settings ADD COLUMN ${col} ${def}`);
    }
  }
}

ensureSiteSettingsColumns();

// --- Seed Initial Data (Clean Blank Portal — No Example Data) ---
function seedIfEmpty() {
  const settingsCount = db.prepare('SELECT COUNT(*) as c FROM site_settings').get() as { c: number };
  if (settingsCount.c === 0) {
    db.prepare(
      `INSERT INTO site_settings (
        id, site_title_en, site_title_si, hero_kicker_en, hero_kicker_si,
        hero_photo_url, welcome_en, welcome_si,
        about_title_en, about_title_si, about_story_en, about_story_si, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'main',
      'OUR FAMILIES',
      'අපේ පවුල්',
      'Connected Families · Colombo · Kandy · Galle · Melbourne',
      'සබැඳි පවුල් එකමුතුව · කොළඹ · මහනුවර · ගාල්ල · මෙල්බර්න්',
      '/src/assets/images/hero_family_gathering_1794925789784.jpg',
      'Connected families bound by heritage, shared memories, celebrations, and love — always close across every mile.',
      'ආදරයෙන්, සාමයෙන් සහ සුන්දර මතකයන්ගෙන් බැඳුණු අපේ පවුල්වල සදාතනික එකමුතුව.',
      'ABOUT OUR FAMILIES ❤️',
      'අපේ පවුල් ගැන ❤️',
      DEFAULT_ABOUT_STORY_EN,
      DEFAULT_ABOUT_STORY_SI,
      nowIso()
    );
  }

  const famCount = db.prepare('SELECT COUNT(*) as c FROM families').get() as { c: number };
  if (famCount.c === 0) {
    const familyCovers = [
      '/src/assets/images/hero_family_gathering_1794925789784.jpg',
      '/src/assets/images/feature_family_trip_1794925793319.jpg',
      '/src/assets/images/feature_birthday_celebration_1794925789421.jpg',
      '/src/assets/images/feature_special_events_1794925790435.jpg',
      '/src/assets/images/feature_family_trip_1794925793319.jpg',
      '/src/assets/images/feature_birthday_celebration_1794925789421.jpg',
      '/src/assets/images/hero_family_gathering_1794925789784.jpg',
      '/src/assets/images/feature_special_events_1794925790435.jpg',
    ];
    const insertFam = db.prepare(
      `INSERT INTO families (id, sort_order, name_en, name_si, description_en, description_si, cover_photo_url)
       VALUES (?, ?, ?, ?, '', '', ?)`
    );
    for (let i = 1; i <= 8; i++) {
      insertFam.run(`family-${i}`, i, `Family ${i}`, `පවුල ${i}`, familyCovers[i - 1]);
    }
  }
}

seedIfEmpty();

// --- HTTP & WebSocket Server ---
const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve uploaded files from disk first, falling back seamlessly to SQLite storage
app.use('/uploads', express.static(UPLOADS_DIR));
app.get('/uploads/:filename', (req: Request, res: Response) => {
  const filename = path.basename(String(req.params.filename || ''));
  if (!filename) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  const diskPath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(diskPath)) {
    res.sendFile(diskPath);
    return;
  }
  const row = db
    .prepare('SELECT mime_type, data FROM uploaded_files WHERE filename = ?')
    .get(filename) as { mime_type: string; data: Uint8Array | Buffer } | undefined;
  if (!row || !row.data) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  const fileBuffer = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
  try {
    fs.writeFileSync(diskPath, fileBuffer);
  } catch {
    // ignore read-only fs errors; stream directly from SQLite
  }
  res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(fileBuffer);
});

const distAssetsDir = path.resolve(DIST_DIR, 'src/assets');
const srcAssetsDir = path.resolve(__dirname, 'src/assets');
if (fs.existsSync(srcAssetsDir)) {
  app.use('/src/assets', express.static(srcAssetsDir));
}
if (fs.existsSync(distAssetsDir)) {
  app.use('/src/assets', express.static(distAssetsDir));
}

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const reqPath = (request.url || '').split('?')[0];
  if (reqPath === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

let syncVersion = Date.now();
function bumpSyncVersion(): number {
  const now = Date.now();
  syncVersion = now > syncVersion ? now : syncVersion + 1;
  return syncVersion;
}

function broadcastWs(payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  }
}

function broadcastSync(sourceClientId: string) {
  const version = bumpSyncVersion();
  broadcastWs({ type: 'data:sync', sourceClientId, version });
}

function createAndBroadcastNotification(params: {
  type: 'birthday' | 'event' | 'gallery' | 'announcement' | 'family' | 'like' | 'wish' | 'trip';
  titleEn: string;
  titleSi: string;
  bodyEn: string;
  bodySi: string;
  linkTab: string;
  sourceClientId: string;
}) {
  const id = uid('notif');
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO notifications (id, type, title_en, title_si, body_en, body_si, link_tab, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, params.type, params.titleEn, params.titleSi, params.bodyEn, params.bodySi, params.linkTab, createdAt);

  if (params.sourceClientId && params.sourceClientId !== 'anonymous') {
    db.prepare(
      `INSERT OR IGNORE INTO notification_reads (notification_id, client_id) VALUES (?, ?)`
    ).run(id, params.sourceClientId);
  }

  const version = bumpSyncVersion();
  broadcastWs({
    type: 'notification:new',
    sourceClientId: params.sourceClientId,
    version,
    notification: {
      id,
      type: params.type,
      titleEn: params.titleEn,
      titleSi: params.titleSi,
      bodyEn: params.bodyEn,
      bodySi: params.bodySi,
      linkTab: params.linkTab,
      isRead: false,
      createdAt,
    },
  });
}

const aliveSockets = new WeakSet<WebSocket>();

wss.on('connection', (ws) => {
  aliveSockets.add(ws);
  ws.on('pong', () => {
    aliveSockets.add(ws);
  });

  try {
    ws.send(JSON.stringify({ type: 'ws:ready', version: syncVersion }));
  } catch {
    // ignore send error on closing socket
  }

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        type?: string;
        roomId?: string;
        clientId?: string;
        userName?: string;
      };
      if (msg.type === 'ping') {
        aliveSockets.add(ws);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong', version: syncVersion }));
        }
        return;
      }
      if (msg.type === 'chat:typing' && msg.roomId && msg.userName) {
        broadcastWs({
          type: 'chat:typing',
          roomId: msg.roomId,
          clientId: msg.clientId || '',
          userName: msg.userName,
        });
      }
    } catch {
      // ignore malformed frames
    }
  });
});

// Keepalive heartbeat so Cloud Run / mobile proxies don't close idle WebSockets
const wsHeartbeatInterval = setInterval(() => {
  for (const client of wss.clients) {
    if (!aliveSockets.has(client)) {
      client.terminate();
      continue;
    }
    aliveSockets.delete(client);
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  }
}, 25000);
wsHeartbeatInterval.unref?.();

// --- Multer Upload Configuration ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
    cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(jpe?g|png|gif|webp|avif|heic|heif|bmp|svg|tiff?|mp4|mov|webm|m4v|ogg|3gp)$/i;
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      allowedExt.test(file.originalname || '')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
});

// --- Query Helpers ---
function mapFamily(row: any) {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    nameEn: row.name_en,
    nameSi: row.name_si,
    descriptionEn: row.description_en,
    descriptionSi: row.description_si,
    coverPhotoUrl: row.cover_photo_url,
    memberCount: typeof row.member_count === 'number' ? row.member_count : undefined,
  };
}

function mapMember(row: any) {
  return {
    id: row.id,
    familyId: row.family_id,
    name: row.name,
    relationship: row.relationship,
    birthday: row.birthday,
    photoUrl: row.photo_url,
    description: row.description,
    createdAt: row.created_at,
    familyNameEn: row.family_name_en,
    familyNameSi: row.family_name_si,
  };
}

function getLikeStats(targetType: string, targetId: string, clientId: string) {
  const countRow = db
    .prepare('SELECT COUNT(*) as c FROM likes WHERE target_type = ? AND target_id = ?')
    .get(targetType, targetId) as { c: number };
  const myRow = db
    .prepare('SELECT 1 FROM likes WHERE target_type = ? AND target_id = ? AND client_id = ?')
    .get(targetType, targetId, clientId);
  return {
    likeCount: countRow.c,
    likedByMe: Boolean(myRow),
  };
}

function getWishesMap(): Map<string, any[]> {
  const rows = db
    .prepare('SELECT * FROM birthday_wishes ORDER BY created_at DESC')
    .all() as any[];
  const map = new Map<string, any[]>();
  for (const r of rows) {
    const list = map.get(r.target_key) || [];
    list.push({
      id: r.id,
      targetKey: r.target_key,
      authorName: r.author_name,
      authorAvatar: r.author_avatar,
      authorAvatars: safeJsonParse<string[]>(r.author_avatars, []),
      message: r.message,
      createdAt: r.created_at,
    });
    map.set(r.target_key, list);
  }
  return map;
}

function getUnifiedBirthdays(familyFilterId?: string) {
  const wishesMap = getWishesMap();
  const familyMap = new Map<string, { nameEn: string; nameSi: string }>();
  const famRows = db.prepare('SELECT id, name_en, name_si FROM families').all() as any[];
  for (const f of famRows) {
    familyMap.set(f.id, { nameEn: f.name_en, nameSi: f.name_si });
  }

  const results: any[] = [];

  const bRows = (
    familyFilterId
      ? db.prepare('SELECT * FROM birthdays WHERE family_id = ?').all(familyFilterId)
      : db.prepare('SELECT * FROM birthdays').all()
  ) as any[];

  for (const r of bRows) {
    const fam = r.family_id ? familyMap.get(r.family_id) : undefined;
    const targetKey = `birthday-${r.id}`;
    results.push({
      id: r.id,
      targetKey,
      source: 'birthday',
      familyId: r.family_id,
      familyNameEn: fam?.nameEn || '',
      familyNameSi: fam?.nameSi || '',
      memberName: r.member_name,
      birthDate: r.birth_date,
      photoUrl: r.photo_url,
      notes: r.notes,
      wishes: wishesMap.get(targetKey) || [],
    });
  }

  const mRows = (
    familyFilterId
      ? db
          .prepare("SELECT * FROM members WHERE family_id = ? AND TRIM(birthday) != ''")
          .all(familyFilterId)
      : db.prepare("SELECT * FROM members WHERE TRIM(birthday) != ''").all()
  ) as any[];

  for (const m of mRows) {
    const fam = familyMap.get(m.family_id);
    const targetKey = `member-${m.id}`;
    results.push({
      id: m.id,
      targetKey,
      source: 'member',
      familyId: m.family_id,
      familyNameEn: fam?.nameEn || '',
      familyNameSi: fam?.nameSi || '',
      memberName: m.name,
      birthDate: m.birthday,
      photoUrl: m.photo_url,
      notes: m.relationship,
      wishes: wishesMap.get(targetKey) || [],
    });
  }

  return results.sort(
    (a, b) => getDaysUntilBirthday(a.birthDate) - getDaysUntilBirthday(b.birthDate)
  );
}

// --- API Routes ---
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, status: 'healthy' });
});

app.get('/api/sync-version', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({ version: syncVersion });
});

app.get('/api/bootstrap', (_req: Request, res: Response) => {
  const settingsRow = db.prepare('SELECT * FROM site_settings WHERE id = ?').get('main') as any;
  const famRows = db
    .prepare(
      `SELECT f.*, COUNT(m.id) as member_count
       FROM families f
       LEFT JOIN members m ON m.family_id = f.id
       GROUP BY f.id
       ORDER BY f.sort_order ASC`
    )
    .all() as any[];

  const memberRows = db
    .prepare(
      `SELECT m.*, f.name_en as family_name_en, f.name_si as family_name_si
       FROM members m
       JOIN families f ON f.id = m.family_id
       ORDER BY f.sort_order ASC, m.created_at ASC`
    )
    .all() as any[];

  const upcomingBirthdays = getUnifiedBirthdays().filter(
    (b) => getDaysUntilBirthday(b.birthDate) <= 30
  );

  function mapSiteSettings(row: any) {
    if (!row) {
      return {
        siteTitleEn: 'OUR FAMILIES',
        siteTitleSi: 'අපේ පවුල්',
        heroKickerEn: 'Connected Families · Colombo · Kandy · Galle · Melbourne',
        heroKickerSi: 'සබැඳි පවුල් එකමුතුව · කොළඹ · මහනුවර · ගාල්ල · මෙල්බර්න්',
        heroPhotoUrl: '/src/assets/images/hero_family_gathering_1794925789784.jpg',
        welcomeEn: '',
        welcomeSi: '',
        aboutTitleEn: 'ABOUT OUR FAMILIES ❤️',
        aboutTitleSi: 'අපේ පවුල් ගැන ❤️',
        aboutStoryEn: DEFAULT_ABOUT_STORY_EN,
        aboutStorySi: DEFAULT_ABOUT_STORY_SI,
        updatedAt: nowIso(),
      };
    }
    return {
      siteTitleEn: row.site_title_en || 'OUR FAMILIES',
      siteTitleSi: row.site_title_si || 'අපේ පවුල්',
      heroKickerEn: row.hero_kicker_en || 'Connected Families · Colombo · Kandy · Galle · Melbourne',
      heroKickerSi: row.hero_kicker_si || 'සබැඳි පවුල් එකමුතුව · කොළඹ · මහනුවර · ගාල්ල · මෙල්බර්න්',
      heroPhotoUrl: row.hero_photo_url,
      welcomeEn: row.welcome_en,
      welcomeSi: row.welcome_si,
      aboutTitleEn: row.about_title_en || 'ABOUT OUR FAMILIES ❤️',
      aboutTitleSi: row.about_title_si || 'අපේ පවුල් ගැන ❤️',
      aboutStoryEn: row.about_story_en || DEFAULT_ABOUT_STORY_EN,
      aboutStorySi: row.about_story_si || DEFAULT_ABOUT_STORY_SI,
      updatedAt: row.updated_at,
    };
  }

  res.json({
    siteSettings: mapSiteSettings(settingsRow),
    families: famRows.map(mapFamily),
    upcomingBirthdays,
    allMembers: memberRows.map(mapMember),
  });
});

app.patch('/api/site-settings', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const authorName = getAuthorHeader(req);
  const {
    siteTitleEn,
    siteTitleSi,
    heroKickerEn,
    heroKickerSi,
    heroPhotoUrl,
    welcomeEn,
    welcomeSi,
    aboutTitleEn,
    aboutTitleSi,
    aboutStoryEn,
    aboutStorySi,
  } = req.body || {};
  const existing = db.prepare('SELECT * FROM site_settings WHERE id = ?').get('main') as any;

  const nextSiteTitleEn = typeof siteTitleEn === 'string' ? siteTitleEn : existing?.site_title_en || 'OUR FAMILIES';
  const nextSiteTitleSi = typeof siteTitleSi === 'string' ? siteTitleSi : existing?.site_title_si || 'අපේ පවුල්';
  const nextKickerEn = typeof heroKickerEn === 'string' ? heroKickerEn : existing?.hero_kicker_en || '';
  const nextKickerSi = typeof heroKickerSi === 'string' ? heroKickerSi : existing?.hero_kicker_si || '';
  const nextPhoto = typeof heroPhotoUrl === 'string' ? heroPhotoUrl : existing?.hero_photo_url || '';
  const nextEn = typeof welcomeEn === 'string' ? welcomeEn : existing?.welcome_en || '';
  const nextSi = typeof welcomeSi === 'string' ? welcomeSi : existing?.welcome_si || '';
  const nextAboutTitleEn = typeof aboutTitleEn === 'string' ? aboutTitleEn : existing?.about_title_en || 'ABOUT OUR FAMILIES ❤️';
  const nextAboutTitleSi = typeof aboutTitleSi === 'string' ? aboutTitleSi : existing?.about_title_si || 'අපේ පවුල් ගැන ❤️';
  const nextAboutStoryEn = typeof aboutStoryEn === 'string' ? aboutStoryEn : existing?.about_story_en || DEFAULT_ABOUT_STORY_EN;
  const nextAboutStorySi = typeof aboutStorySi === 'string' ? aboutStorySi : existing?.about_story_si || DEFAULT_ABOUT_STORY_SI;
  const updatedAt = nowIso();

  db.prepare(
    `UPDATE site_settings
     SET site_title_en = ?, site_title_si = ?, hero_kicker_en = ?, hero_kicker_si = ?,
         hero_photo_url = ?, welcome_en = ?, welcome_si = ?,
         about_title_en = ?, about_title_si = ?, about_story_en = ?, about_story_si = ?, updated_at = ?
     WHERE id = 'main'`
  ).run(
    nextSiteTitleEn,
    nextSiteTitleSi,
    nextKickerEn,
    nextKickerSi,
    nextPhoto,
    nextEn,
    nextSi,
    nextAboutTitleEn,
    nextAboutTitleSi,
    nextAboutStoryEn,
    nextAboutStorySi,
    updatedAt
  );

  createAndBroadcastNotification({
    type: 'family',
    titleEn: 'Site Settings Updated',
    titleSi: 'වෙබ් අඩවි තොරතුරු යාවත්කාලීන විය',
    bodyEn: `${authorName} updated the portal settings or welcome message.`,
    bodySi: `${authorName} වෙබ් අඩවි තොරතුරු හෝ පිළිගැනීමේ පණිවිඩය වෙනස් කළේය.`,
    linkTab: 'home',
    sourceClientId: clientId,
  });
  broadcastSync(clientId);

  res.json({
    siteTitleEn: nextSiteTitleEn,
    siteTitleSi: nextSiteTitleSi,
    heroKickerEn: nextKickerEn,
    heroKickerSi: nextKickerSi,
    heroPhotoUrl: nextPhoto,
    welcomeEn: nextEn,
    welcomeSi: nextSi,
    aboutTitleEn: nextAboutTitleEn,
    aboutTitleSi: nextAboutTitleSi,
    aboutStoryEn: nextAboutStoryEn,
    aboutStorySi: nextAboutStorySi,
    updatedAt,
  });
});

app.get('/api/families/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const familyId = String(req.params.id);
  const famRow = db
    .prepare(
      `SELECT f.*, COUNT(m.id) as member_count
       FROM families f
       LEFT JOIN members m ON m.family_id = f.id
       WHERE f.id = ?
       GROUP BY f.id`
    )
    .get(familyId) as any;

  if (!famRow) {
    res.status(404).json({ error: 'Family not found' });
    return;
  }

  const memberRows = db
    .prepare(
      `SELECT m.*, f.name_en as family_name_en, f.name_si as family_name_si
       FROM members m
       JOIN families f ON f.id = m.family_id
       WHERE m.family_id = ?
       ORDER BY m.created_at ASC`
    )
    .all(familyId) as any[];

  const tripRows = db
    .prepare('SELECT * FROM trips WHERE family_id = ? ORDER BY trip_date DESC, created_at DESC')
    .all(familyId) as any[];

  const picRows = db
    .prepare('SELECT * FROM gallery_items WHERE family_id = ? ORDER BY moment_date DESC, created_at DESC')
    .all(familyId) as any[];

  const eventRows = db
    .prepare('SELECT * FROM events WHERE family_id = ? ORDER BY event_date DESC, created_at DESC')
    .all(familyId) as any[];

  const birthdays = getUnifiedBirthdays(familyId);

  res.json({
    family: mapFamily(famRow),
    members: memberRows.map(mapMember),
    history: {
      trips: tripRows.map((r) => ({
        id: r.id,
        familyId: r.family_id,
        familyNameEn: famRow.name_en,
        familyNameSi: famRow.name_si,
        title: r.title,
        destination: r.destination,
        tripDate: r.trip_date,
        description: r.description,
        media: safeJsonParse(r.media_json, []),
        createdByName: r.created_by_name,
        createdAt: r.created_at,
        ...getLikeStats('trip', r.id, clientId),
      })),
      pictures: picRows.map((r) => ({
        id: r.id,
        familyId: r.family_id,
        familyNameEn: famRow.name_en,
        familyNameSi: famRow.name_si,
        title: r.title,
        location: r.location,
        caption: r.caption,
        momentDate: r.moment_date,
        kind: r.kind,
        mediaUrl: r.media_url,
        mediaType: r.media_type,
        uploadedByName: r.uploaded_by_name,
        createdAt: r.created_at,
        ...getLikeStats('gallery', r.id, clientId),
      })),
      events: eventRows.map((r) => ({
        id: r.id,
        familyId: r.family_id,
        familyNameEn: famRow.name_en,
        familyNameSi: famRow.name_si,
        title: r.title,
        category: r.category,
        eventDate: r.event_date,
        location: r.location,
        description: r.description,
        media: safeJsonParse(r.media_json, []),
        status: r.status,
        createdByName: r.created_by_name,
        createdAt: r.created_at,
        ...getLikeStats('event', r.id, clientId),
      })),
      birthdays,
    },
  });
});

app.post('/api/families', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const authorName = getAuthorHeader(req);
  const { nameEn, nameSi, descriptionEn, descriptionSi, coverPhotoUrl, sortOrder } = req.body || {};
  const cleanEn = typeof nameEn === 'string' ? nameEn.trim() : '';
  const cleanSi = typeof nameSi === 'string' ? nameSi.trim() : '';
  if (!cleanEn && !cleanSi) {
    res.status(400).json({ error: 'Family name is required' });
    return;
  }

  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM families')
    .get() as { m: number };
  const nextOrder =
    typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? sortOrder : maxOrderRow.m + 1;
  const id = uid('family');

  db.prepare(
    `INSERT INTO families (id, sort_order, name_en, name_si, description_en, description_si, cover_photo_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    nextOrder,
    cleanEn || cleanSi,
    cleanSi || cleanEn,
    typeof descriptionEn === 'string' ? descriptionEn : '',
    typeof descriptionSi === 'string' ? descriptionSi : '',
    typeof coverPhotoUrl === 'string' ? coverPhotoUrl : ''
  );

  const created = db
    .prepare(
      `SELECT f.*, 0 as member_count FROM families f WHERE f.id = ?`
    )
    .get(id) as any;

  createAndBroadcastNotification({
    type: 'family',
    titleEn: `New Family Added: ${cleanEn || cleanSi}`,
    titleSi: `නව පවුලක් එක් විය: ${cleanSi || cleanEn}`,
    bodyEn: `${authorName} added ${cleanEn || cleanSi} to Our Families.`,
    bodySi: `${authorName} ${cleanSi || cleanEn} පවුල එක් කළේය.`,
    linkTab: 'families',
    sourceClientId: clientId,
  });
  broadcastSync(clientId);

  res.status(201).json({ family: mapFamily(created) });
});

app.post('/api/families/reorder', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const orderedIds = Array.isArray(req.body?.orderedIds) ? (req.body.orderedIds as string[]) : [];
  const stmt = db.prepare('UPDATE families SET sort_order = ? WHERE id = ?');
  orderedIds.forEach((fid, idx) => {
    stmt.run(idx + 1, String(fid));
  });
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.patch('/api/families/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const authorName = getAuthorHeader(req);
  const familyId = String(req.params.id);
  const existing = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId) as any;
  if (!existing) {
    res.status(404).json({ error: 'Family not found' });
    return;
  }

  const { nameEn, nameSi, descriptionEn, descriptionSi, coverPhotoUrl, sortOrder } = req.body || {};
  const nextNameEn = typeof nameEn === 'string' && nameEn.trim() ? nameEn.trim() : existing.name_en;
  const nextNameSi = typeof nameSi === 'string' && nameSi.trim() ? nameSi.trim() : existing.name_si;
  const nextDescEn = typeof descriptionEn === 'string' ? descriptionEn : existing.description_en;
  const nextDescSi = typeof descriptionSi === 'string' ? descriptionSi : existing.description_si;
  const nextCover = typeof coverPhotoUrl === 'string' ? coverPhotoUrl : existing.cover_photo_url;
  const nextOrder =
    typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? sortOrder : existing.sort_order;

  db.prepare(
    `UPDATE families SET sort_order = ?, name_en = ?, name_si = ?, description_en = ?, description_si = ?, cover_photo_url = ? WHERE id = ?`
  ).run(nextOrder, nextNameEn, nextNameSi, nextDescEn, nextDescSi, nextCover, familyId);

  const updated = db
    .prepare(
      `SELECT f.*, COUNT(m.id) as member_count
       FROM families f
       LEFT JOIN members m ON m.family_id = f.id
       WHERE f.id = ?
       GROUP BY f.id`
    )
    .get(familyId) as any;

  createAndBroadcastNotification({
    type: 'family',
    titleEn: `${nextNameEn} Updated`,
    titleSi: `${nextNameSi} යාවත්කාලීන විය`,
    bodyEn: `${authorName} updated details for ${nextNameEn}.`,
    bodySi: `${authorName} ${nextNameSi} පිළිබඳ තොරතුරු යාවත්කාලීන කළේය.`,
    linkTab: 'families',
    sourceClientId: clientId,
  });
  broadcastSync(clientId);

  res.json({ family: mapFamily(updated) });
});

app.delete('/api/families/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const familyId = String(req.params.id);
  db.prepare('DELETE FROM members WHERE family_id = ?').run(familyId);
  db.prepare('UPDATE birthdays SET family_id = NULL WHERE family_id = ?').run(familyId);
  db.prepare('UPDATE events SET family_id = NULL WHERE family_id = ?').run(familyId);
  db.prepare('UPDATE gallery_items SET family_id = NULL WHERE family_id = ?').run(familyId);
  db.prepare('UPDATE announcements SET family_id = NULL WHERE family_id = ?').run(familyId);
  db.prepare('DELETE FROM trips WHERE family_id = ?').run(familyId);
  db.prepare('DELETE FROM chat_messages WHERE room_id = ?').run(familyId);
  db.prepare('DELETE FROM families WHERE id = ?').run(familyId);
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.get('/api/members/search', (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) {
    res.json({ members: [] });
    return;
  }
  const like = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT m.*, f.name_en as family_name_en, f.name_si as family_name_si
       FROM members m
       JOIN families f ON f.id = m.family_id
       WHERE LOWER(m.name) LIKE ?
          OR LOWER(m.relationship) LIKE ?
          OR LOWER(m.description) LIKE ?
          OR LOWER(f.name_en) LIKE ?
          OR LOWER(f.name_si) LIKE ?
       ORDER BY m.name ASC
       LIMIT 25`
    )
    .all(like, like, like, like, like) as any[];

  res.json({ members: rows.map(mapMember) });
});

app.post('/api/families/:id/members', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const authorName = getAuthorHeader(req);
  const familyId = String(req.params.id);
  const fam = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId) as any;
  if (!fam) {
    res.status(404).json({ error: 'Family not found' });
    return;
  }

  const { name, relationship, birthday, photoUrl, description } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Member name is required' });
    return;
  }

  const id = uid('mem');
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO members (id, family_id, name, relationship, birthday, photo_url, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    familyId,
    name.trim(),
    typeof relationship === 'string' && relationship ? relationship : 'Other',
    typeof birthday === 'string' ? birthday : '',
    typeof photoUrl === 'string' ? photoUrl : '',
    typeof description === 'string' ? description : '',
    createdAt
  );

  const row = db
    .prepare(
      `SELECT m.*, f.name_en as family_name_en, f.name_si as family_name_si
       FROM members m JOIN families f ON f.id = m.family_id WHERE m.id = ?`
    )
    .get(id) as any;

  createAndBroadcastNotification({
    type: 'family',
    titleEn: 'New Family Member Added',
    titleSi: 'නව පවුලේ සාමාජිකයෙකු එක් විය',
    bodyEn: `${authorName} added ${name.trim()} to ${fam.name_en}.`,
    bodySi: `${authorName} ${fam.name_si} වෙත ${name.trim()} එක් කළේය.`,
    linkTab: 'families',
    sourceClientId: clientId,
  });
  broadcastSync(clientId);

  res.status(201).json({ member: mapMember(row) });
});

app.patch('/api/members/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const memberId = String(req.params.id);
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId) as any;
  if (!existing) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const { name, relationship, birthday, photoUrl, description } = req.body || {};
  db.prepare(
    `UPDATE members SET name = ?, relationship = ?, birthday = ?, photo_url = ?, description = ? WHERE id = ?`
  ).run(
    typeof name === 'string' && name.trim() ? name.trim() : existing.name,
    typeof relationship === 'string' && relationship ? relationship : existing.relationship,
    typeof birthday === 'string' ? birthday : existing.birthday,
    typeof photoUrl === 'string' ? photoUrl : existing.photo_url,
    typeof description === 'string' ? description : existing.description,
    memberId
  );

  const row = db
    .prepare(
      `SELECT m.*, f.name_en as family_name_en, f.name_si as family_name_si
       FROM members m JOIN families f ON f.id = m.family_id WHERE m.id = ?`
    )
    .get(memberId) as any;

  broadcastSync(clientId);
  res.json({ member: mapMember(row) });
});

app.delete('/api/members/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const memberId = String(req.params.id);
  db.prepare('DELETE FROM members WHERE id = ?').run(memberId);
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  try {
    const fileBuf = fs.readFileSync(req.file.path);
    db.prepare(
      `INSERT OR REPLACE INTO uploaded_files (filename, mime_type, data, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(req.file.filename, req.file.mimetype || 'application/octet-stream', fileBuf, nowIso());
  } catch {
    // keep serving from disk even if SQLite blob backup fails
  }
  const isVideo = req.file.mimetype.startsWith('video/');
  res.json({
    url: `/uploads/${req.file.filename}`,
    type: isVideo ? 'video' : 'image',
    name: req.file.originalname,
  });
});

app.get('/api/birthdays', (_req: Request, res: Response) => {
  res.json({ birthdays: getUnifiedBirthdays() });
});

app.post('/api/birthdays', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const authorName = getAuthorHeader(req);
  const { memberName, birthDate, familyId, photoUrl, notes } = req.body || {};
  if (!memberName || !birthDate) {
    res.status(400).json({ error: 'Name and birth date are required' });
    return;
  }
  const id = uid('bday');
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO birthdays (id, family_id, member_name, birth_date, photo_url, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    familyId || null,
    String(memberName).trim(),
    String(birthDate).trim(),
    typeof photoUrl === 'string' ? photoUrl : '',
    typeof notes === 'string' ? notes : '',
    createdAt
  );

  createAndBroadcastNotification({
    type: 'birthday',
    titleEn: 'Birthday Added',
    titleSi: 'උපන්දිනයක් එක් කරන ලදී',
    bodyEn: `${authorName} added ${String(memberName).trim()}'s birthday (${birthDate}).`,
    bodySi: `${authorName} ${String(memberName).trim()} ගේ උපන්දිනය (${birthDate}) එක් කළේය.`,
    linkTab: 'features',
    sourceClientId: clientId,
  });
  broadcastSync(clientId);

  res.status(201).json({
    birthday: {
      id,
      targetKey: `birthday-${id}`,
      source: 'birthday',
      familyId: familyId || null,
      memberName: String(memberName).trim(),
      birthDate: String(birthDate).trim(),
      photoUrl: photoUrl || '',
      notes: notes || '',
      wishes: [],
    },
  });
});

app.patch('/api/birthdays/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const id = String(req.params.id);
  const existing = db.prepare('SELECT * FROM birthdays WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Birthday not found' });
    return;
  }
  const { memberName, birthDate, familyId, photoUrl, notes } = req.body || {};
  db.prepare(
    `UPDATE birthdays SET member_name = ?, birth_date = ?, family_id = ?, photo_url = ?, notes = ? WHERE id = ?`
  ).run(
    typeof memberName === 'string' && memberName.trim() ? memberName.trim() : existing.member_name,
    typeof birthDate === 'string' && birthDate.trim() ? birthDate.trim() : existing.birth_date,
    familyId === undefined ? existing.family_id : familyId || null,
    typeof photoUrl === 'string' ? photoUrl : existing.photo_url,
    typeof notes === 'string' ? notes : existing.notes,
    id
  );
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.delete('/api/birthdays/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const id = String(req.params.id);
  db.prepare('DELETE FROM birthdays WHERE id = ?').run(id);
  db.prepare('DELETE FROM birthday_wishes WHERE target_key = ?').run(`birthday-${id}`);
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.post('/api/birthdays/:targetKey/wishes', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const targetKey = String(req.params.targetKey);
  const { message, authorName, authorAvatar, authorAvatars } = req.body || {};
  if (!message || !String(message).trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const id = uid('wish');
  const createdAt = nowIso();
  const cleanAuthor = String(authorName || 'Family Member').trim();
  const avatars = Array.isArray(authorAvatars) ? authorAvatars : [];

  db.prepare(
    `INSERT INTO birthday_wishes (id, target_key, author_name, author_avatar, author_avatars, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    targetKey,
    cleanAuthor,
    typeof authorAvatar === 'string' ? authorAvatar : '',
    JSON.stringify(avatars),
    String(message).trim(),
    createdAt
  );

  createAndBroadcastNotification({
    type: 'wish',
    titleEn: 'New Birthday Wish 🎂',
    titleSi: 'නව උපන්දින සුභ පැතුමක් 🎂',
    bodyEn: `${cleanAuthor} sent a birthday wish: "${String(message).trim()}"`,
    bodySi: `${cleanAuthor} උපන්දින සුභ පැතුමක් එවා ඇත: "${String(message).trim()}"`,
    linkTab: 'features',
    sourceClientId: clientId,
  });
  broadcastSync(clientId);

  res.status(201).json({
    wish: {
      id,
      targetKey,
      authorName: cleanAuthor,
      authorAvatar: authorAvatar || '',
      authorAvatars: avatars,
      message: String(message).trim(),
      createdAt,
    },
  });
});

app.get('/api/trips', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const rows = db
    .prepare(
      `SELECT t.*, f.name_en as family_name_en, f.name_si as family_name_si
       FROM trips t
       LEFT JOIN families f ON f.id = t.family_id
       ORDER BY t.trip_date DESC, t.created_at DESC`
    )
    .all() as any[];

  res.json({
    trips: rows.map((r) => ({
      id: r.id,
      familyId: r.family_id,
      familyNameEn: r.family_name_en || '',
      familyNameSi: r.family_name_si || '',
      title: r.title,
      destination: r.destination,
      tripDate: r.trip_date,
      description: r.description,
      media: safeJsonParse(r.media_json, []),
      createdByName: r.created_by_name,
      createdAt: r.created_at,
      ...getLikeStats('trip', r.id, clientId),
    })),
  });
});

app.post('/api/trips', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const { title, destination, tripDate, familyId, description, media, authorName } = req.body || {};
  const famExists = familyId
    ? db.prepare('SELECT id FROM families WHERE id = ?').get(String(familyId))
    : undefined;
  if (!familyId || !famExists) {
    res.status(400).json({ error: 'Please select which family is taking this trip.' });
    return;
  }
  if (!title || !destination || !tripDate) {
    res.status(400).json({ error: 'Trip title, destination, and date are required' });
    return;
  }

  const id = uid('trip');
  const createdAt = nowIso();
  const cleanAuthor = String(authorName || 'Family Member').trim();
  db.prepare(
    `INSERT INTO trips (id, family_id, title, destination, trip_date, description, media_json, created_by_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    String(familyId),
    String(title).trim(),
    String(destination).trim(),
    String(tripDate).trim(),
    typeof description === 'string' ? description : '',
    JSON.stringify(Array.isArray(media) ? media : []),
    cleanAuthor,
    createdAt
  );

  createAndBroadcastNotification({
    type: 'trip',
    titleEn: `New Family Trip: ${String(title).trim()}`,
    titleSi: `නව පවුලේ චාරිකාවක්: ${String(title).trim()}`,
    bodyEn: `${cleanAuthor} posted a trip to ${String(destination).trim()} on ${tripDate}.`,
    bodySi: `${cleanAuthor} ${tripDate} දින ${String(destination).trim()} චාරිකාව එක් කළේය.`,
    linkTab: 'features',
    sourceClientId: clientId,
  });
  broadcastSync(clientId);

  res.status(201).json({
    trip: {
      id,
      familyId,
      title: String(title).trim(),
      destination: String(destination).trim(),
      tripDate: String(tripDate).trim(),
      description: description || '',
      media: Array.isArray(media) ? media : [],
      createdByName: cleanAuthor,
      createdAt,
      likeCount: 0,
      likedByMe: false,
    },
  });
});

app.patch('/api/trips/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const id = String(req.params.id);
  const existing = db.prepare('SELECT * FROM trips WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }
  const { title, destination, tripDate, familyId, description } = req.body || {};
  db.prepare(
    `UPDATE trips SET family_id = ?, title = ?, destination = ?, trip_date = ?, description = ? WHERE id = ?`
  ).run(
    typeof familyId === 'string' && familyId ? familyId : existing.family_id,
    typeof title === 'string' && title.trim() ? title.trim() : existing.title,
    typeof destination === 'string' && destination.trim() ? destination.trim() : existing.destination,
    typeof tripDate === 'string' && tripDate.trim() ? tripDate.trim() : existing.trip_date,
    typeof description === 'string' ? description : existing.description,
    id
  );
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.delete('/api/trips/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  db.prepare('DELETE FROM trips WHERE id = ?').run(String(req.params.id));
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.get('/api/events', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const rows = db
    .prepare(
      `SELECT e.*, f.name_en as family_name_en, f.name_si as family_name_si
       FROM events e
       LEFT JOIN families f ON f.id = e.family_id
       ORDER BY e.event_date DESC, e.created_at DESC`
    )
    .all() as any[];

  res.json({
    events: rows.map((r) => ({
      id: r.id,
      familyId: r.family_id,
      familyNameEn: r.family_name_en || '',
      familyNameSi: r.family_name_si || '',
      title: r.title,
      category: r.category,
      eventDate: r.event_date,
      location: r.location,
      description: r.description,
      media: safeJsonParse(r.media_json, []),
      status: r.status,
      createdByName: r.created_by_name,
      createdAt: r.created_at,
      ...getLikeStats('event', r.id, clientId),
    })),
  });
});

app.post('/api/events', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const { title, category, eventDate, location, familyId, description, media, authorName } =
    req.body || {};
  if (!title || !eventDate) {
    res.status(400).json({ error: 'Event title and date are required' });
    return;
  }

  const id = uid('event');
  const createdAt = nowIso();
  const cleanAuthor = String(authorName || 'Family Member').trim();
  db.prepare(
    `INSERT INTO events (id, family_id, title, category, event_date, location, description, media_json, status, created_by_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`
  ).run(
    id,
    familyId || null,
    String(title).trim(),
    String(category || 'celebration'),
    String(eventDate).trim(),
    typeof location === 'string' ? location : '',
    typeof description === 'string' ? description : '',
    JSON.stringify(Array.isArray(media) ? media : []),
    cleanAuthor,
    createdAt
  );

  createAndBroadcastNotification({
    type: 'event',
    titleEn: `New Special Event: ${String(title).trim()}`,
    titleSi: `නව විශේෂ උත්සවයක්: ${String(title).trim()}`,
    bodyEn: `${cleanAuthor} added "${String(title).trim()}" on ${eventDate}.`,
    bodySi: `${cleanAuthor} "${String(title).trim()}" (${eventDate}) උත්සවය එක් කළේය.`,
    linkTab: 'features',
    sourceClientId: clientId,
  });
  broadcastSync(clientId);

  res.status(201).json({
    event: {
      id,
      familyId: familyId || null,
      title: String(title).trim(),
      category: category || 'celebration',
      eventDate: String(eventDate).trim(),
      location: location || '',
      description: description || '',
      media: Array.isArray(media) ? media : [],
      status: 'approved',
      createdByName: cleanAuthor,
      createdAt,
      likeCount: 0,
      likedByMe: false,
    },
  });
});

app.patch('/api/events/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const id = String(req.params.id);
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  const { status, title, category, eventDate, location, familyId, description } = req.body || {};
  db.prepare(
    `UPDATE events SET title = ?, category = ?, event_date = ?, location = ?, family_id = ?, description = ?, status = ? WHERE id = ?`
  ).run(
    typeof title === 'string' && title.trim() ? title.trim() : existing.title,
    typeof category === 'string' && category ? category : existing.category,
    typeof eventDate === 'string' && eventDate.trim() ? eventDate.trim() : existing.event_date,
    typeof location === 'string' ? location : existing.location,
    familyId === undefined ? existing.family_id : familyId || null,
    typeof description === 'string' ? description : existing.description,
    status === 'suggested' ? 'suggested' : status === 'approved' ? 'approved' : existing.status,
    id
  );
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.delete('/api/events/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  db.prepare('DELETE FROM events WHERE id = ?').run(String(req.params.id));
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.get('/api/gallery', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const rows = db
    .prepare(
      `SELECT g.*, f.name_en as family_name_en, f.name_si as family_name_si
       FROM gallery_items g
       LEFT JOIN families f ON f.id = g.family_id
       ORDER BY g.moment_date DESC, g.created_at DESC`
    )
    .all() as any[];

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      familyId: r.family_id,
      familyNameEn: r.family_name_en || '',
      familyNameSi: r.family_name_si || '',
      title: r.title,
      location: r.location,
      caption: r.caption,
      momentDate: r.moment_date,
      kind: r.kind,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      uploadedByName: r.uploaded_by_name,
      createdAt: r.created_at,
      ...getLikeStats('gallery', r.id, clientId),
    })),
  });
});

app.post('/api/gallery', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const { title, location, caption, momentDate, kind, familyId, mediaUrl, mediaType, authorName } =
    req.body || {};
  if (!title || !mediaUrl) {
    res.status(400).json({ error: 'Title and media are required' });
    return;
  }

  const id = uid('gal');
  const createdAt = nowIso();
  const cleanAuthor = String(authorName || 'Family Member').trim();
  const dateVal = momentDate || createdAt.slice(0, 10);

  db.prepare(
    `INSERT INTO gallery_items (id, family_id, title, location, caption, moment_date, kind, media_url, media_type, uploaded_by_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    familyId || null,
    String(title).trim(),
    typeof location === 'string' ? location.trim() : '',
    typeof caption === 'string' ? caption.trim() : '',
    dateVal,
    kind === 'timeline' || kind === 'moment' ? kind : 'gallery',
    String(mediaUrl),
    mediaType === 'video' ? 'video' : 'image',
    cleanAuthor,
    createdAt
  );

  createAndBroadcastNotification({
    type: 'gallery',
    titleEn: `New Family Memory: ${String(title).trim()}`,
    titleSi: `නව පවුලේ මතකයක්: ${String(title).trim()}`,
    bodyEn: `${cleanAuthor} shared "${String(title).trim()}" in Gallery & Moments.`,
    bodySi: `${cleanAuthor} "${String(title).trim()}" ගැලරියට එක් කළේය.`,
    linkTab: 'moments',
    sourceClientId: clientId,
  });
  broadcastSync(clientId);

  res.status(201).json({
    item: {
      id,
      familyId: familyId || null,
      title: String(title).trim(),
      location: location || '',
      caption: caption || '',
      momentDate: dateVal,
      kind: kind || 'gallery',
      mediaUrl,
      mediaType: mediaType === 'video' ? 'video' : 'image',
      uploadedByName: cleanAuthor,
      createdAt,
      likeCount: 0,
      likedByMe: false,
    },
  });
});

app.patch('/api/gallery/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const id = String(req.params.id);
  const existing = db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  const { title, location, caption, momentDate, kind, familyId } = req.body || {};
  db.prepare(
    `UPDATE gallery_items SET title = ?, location = ?, caption = ?, moment_date = ?, kind = ?, family_id = ? WHERE id = ?`
  ).run(
    typeof title === 'string' && title.trim() ? title.trim() : existing.title,
    typeof location === 'string' ? location : existing.location,
    typeof caption === 'string' ? caption : existing.caption,
    typeof momentDate === 'string' && momentDate ? momentDate : existing.moment_date,
    kind === 'timeline' || kind === 'moment' || kind === 'gallery' ? kind : existing.kind,
    familyId === undefined ? existing.family_id : familyId || null,
    id
  );
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.delete('/api/gallery/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  db.prepare('DELETE FROM gallery_items WHERE id = ?').run(String(req.params.id));
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.post('/api/likes/toggle', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const { targetType, targetId, authorName, itemTitle } = req.body || {};
  if (!targetType || !targetId) {
    res.status(400).json({ error: 'targetType and targetId are required' });
    return;
  }

  const existing = db
    .prepare('SELECT 1 FROM likes WHERE target_type = ? AND target_id = ? AND client_id = ?')
    .get(String(targetType), String(targetId), clientId);

  let likedByMe = false;
  if (existing) {
    db.prepare('DELETE FROM likes WHERE target_type = ? AND target_id = ? AND client_id = ?').run(
      String(targetType),
      String(targetId),
      clientId
    );
    likedByMe = false;
  } else {
    db.prepare(
      'INSERT INTO likes (target_type, target_id, client_id, created_at) VALUES (?, ?, ?, ?)'
    ).run(String(targetType), String(targetId), clientId, nowIso());
    likedByMe = true;
    if (itemTitle) {
      createAndBroadcastNotification({
        type: 'like',
        titleEn: 'New Appreciation ❤️',
        titleSi: 'නව ආදරණීය ප්‍රතිචාරයක් ❤️',
        bodyEn: `${authorName || 'Someone'} loved "${itemTitle}".`,
        bodySi: `${authorName || 'කෙනෙකු'} "${itemTitle}" සඳහා කැමැත්ත පළ කළේය.`,
        linkTab: targetType === 'gallery' ? 'moments' : 'features',
        sourceClientId: clientId,
      });
    }
  }

  const stats = getLikeStats(String(targetType), String(targetId), clientId);
  broadcastSync(clientId);
  res.json({ likeCount: stats.likeCount, likedByMe });
});

app.get('/api/announcements', (_req: Request, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM announcements ORDER BY created_at DESC')
    .all() as any[];

  res.json({
    announcements: rows.map((r) => ({
      id: r.id,
      familyId: r.family_id,
      title: r.title,
      body: r.body,
      priority: r.priority,
      authorName: r.author_name,
      createdAt: r.created_at,
    })),
  });
});

app.post('/api/announcements', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const { title, body, priority, familyId, authorName } = req.body || {};
  if (!title || !body) {
    res.status(400).json({ error: 'Title and body are required' });
    return;
  }

  const id = uid('ann');
  const createdAt = nowIso();
  const cleanAuthor = String(authorName || 'Family Member').trim();

  db.prepare(
    `INSERT INTO announcements (id, family_id, title, body, priority, author_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    familyId || null,
    String(title).trim(),
    String(body).trim(),
    priority === 'important' ? 'important' : 'normal',
    cleanAuthor,
    createdAt
  );

  createAndBroadcastNotification({
    type: 'announcement',
    titleEn: `Announcement: ${String(title).trim()}`,
    titleSi: `නිවේදනය: ${String(title).trim()}`,
    bodyEn: `${cleanAuthor} posted: ${String(body).trim().slice(0, 80)}`,
    bodySi: `${cleanAuthor} නව නිවේදනයක් පළ කළේය.`,
    linkTab: 'moments',
    sourceClientId: clientId,
  });
  broadcastSync(clientId);

  res.status(201).json({
    announcement: {
      id,
      familyId: familyId || null,
      title: String(title).trim(),
      body: String(body).trim(),
      priority: priority === 'important' ? 'important' : 'normal',
      authorName: cleanAuthor,
      createdAt,
    },
  });
});

app.patch('/api/announcements/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const id = String(req.params.id);
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }
  const { title, body, priority, familyId } = req.body || {};
  db.prepare(
    `UPDATE announcements SET title = ?, body = ?, priority = ?, family_id = ? WHERE id = ?`
  ).run(
    typeof title === 'string' && title.trim() ? title.trim() : existing.title,
    typeof body === 'string' && body.trim() ? body.trim() : existing.body,
    priority === 'important' ? 'important' : priority === 'normal' ? 'normal' : existing.priority,
    familyId === undefined ? existing.family_id : familyId || null,
    id
  );
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.delete('/api/announcements/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  db.prepare('DELETE FROM announcements WHERE id = ?').run(String(req.params.id));
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.get('/api/notifications', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const rows = db
    .prepare(
      `SELECT n.*, CASE WHEN nr.client_id IS NOT NULL THEN 1 ELSE 0 END as is_read
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.client_id = ?
       ORDER BY n.created_at DESC
       LIMIT 40`
    )
    .all(clientId) as any[];

  res.json({
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      titleEn: r.title_en,
      titleSi: r.title_si,
      bodyEn: r.body_en,
      bodySi: r.body_si,
      linkTab: r.link_tab,
      isRead: Boolean(r.is_read),
      createdAt: r.created_at,
    })),
  });
});

app.post('/api/notifications/read-all', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const ids = db.prepare('SELECT id FROM notifications').all() as { id: string }[];
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO notification_reads (notification_id, client_id) VALUES (?, ?)'
  );
  for (const row of ids) {
    stmt.run(row.id, clientId);
  }
  res.json({ ok: true });
});

app.get('/api/chat/rooms', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const famRows = db.prepare('SELECT * FROM families ORDER BY sort_order ASC').all() as any[];

  const roomsList: {
    roomId: string;
    nameEn: string;
    nameSi: string;
    coverPhotoUrl: string;
  }[] = [
    {
      roomId: 'all',
      nameEn: 'All Families Group',
      nameSi: 'සියලුම පවුල් සමූහ චැට්',
      coverPhotoUrl: '',
    },
    ...famRows.map((f) => ({
      roomId: f.id,
      nameEn: f.name_en,
      nameSi: f.name_si,
      coverPhotoUrl: f.cover_photo_url,
    })),
  ];

  const enriched = roomsList.map((room) => {
    const readRow = db
      .prepare('SELECT last_read_at FROM chat_room_reads WHERE room_id = ? AND client_id = ?')
      .get(room.roomId, clientId) as { last_read_at: string } | undefined;
    const lastReadAt = readRow?.last_read_at || '1970-01-01T00:00:00.000Z';

    const unreadRow = db
      .prepare(
        `SELECT COUNT(*) as c FROM chat_messages
         WHERE room_id = ? AND created_at > ? AND sender_id != ?`
      )
      .get(room.roomId, lastReadAt, clientId) as { c: number };

    const lastMsgRow = db
      .prepare('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(room.roomId) as any;

    return {
      roomId: room.roomId,
      nameEn: room.nameEn,
      nameSi: room.nameSi,
      coverPhotoUrl: room.coverPhotoUrl,
      unreadCount: unreadRow.c,
      lastMessage: lastMsgRow
        ? {
            id: lastMsgRow.id,
            roomId: lastMsgRow.room_id,
            senderId: lastMsgRow.sender_id,
            senderName: lastMsgRow.sender_name,
            senderAvatar: lastMsgRow.sender_avatar,
            senderAvatars: safeJsonParse(lastMsgRow.sender_avatars, []),
            text: lastMsgRow.text,
            mediaUrl: lastMsgRow.media_url,
            mediaType: lastMsgRow.media_type,
            createdAt: lastMsgRow.created_at,
          }
        : undefined,
    };
  });

  res.json({ rooms: enriched });
});

app.get('/api/chat/messages', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const roomId = String(req.query.roomId || 'all');

  db.prepare(
    `INSERT INTO chat_room_reads (room_id, client_id, last_read_at)
     VALUES (?, ?, ?)
     ON CONFLICT(room_id, client_id) DO UPDATE SET last_read_at = excluded.last_read_at`
  ).run(roomId, clientId, nowIso());

  const rows = db
    .prepare('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at ASC LIMIT 200')
    .all(roomId) as any[];

  res.json({
    messages: rows.map((r) => ({
      id: r.id,
      roomId: r.room_id,
      senderId: r.sender_id,
      senderName: r.sender_name,
      senderAvatar: r.sender_avatar,
      senderAvatars: safeJsonParse(r.sender_avatars, []),
      text: r.text,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      createdAt: r.created_at,
    })),
  });
});

app.post('/api/chat/messages', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const { roomId, text, mediaUrl, mediaType, senderName, senderAvatar, senderAvatars } =
    req.body || {};
  const cleanRoom = String(roomId || 'all');
  const cleanText = typeof text === 'string' ? text.trim() : '';
  const cleanMedia = typeof mediaUrl === 'string' ? mediaUrl : '';
  if (!cleanText && !cleanMedia) {
    res.status(400).json({ error: 'Message text or media is required' });
    return;
  }

  const id = uid('msg');
  const createdAt = nowIso();
  const cleanName = String(senderName || 'Family Member').trim();
  const avatars = Array.isArray(senderAvatars) ? senderAvatars : [];

  db.prepare(
    `INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, sender_avatars, text, media_url, media_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    cleanRoom,
    clientId,
    cleanName,
    typeof senderAvatar === 'string' ? senderAvatar : '',
    JSON.stringify(avatars),
    cleanText,
    cleanMedia,
    mediaType || null,
    createdAt
  );

  db.prepare(
    `INSERT INTO chat_room_reads (room_id, client_id, last_read_at)
     VALUES (?, ?, ?)
     ON CONFLICT(room_id, client_id) DO UPDATE SET last_read_at = excluded.last_read_at`
  ).run(cleanRoom, clientId, createdAt);

  const message = {
    id,
    roomId: cleanRoom,
    senderId: clientId,
    senderName: cleanName,
    senderAvatar: senderAvatar || '',
    senderAvatars: avatars,
    text: cleanText,
    mediaUrl: cleanMedia,
    mediaType: mediaType || null,
    createdAt,
  };

  const version = bumpSyncVersion();
  broadcastWs({ type: 'chat:message', message, version });
  res.status(201).json({ message });
});

app.post('/api/chat/read', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const roomId = String(req.body?.roomId || 'all');
  db.prepare(
    `INSERT INTO chat_room_reads (room_id, client_id, last_read_at)
     VALUES (?, ?, ?)
     ON CONFLICT(room_id, client_id) DO UPDATE SET last_read_at = excluded.last_read_at`
  ).run(roomId, clientId, nowIso());
  res.json({ ok: true });
});

app.delete('/api/chat/messages/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(String(req.params.id));
  broadcastSync(clientId);
  res.json({ ok: true });
});

app.get('/api/admin/export', (_req: Request, res: Response) => {
  const siteSettings = db.prepare('SELECT * FROM site_settings WHERE id = ?').get('main') || null;
  const families = db.prepare('SELECT * FROM families ORDER BY sort_order ASC').all();
  const members = db.prepare('SELECT * FROM members').all();
  const birthdays = db.prepare('SELECT * FROM birthdays').all();
  const birthdayWishes = db.prepare('SELECT * FROM birthday_wishes').all();
  const trips = db.prepare('SELECT * FROM trips').all();
  const events = db.prepare('SELECT * FROM events').all();
  const galleryItems = db.prepare('SELECT * FROM gallery_items').all();
  const announcements = db.prepare('SELECT * FROM announcements').all();
  const chatMessages = db.prepare('SELECT * FROM chat_messages').all();
  res.json({
    exportedAt: nowIso(),
    siteSettings,
    families,
    members,
    birthdays,
    birthdayWishes,
    trips,
    events,
    galleryItems,
    announcements,
    chatMessages,
  });
});

app.post('/api/admin/import', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const data = req.body || {};
  if (!data || !Array.isArray(data.families)) {
    res.status(400).json({ error: 'Invalid backup file' });
    return;
  }

  db.exec('BEGIN TRANSACTION');
  try {
    if (data.siteSettings && typeof data.siteSettings === 'object') {
      const s = data.siteSettings;
      db.prepare(
        `INSERT OR REPLACE INTO site_settings (
          id, site_title_en, site_title_si, hero_kicker_en, hero_kicker_si,
          hero_photo_url, welcome_en, welcome_si,
          about_title_en, about_title_si, about_story_en, about_story_si, updated_at
        ) VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        s.site_title_en || s.siteTitleEn || 'OUR FAMILIES',
        s.site_title_si || s.siteTitleSi || 'අපේ පවුල්',
        s.hero_kicker_en || s.heroKickerEn || '',
        s.hero_kicker_si || s.heroKickerSi || '',
        s.hero_photo_url || s.heroPhotoUrl || '',
        s.welcome_en || s.welcomeEn || '',
        s.welcome_si || s.welcomeSi || '',
        s.about_title_en || s.aboutTitleEn || 'ABOUT OUR FAMILIES ❤️',
        s.about_title_si || s.aboutTitleSi || 'අපේ පවුල් ගැන ❤️',
        s.about_story_en || s.aboutStoryEn || DEFAULT_ABOUT_STORY_EN,
        s.about_story_si || s.aboutStorySi || DEFAULT_ABOUT_STORY_SI,
        nowIso()
      );
    }

    db.prepare('DELETE FROM members').run();
    db.prepare('DELETE FROM families').run();
    const insFam = db.prepare(
      `INSERT INTO families (id, sort_order, name_en, name_si, description_en, description_si, cover_photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    data.families.forEach((f: any, idx: number) => {
      insFam.run(
        String(f.id || uid('family')),
        Number(f.sort_order ?? f.sortOrder ?? idx + 1),
        String(f.name_en ?? f.nameEn ?? `Family ${idx + 1}`),
        String(f.name_si ?? f.nameSi ?? `පවුල ${idx + 1}`),
        String(f.description_en ?? f.descriptionEn ?? ''),
        String(f.description_si ?? f.descriptionSi ?? ''),
        String(f.cover_photo_url ?? f.coverPhotoUrl ?? '')
      );
    });

    if (Array.isArray(data.members)) {
      const insMem = db.prepare(
        `INSERT INTO members (id, family_id, name, relationship, birthday, photo_url, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const m of data.members) {
        insMem.run(
          String(m.id || uid('mem')),
          String(m.family_id ?? m.familyId),
          String(m.name || 'Member'),
          String(m.relationship || 'Other'),
          String(m.birthday || ''),
          String(m.photo_url ?? m.photoUrl ?? ''),
          String(m.description || ''),
          String(m.created_at ?? m.createdAt ?? nowIso())
        );
      }
    }

    db.exec('COMMIT');
    broadcastSync(clientId);
    res.json({ ok: true });
  } catch (err: any) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err.message || 'Import failed' });
  }
});

app.post('/api/admin/reset', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  db.exec('DELETE FROM members; DELETE FROM birthdays; DELETE FROM birthday_wishes; DELETE FROM trips; DELETE FROM events; DELETE FROM gallery_items; DELETE FROM likes; DELETE FROM announcements; DELETE FROM notifications; DELETE FROM notification_reads; DELETE FROM chat_messages; DELETE FROM chat_room_reads; DELETE FROM families; DELETE FROM site_settings;');
  seedIfEmpty();
  broadcastSync(clientId);
  res.json({ ok: true });
});

// --- Multer / Express Error Handler ---
app.use((err: Error, _req: Request, res: Response, _next: () => void) => {
  res.status(400).json({ error: err.message || 'Request error' });
});

// --- Vite Dev / Production Static Serving ---
async function startServer() {
  const isDevMode =
    process.env.npm_lifecycle_event === 'dev' || process.env.NODE_ENV === 'development';
  const hasDistBuild = fs.existsSync(path.join(DIST_DIR, 'index.html'));
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    (!isDevMode && hasDistBuild);

  const staticOptions = {
    setHeaders: (res: Response, filePath: string) => {
      if (
        filePath.endsWith('sw.js') ||
        filePath.endsWith('manifest.webmanifest') ||
        filePath.endsWith('manifest.json')
      ) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  };

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const isHmrDisabled = process.env.DISABLE_HMR === 'true';
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          allowedHosts: true,
          ws: { server },
          hmr: isHmrDisabled ? false : { server },
          watch: isHmrDisabled ? null : {},
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch {
      if (fs.existsSync(DIST_DIR)) {
        app.use(express.static(DIST_DIR, staticOptions));
        app.get('*', (req: Request, res: Response) => {
          if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
            res.status(404).json({ error: 'Not found' });
            return;
          }
          res.sendFile(path.join(DIST_DIR, 'index.html'));
        });
      }
    }
  } else {
    app.use(express.static(DIST_DIR, staticOptions));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`OUR FAMILIES server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
