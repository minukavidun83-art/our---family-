import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  Cake,
  Calendar,
  Check,
  Database,
  Download,
  Edit3,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Layers,
  Loader2,
  MapPin,
  Megaphone,
  MessageCircle,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { RELATIONSHIPS, T, translateRelationship } from '../i18n';
import { apiFetch } from '../lib/staticFallback';
import type {
  Announcement,
  BirthdayEntry,
  ChatMessage,
  ChatRoom,
  EventEntry,
  Family,
  FamilyMember,
  GalleryItem,
  Lang,
  LocalProfile,
  SiteSettings,
  TripEntry,
} from '../types';
import { EditFamilyModal } from './EditFamilyModal';
import { SinglePhotoUploader } from './MediaUploader';

type AdminSubTab = 'site' | 'families' | 'members' | 'content' | 'backup';
type ContentCategory = 'birthdays' | 'trips' | 'events' | 'gallery' | 'notices' | 'chat';

interface Props {
  lang: Lang;
  siteSettings: SiteSettings;
  families: Family[];
  allMembers: FamilyMember[];
  localProfile: LocalProfile;
  onSiteSettingsUpdated: (next: SiteSettings) => void;
  onFamiliesChanged: () => void;
  onSelectFamily: (familyId: string) => void;
}

export const AdminPanelView: React.FC<Props> = ({
  lang,
  siteSettings,
  families,
  allMembers,
  localProfile,
  onSiteSettingsUpdated,
  onFamiliesChanged,
  onSelectFamily,
}) => {
  const t = T[lang];
  const [subTab, setSubTab] = useState<AdminSubTab>('site');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const authorHeader =
    localProfile.name.trim() || (lang === 'si' ? 'පවුලේ සාමාජික' : 'Family Member');

  const authHeaders = useCallback(
    (withJson = true): Record<string, string> => {
      const h: Record<string, string> = {
        'x-client-id': localProfile.clientId,
        'x-author-name': encodeURIComponent(authorHeader),
      };
      if (withJson) h['Content-Type'] = 'application/json';
      return h;
    },
    [localProfile.clientId, authorHeader]
  );

  // --- Site & About Settings State ---
  const [siteTitleEn, setSiteTitleEn] = useState(siteSettings.siteTitleEn || 'OUR FAMILIES');
  const [siteTitleSi, setSiteTitleSi] = useState(siteSettings.siteTitleSi || 'අපේ පවුල්');
  const [heroKickerEn, setHeroKickerEn] = useState(
    siteSettings.heroKickerEn || 'Connected Families · Colombo · Kandy · Galle · Melbourne'
  );
  const [heroKickerSi, setHeroKickerSi] = useState(
    siteSettings.heroKickerSi || 'සබැඳි පවුල් එකමුතුව · කොළඹ · මහනුවර · ගාල්ල · මෙල්බර්න්'
  );
  const [heroPhotoUrl, setHeroPhotoUrl] = useState(siteSettings.heroPhotoUrl || '');
  const [welcomeEn, setWelcomeEn] = useState(siteSettings.welcomeEn || '');
  const [welcomeSi, setWelcomeSi] = useState(siteSettings.welcomeSi || '');
  const [aboutTitleEn, setAboutTitleEn] = useState(
    siteSettings.aboutTitleEn || 'ABOUT OUR FAMILIES ❤️'
  );
  const [aboutTitleSi, setAboutTitleSi] = useState(
    siteSettings.aboutTitleSi || 'අපේ පවුල් ගැන ❤️'
  );
  const [aboutStoryEn, setAboutStoryEn] = useState(siteSettings.aboutStoryEn || '');
  const [aboutStorySi, setAboutStorySi] = useState(siteSettings.aboutStorySi || '');
  const [savingSite, setSavingSite] = useState(false);

  useEffect(() => {
    setSiteTitleEn(siteSettings.siteTitleEn || 'OUR FAMILIES');
    setSiteTitleSi(siteSettings.siteTitleSi || 'අපේ පවුල්');
    setHeroKickerEn(
      siteSettings.heroKickerEn || 'Connected Families · Colombo · Kandy · Galle · Melbourne'
    );
    setHeroKickerSi(
      siteSettings.heroKickerSi || 'සබැඳි පවුල් එකමුතුව · කොළඹ · මහනුවර · ගාල්ල · මෙල්බර්න්'
    );
    setHeroPhotoUrl(siteSettings.heroPhotoUrl || '');
    setWelcomeEn(siteSettings.welcomeEn || '');
    setWelcomeSi(siteSettings.welcomeSi || '');
    setAboutTitleEn(siteSettings.aboutTitleEn || 'ABOUT OUR FAMILIES ❤️');
    setAboutTitleSi(siteSettings.aboutTitleSi || 'අපේ පවුල් ගැන ❤️');
    setAboutStoryEn(siteSettings.aboutStoryEn || '');
    setAboutStorySi(siteSettings.aboutStorySi || '');
  }, [siteSettings]);

  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSite(true);
    try {
      const res = await apiFetch('/api/site-settings', {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({
          siteTitleEn: siteTitleEn.trim() || 'OUR FAMILIES',
          siteTitleSi: siteTitleSi.trim() || 'අපේ පවුල්',
          heroKickerEn: heroKickerEn.trim(),
          heroKickerSi: heroKickerSi.trim(),
          heroPhotoUrl,
          welcomeEn,
          welcomeSi,
          aboutTitleEn: aboutTitleEn.trim() || 'ABOUT OUR FAMILIES ❤️',
          aboutTitleSi: aboutTitleSi.trim() || 'අපේ පවුල් ගැන ❤️',
          aboutStoryEn,
          aboutStorySi,
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const updated = await res.json();
      onSiteSettingsUpdated(updated);
      onFamiliesChanged();
      showToast(
        'ok',
        lang === 'si' ? 'වෙබ් අඩවි තොරතුරු සුරැකුණි!' : 'Site & About settings saved!'
      );
    } catch (err: any) {
      showToast('err', err.message || 'Failed to save settings');
    } finally {
      setSavingSite(false);
    }
  };

  // --- Families Management State ---
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [newFamEn, setNewFamEn] = useState('');
  const [newFamSi, setNewFamSi] = useState('');
  const [newFamDescEn, setNewFamDescEn] = useState('');
  const [newFamDescSi, setNewFamDescSi] = useState('');
  const [newFamCover, setNewFamCover] = useState('');
  const [creatingFam, setCreatingFam] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [confirmDeleteFamId, setConfirmDeleteFamId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamEn.trim() && !newFamSi.trim()) return;
    setCreatingFam(true);
    try {
      const res = await apiFetch('/api/families', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          nameEn: newFamEn.trim() || newFamSi.trim(),
          nameSi: newFamSi.trim() || newFamEn.trim(),
          descriptionEn: newFamDescEn.trim(),
          descriptionSi: newFamDescSi.trim(),
          coverPhotoUrl: newFamCover,
        }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setNewFamEn('');
      setNewFamSi('');
      setNewFamDescEn('');
      setNewFamDescSi('');
      setNewFamCover('');
      setShowAddFamily(false);
      onFamiliesChanged();
      showToast('ok', lang === 'si' ? 'නව පවුලක් එක් කරන ලදී!' : 'New family added!');
    } catch (err: any) {
      showToast('err', err.message || 'Failed to add family');
    } finally {
      setCreatingFam(false);
    }
  };

  const handleMoveFamily = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= families.length || reordering) return;
    setReordering(true);
    try {
      const copy = [...families];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIdx, 0, moved);
      const res = await apiFetch('/api/families/reorder', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ orderedIds: copy.map((f) => f.id) }),
      });
      if (!res.ok) throw new Error('Reorder failed');
      onFamiliesChanged();
    } catch (err: any) {
      showToast('err', err.message || 'Reorder failed');
    } finally {
      setReordering(false);
    }
  };

  const handleDeleteFamily = async (familyId: string) => {
    try {
      const res = await apiFetch(`/api/families/${familyId}`, {
        method: 'DELETE',
        headers: authHeaders(false),
      });
      if (!res.ok) throw new Error('Delete failed');
      setConfirmDeleteFamId(null);
      onFamiliesChanged();
      showToast('ok', lang === 'si' ? 'පවුල ඉවත් කරන ලදී.' : 'Family deleted.');
    } catch (err: any) {
      showToast('err', err.message || 'Delete failed');
    }
  };

  // --- Members Management State ---
  const [memFilterFamilyId, setMemFilterFamilyId] = useState<string>('all');
  const [memSearch, setMemSearch] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [memFamilyId, setMemFamilyId] = useState(families[0]?.id || '');
  const [memName, setMemName] = useState('');
  const [memRel, setMemRel] = useState<string>('Member');
  const [memBirthday, setMemBirthday] = useState('');
  const [memPhoto, setMemPhoto] = useState('');
  const [memDesc, setMemDesc] = useState('');
  const [savingMember, setSavingMember] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [confirmDeleteMemId, setConfirmDeleteMemId] = useState<string | null>(null);

  useEffect(() => {
    if (families.length > 0 && !families.some((f) => f.id === memFamilyId)) {
      setMemFamilyId(families[0].id);
    }
  }, [families, memFamilyId]);

  const filteredMembers = useMemo(() => {
    const q = memSearch.trim().toLowerCase();
    return allMembers.filter((m) => {
      if (memFilterFamilyId !== 'all' && m.familyId !== memFilterFamilyId) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.relationship.toLowerCase().includes(q) ||
        (m.familyNameEn || '').toLowerCase().includes(q) ||
        (m.familyNameSi || '').toLowerCase().includes(q)
      );
    });
  }, [allMembers, memFilterFamilyId, memSearch]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memFamilyId || !memName.trim()) return;
    setSavingMember(true);
    try {
      const res = await apiFetch(`/api/families/${memFamilyId}/members`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          name: memName.trim(),
          relationship: memRel,
          birthday: memBirthday,
          photoUrl: memPhoto,
          description: memDesc,
        }),
      });
      if (!res.ok) throw new Error('Failed to add member');
      setMemName('');
      setMemBirthday('');
      setMemPhoto('');
      setMemDesc('');
      setShowAddMember(false);
      onFamiliesChanged();
      showToast('ok', lang === 'si' ? 'සාමාජිකයා එක් කරන ලදී!' : 'Member added!');
    } catch (err: any) {
      showToast('err', err.message || 'Failed to add member');
    } finally {
      setSavingMember(false);
    }
  };

  const handleSaveEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setSavingMember(true);
    try {
      const res = await apiFetch(`/api/members/${editingMember.id}`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({
          name: editingMember.name,
          relationship: editingMember.relationship,
          birthday: editingMember.birthday,
          photoUrl: editingMember.photoUrl,
          description: editingMember.description,
        }),
      });
      if (!res.ok) throw new Error('Failed to update member');
      setEditingMember(null);
      onFamiliesChanged();
      showToast('ok', lang === 'si' ? 'සාමාජික තොරතුරු යාවත්කාලීන විය!' : 'Member updated!');
    } catch (err: any) {
      showToast('err', err.message || 'Update failed');
    } finally {
      setSavingMember(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      const res = await apiFetch(`/api/members/${id}`, {
        method: 'DELETE',
        headers: authHeaders(false),
      });
      if (!res.ok) throw new Error('Delete failed');
      setConfirmDeleteMemId(null);
      onFamiliesChanged();
      showToast('ok', lang === 'si' ? 'සාමාජිකයා ඉවත් කරන ලදී.' : 'Member deleted.');
    } catch (err: any) {
      showToast('err', err.message || 'Delete failed');
    }
  };

  // --- Content & Chat Moderation State ---
  const [contentCat, setContentCat] = useState<ContentCategory>('birthdays');
  const [loadingContent, setLoadingContent] = useState(false);
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);
  const [trips, setTrips] = useState<TripEntry[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedChatRoom, setSelectedChatRoom] = useState('all');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  // Quick Add Birthday & Notice inside Admin
  const [newBdayName, setNewBdayName] = useState('');
  const [newBdayDate, setNewBdayDate] = useState('');
  const [newBdayFam, setNewBdayFam] = useState('');
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeBody, setNewNoticeBody] = useState('');
  const [newNoticePriority, setNewNoticePriority] = useState<'normal' | 'important'>('normal');

  // Inline Edit Modals for Content Items
  const [editTrip, setEditTrip] = useState<TripEntry | null>(null);
  const [editEvent, setEditEvent] = useState<EventEntry | null>(null);
  const [editGallery, setEditGallery] = useState<GalleryItem | null>(null);
  const [editAnn, setEditAnn] = useState<Announcement | null>(null);
  const [editBday, setEditBday] = useState<BirthdayEntry | null>(null);

  const loadContentData = useCallback(async () => {
    setLoadingContent(true);
    try {
      const [bRes, tRes, eRes, gRes, aRes, rRes] = await Promise.all([
        apiFetch('/api/birthdays', { headers: { 'x-client-id': localProfile.clientId } }),
        apiFetch('/api/trips', { headers: { 'x-client-id': localProfile.clientId } }),
        apiFetch('/api/events', { headers: { 'x-client-id': localProfile.clientId } }),
        apiFetch('/api/gallery', { headers: { 'x-client-id': localProfile.clientId } }),
        apiFetch('/api/announcements', { headers: { 'x-client-id': localProfile.clientId } }),
        apiFetch('/api/chat/rooms', { headers: { 'x-client-id': localProfile.clientId } }),
      ]);
      if (bRes.ok) {
        const d = await bRes.json();
        setBirthdays(d.birthdays || []);
      }
      if (tRes.ok) {
        const d = await tRes.json();
        setTrips(d.trips || []);
      }
      if (eRes.ok) {
        const d = await eRes.json();
        setEvents(d.events || []);
      }
      if (gRes.ok) {
        const d = await gRes.json();
        setGallery(d.items || []);
      }
      if (aRes.ok) {
        const d = await aRes.json();
        setAnnouncements(d.announcements || []);
      }
      if (rRes.ok) {
        const d = await rRes.json();
        setChatRooms(d.rooms || []);
      }
    } finally {
      setLoadingContent(false);
    }
  }, [localProfile.clientId]);

  const loadChatRoomMessages = useCallback(
    async (roomId: string) => {
      const res = await apiFetch(`/api/chat/messages?roomId=${encodeURIComponent(roomId)}`, {
        headers: { 'x-client-id': localProfile.clientId },
      });
      if (res.ok) {
        const d = await res.json();
        setChatMessages(d.messages || []);
      }
    },
    [localProfile.clientId]
  );

  useEffect(() => {
    loadContentData();
  }, [loadContentData]);

  useEffect(() => {
    if (subTab === 'content' && contentCat === 'chat') {
      loadChatRoomMessages(selectedChatRoom);
    }
  }, [subTab, contentCat, selectedChatRoom, loadChatRoomMessages]);

  const handleAddAdminBirthday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBdayName.trim() || !newBdayDate) return;
    const res = await apiFetch('/api/birthdays', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        memberName: newBdayName.trim(),
        birthDate: newBdayDate,
        familyId: newBdayFam || null,
      }),
    });
    if (res.ok) {
      setNewBdayName('');
      setNewBdayDate('');
      setNewBdayFam('');
      loadContentData();
      onFamiliesChanged();
      showToast('ok', lang === 'si' ? 'උපන්දිනය එක් විය!' : 'Birthday added!');
    }
  };

  const handleAddAdminNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeTitle.trim() || !newNoticeBody.trim()) return;
    const res = await apiFetch('/api/announcements', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        title: newNoticeTitle.trim(),
        body: newNoticeBody.trim(),
        priority: newNoticePriority,
        authorName: authorHeader,
      }),
    });
    if (res.ok) {
      setNewNoticeTitle('');
      setNewNoticeBody('');
      loadContentData();
      onFamiliesChanged();
      showToast('ok', lang === 'si' ? 'දැන්වීම පළ විය!' : 'Notice posted!');
    }
  };

  const handleDeleteContentItem = async (
    kind: 'birthday' | 'trip' | 'event' | 'gallery' | 'announcement' | 'chat',
    id: string
  ) => {
    const endpointMap: Record<typeof kind, string> = {
      birthday: `/api/birthdays/${id}`,
      trip: `/api/trips/${id}`,
      event: `/api/events/${id}`,
      gallery: `/api/gallery/${id}`,
      announcement: `/api/announcements/${id}`,
      chat: `/api/chat/messages/${id}`,
    };
    const res = await apiFetch(endpointMap[kind], {
      method: 'DELETE',
      headers: authHeaders(false),
    });
    if (res.ok) {
      setConfirmDeleteKey(null);
      if (kind === 'chat') {
        loadChatRoomMessages(selectedChatRoom);
      } else {
        loadContentData();
      }
      onFamiliesChanged();
      showToast('ok', lang === 'si' ? 'මකා දමන ලදී.' : 'Item deleted.');
    }
  };

  // --- Backup & Reset State ---
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const res = await apiFetch('/api/admin/export');
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `our-families-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('ok', lang === 'si' ? 'Backup ගොනුව බාගත විය!' : 'Backup JSON downloaded!');
    } catch (err: any) {
      showToast('err', err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await apiFetch('/api/admin/import', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error('Invalid backup file');
      onFamiliesChanged();
      loadContentData();
      showToast('ok', lang === 'si' ? 'දත්ත සාර්ථකව ප්‍රතිසංස්කරණය විය!' : 'Backup restored!');
    } catch (err: any) {
      showToast('err', err.message || 'Restore failed');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleResetPortal = async () => {
    setResetting(true);
    try {
      const res = await apiFetch('/api/admin/reset', {
        method: 'POST',
        headers: authHeaders(false),
      });
      if (!res.ok) throw new Error('Reset failed');
      setConfirmReset(false);
      onFamiliesChanged();
      loadContentData();
      showToast('ok', lang === 'si' ? 'දත්ත මුල් තත්ත්වයට පත් විය.' : 'Portal reset to defaults.');
    } catch (err: any) {
      showToast('err', err.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const tabs: Array<{ id: AdminSubTab; labelEn: string; labelSi: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'site', labelEn: 'Site & About', labelSi: 'වෙබ් අඩවිය සහ විස්තර', icon: Globe },
    { id: 'families', labelEn: 'Families', labelSi: 'පවුල් කළමනාකරණය', icon: Users },
    { id: 'members', labelEn: 'Members', labelSi: 'සාමාජිකයන්', icon: UserPlus },
    { id: 'content', labelEn: 'Content & Chat', labelSi: 'අන්තර්ගතය සහ චැට්', icon: Layers },
    { id: 'backup', labelEn: 'Backup & Reset', labelSi: 'Backup සහ Reset', icon: Database },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-28 lg:pb-16 space-y-8">
      {/* Header & Summary Counts */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
            {lang === 'si' ? 'පූර්ණ පාලන මැදිරිය' : 'Portal Control Studio'}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-50 mt-1.5">
            {lang === 'si' ? 'පරිපාලක පුවරුව (Admin Panel)' : 'Admin Panel'}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1.5 max-w-2xl">
            {lang === 'si'
              ? 'නව පවුල් එක් කරන්න, ඕනෑම විශාල ඡායාරූපයක් උඩුගත කරන්න, About සහ මුල් පිටු විස්තර වෙනස් කරන්න, සහ සියලු දත්ත පාලනය කරන්න.'
              : 'Add or reorder families, upload photos of any size, edit your Welcome & About pages, and manage every member, event, moment, and chat message.'}
          </p>
        </div>

        {/* Clean Unboxed Overview Counts (Zero Pill Rule) */}
        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-stone-600 dark:text-stone-300 tabular-nums">
          <span>
            <strong className="font-semibold text-stone-900 dark:text-stone-50">{families.length}</strong>{' '}
            {lang === 'si' ? 'පවුල්' : 'Families'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="font-semibold text-stone-900 dark:text-stone-50">{allMembers.length}</strong>{' '}
            {lang === 'si' ? 'සාමාජිකයන්' : 'Members'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="font-semibold text-stone-900 dark:text-stone-50">{events.length + trips.length}</strong>{' '}
            {lang === 'si' ? 'උත්සව/චාරිකා' : 'Events & Trips'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="font-semibold text-stone-900 dark:text-stone-50">{gallery.length}</strong>{' '}
            {lang === 'si' ? 'මතකයන්' : 'Moments'}
          </span>
        </div>
      </div>

      {/* Inline Toast Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="status"
            className={`rounded-xl px-4 py-3 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 border ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            <span>{feedback.text}</span>
            <button type="button" onClick={() => setFeedback(null)} className="p-1 opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable Admin Sub-Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 min-h-[44px] transition-colors border ${
                active
                  ? 'bg-rose-700 border-rose-700 text-white shadow-xs'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-rose-300 dark:hover:border-rose-700'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{lang === 'si' ? tab.labelSi : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SITE & ABOUT */}
      {subTab === 'site' && (
        <form onSubmit={handleSaveSiteSettings} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Brand & Hero Text */}
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 sm:p-6 space-y-4">
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                {lang === 'si' ? 'මුල් පිටුව සහ නාමය' : 'Portal Title & Hero'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Site Title (English)
                  </label>
                  <input
                    type="text"
                    value={siteTitleEn}
                    onChange={(e) => setSiteTitleEn(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    වෙබ් අඩවි නාමය (සිංහල)
                  </label>
                  <input
                    type="text"
                    value={siteTitleSi}
                    onChange={(e) => setSiteTitleSi(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Cities / Kicker Line (English)
                  </label>
                  <input
                    type="text"
                    value={heroKickerEn}
                    onChange={(e) => setHeroKickerEn(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    උප සිරස්තලය (සිංහල)
                  </label>
                  <input
                    type="text"
                    value={heroKickerSi}
                    onChange={(e) => setHeroKickerSi(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Welcome Message (English)
                </label>
                <textarea
                  rows={2}
                  value={welcomeEn}
                  onChange={(e) => setWelcomeEn(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  පිළිගැනීමේ පණිවිඩය (සිංහල)
                </label>
                <textarea
                  rows={2}
                  value={welcomeSi}
                  onChange={(e) => setWelcomeSi(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                  {lang === 'si' ? 'මුල් පිටු ප්‍රධාන ඡායාරූපය (ඕනෑම ප්‍රමාණයක)' : 'Hero Cover Photo (Any Size)'}
                </label>
                {heroPhotoUrl && (
                  <div className="rounded-xl overflow-hidden aspect-16/9 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                    <img
                      src={heroPhotoUrl}
                      alt="Hero"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <SinglePhotoUploader
                  lang={lang}
                  value={heroPhotoUrl}
                  onChange={setHeroPhotoUrl}
                />
              </div>
            </div>

            {/* About Page Content */}
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 sm:p-6 space-y-4">
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                {lang === 'si' ? 'About පිටුවේ විස්තර' : 'About Page Content'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {lang === 'si'
                  ? 'මෙම කොටස "About" පිටුවේ ඉහළින්ම පැහැදිලිව පෙන්වනු ඇත.'
                  : 'Shown prominently at the top of the About page on desktop and mobile.'}
              </p>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  About Heading (English)
                </label>
                <input
                  type="text"
                  value={aboutTitleEn}
                  onChange={(e) => setAboutTitleEn(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  About මාතෘකාව (සිංහල)
                </label>
                <input
                  type="text"
                  value={aboutTitleSi}
                  onChange={(e) => setAboutTitleSi(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Our Story / About Description (English)
                </label>
                <textarea
                  rows={5}
                  value={aboutStoryEn}
                  onChange={(e) => setAboutStoryEn(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  අපේ කතාව / About විස්තරය (සිංහල)
                </label>
                <textarea
                  rows={5}
                  value={aboutStorySi}
                  onChange={(e) => setAboutStorySi(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSite}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white px-6 py-3 text-sm font-medium min-h-[44px] disabled:opacity-60"
            >
              {savingSite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{lang === 'si' ? 'වෙනස්කම් සුරකින්න' : 'Save Site & About Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: FAMILIES */}
      {subTab === 'families' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                {lang === 'si' ? 'සියලුම පවුල්' : 'Manage All Families'} ({families.length})
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {lang === 'si'
                  ? 'අලුත් පවුල් එක් කරන්න, අනුපිළිවෙල වෙනස් කරන්න, හෝ ඡායාරූප සංස්කරණය කරන්න.'
                  : 'Add unlimited families, change display order, edit cover photos, or remove houses.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddFamily((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white px-4 py-2.5 text-xs sm:text-sm font-medium min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addFamily}</span>
            </button>
          </div>

          <AnimatePresence>
            {showAddFamily && (
              <motion.form
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleCreateFamily}
                className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-stone-900 p-5 sm:p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
                    {t.addFamily}
                  </h3>
                  <button type="button" onClick={() => setShowAddFamily(false)} className="p-2 text-stone-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {newFamCover && (
                  <div className="max-w-sm rounded-xl overflow-hidden aspect-4/3 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                    <img src={newFamCover} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <SinglePhotoUploader lang={lang} value={newFamCover} onChange={setNewFamCover} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      {t.familyNameEn}
                    </label>
                    <input
                      type="text"
                      required={!newFamSi.trim()}
                      value={newFamEn}
                      onChange={(e) => setNewFamEn(e.target.value)}
                      placeholder="e.g. Perera Family"
                      className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      {t.familyNameSi}
                    </label>
                    <input
                      type="text"
                      value={newFamSi}
                      onChange={(e) => setNewFamSi(e.target.value)}
                      placeholder="උදා: පෙරේරා පවුල"
                      className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      {t.familyDescEn}
                    </label>
                    <textarea
                      rows={2}
                      value={newFamDescEn}
                      onChange={(e) => setNewFamDescEn(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      {t.familyDescSi}
                    </label>
                    <textarea
                      rows={2}
                      value={newFamDescSi}
                      onChange={(e) => setNewFamDescSi(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddFamily(false)}
                    className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-medium"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={creatingFam}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-medium"
                  >
                    {creatingFam && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{t.addFamily}</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {families.map((fam, idx) => (
              <div
                key={fam.id}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 flex flex-col sm:flex-row gap-4 justify-between"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 border border-stone-200 dark:border-stone-700 flex items-center justify-center">
                    {fam.coverPhotoUrl ? (
                      <img
                        src={fam.coverPhotoUrl}
                        alt={fam.nameEn}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-stone-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-stone-400 tabular-nums">
                      #{idx + 1} · {fam.memberCount ?? 0} {t.membersCount}
                    </p>
                    <h3 className="font-display text-base font-bold text-stone-900 dark:text-stone-100 truncate">
                      {fam.nameEn}
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-400 truncate">{fam.nameSi}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-1">
                      {(lang === 'si' ? fam.descriptionSi || fam.descriptionEn : fam.descriptionEn || fam.descriptionSi) ||
                        t.noDescriptionYet}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0 || reordering}
                      onClick={() => handleMoveFamily(idx, -1)}
                      aria-label="Move up"
                      className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-35 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === families.length - 1 || reordering}
                      onClick={() => handleMoveFamily(idx, 1)}
                      aria-label="Move down"
                      className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-35 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectFamily(fam.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 px-2.5 py-1.5 text-xs font-medium hover:border-rose-300 min-h-[36px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{t.viewFamily}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingFamily(fam)}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 px-2.5 py-1.5 text-xs font-medium hover:border-rose-300 min-h-[36px]"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{t.edit}</span>
                    </button>
                    {confirmDeleteFamId === fam.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteFamily(fam.id)}
                          className="rounded-lg bg-rose-700 text-white px-2.5 py-1.5 text-xs font-medium min-h-[36px]"
                        >
                          {lang === 'si' ? 'තහවුරු' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteFamId(null)}
                          className="rounded-lg border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-xs min-h-[36px]"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteFamId(fam.id)}
                        aria-label={t.delete}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 px-2.5 py-1.5 text-xs font-medium hover:bg-rose-50 dark:hover:bg-rose-950/30 min-h-[36px]"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: MEMBERS */}
      {subTab === 'members' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={memSearch}
                  onChange={(e) => setMemSearch(e.target.value)}
                  placeholder={t.searchMembersPlaceholder}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 pl-9 pr-3 py-2 text-base sm:text-sm min-h-[42px]"
                />
              </div>
              <select
                value={memFilterFamilyId}
                onChange={(e) => setMemFilterFamilyId(e.target.value)}
                className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-base sm:text-sm min-h-[42px]"
              >
                <option value="all">{lang === 'si' ? 'සියලුම පවුල්' : 'All Families'}</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {lang === 'si' ? f.nameSi : f.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMember((v) => !v)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white px-4 py-2.5 text-xs sm:text-sm font-medium min-h-[44px]"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t.addMember}</span>
            </button>
          </div>

          <AnimatePresence>
            {showAddMember && (
              <motion.form
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleAddMember}
                className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-stone-900 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">{t.addMember}</h3>
                  <button type="button" onClick={() => setShowAddMember(false)} className="p-2 text-stone-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {memPhoto && (
                  <img
                    src={memPhoto}
                    alt="Member preview"
                    className="w-20 h-20 rounded-2xl object-cover border border-stone-200 dark:border-stone-700"
                  />
                )}
                <SinglePhotoUploader lang={lang} value={memPhoto} onChange={setMemPhoto} purpose="avatar" />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <select
                    required
                    value={memFamilyId}
                    onChange={(e) => setMemFamilyId(e.target.value)}
                    className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                  >
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {lang === 'si' ? f.nameSi : f.nameEn}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={memName}
                    onChange={(e) => setMemName(e.target.value)}
                    placeholder={t.memberName}
                    className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                  />
                  <select
                    value={memRel}
                    onChange={(e) => setMemRel(e.target.value)}
                    className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                  >
                    {RELATIONSHIPS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {lang === 'si' ? r.si : r.en}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={memBirthday}
                    onChange={(e) => setMemBirthday(e.target.value)}
                    className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
                <textarea
                  rows={2}
                  value={memDesc}
                  onChange={(e) => setMemDesc(e.target.value)}
                  placeholder={t.personalDesc}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddMember(false)}
                    className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-medium"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={savingMember}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-medium"
                  >
                    {savingMember && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{t.save}</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {filteredMembers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-8 text-center text-sm text-stone-500">
              {t.noGroupMembersYet}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shrink-0 flex items-center justify-center">
                      {m.photoUrl ? (
                        <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-stone-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                        {m.name}
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                        {translateRelationship(m.relationship, lang)} ·{' '}
                        {lang === 'si' ? m.familyNameSi : m.familyNameEn}
                      </p>
                      {m.birthday && (
                        <p className="text-[11px] text-rose-700 dark:text-rose-400 tabular-nums">
                          🎂 {m.birthday}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingMember({ ...m })}
                      aria-label={t.edit}
                      className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 hover:border-rose-300 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeleteMemId === m.id ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(m.id)}
                        className="rounded-lg bg-rose-700 text-white px-2.5 py-1.5 text-xs font-medium min-h-[36px]"
                      >
                        {lang === 'si' ? 'ඔව්' : 'Yes'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMemId(m.id)}
                        aria-label={t.delete}
                        className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CONTENT & CHAT */}
      {subTab === 'content' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'birthdays', en: 'Birthdays', si: 'උපන්දින', icon: Cake, count: birthdays.length },
                { id: 'trips', en: 'Trips', si: 'චාරිකා', icon: MapPin, count: trips.length },
                { id: 'events', en: 'Events', si: 'උත්සව', icon: Calendar, count: events.length },
                { id: 'gallery', en: 'Gallery', si: 'ගැලරිය', icon: ImageIcon, count: gallery.length },
                { id: 'notices', en: 'Notices', si: 'දැන්වීම්', icon: Megaphone, count: announcements.length },
                { id: 'chat', en: 'Chat Moderation', si: 'චැට් පාලනය', icon: MessageCircle, count: null },
              ] as const
            ).map((c) => {
              const Icon = c.icon;
              const active = contentCat === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setContentCat(c.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium border min-h-[40px] ${
                    active
                      ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-100'
                      : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'si' ? c.si : c.en}
                    {c.count !== null ? ` (${c.count})` : ''}
                  </span>
                </button>
              );
            })}
          </div>

          {loadingContent && (
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t.loading}</span>
            </div>
          )}

          {/* Birthdays Manager */}
          {contentCat === 'birthdays' && (
            <div className="space-y-4">
              <form
                onSubmit={handleAddAdminBirthday}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3"
              >
                <input
                  type="text"
                  required
                  value={newBdayName}
                  onChange={(e) => setNewBdayName(e.target.value)}
                  placeholder={t.memberName}
                  className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  required
                  value={newBdayDate}
                  onChange={(e) => setNewBdayDate(e.target.value)}
                  className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
                />
                <select
                  value={newBdayFam}
                  onChange={(e) => setNewBdayFam(e.target.value)}
                  className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
                >
                  <option value="">{lang === 'si' ? 'පවුල (විකල්ප)' : 'Family (optional)'}</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {lang === 'si' ? f.nameSi : f.nameEn}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 text-xs font-medium min-h-[40px]"
                >
                  + {t.addBirthday}
                </button>
              </form>

              <div className="space-y-2">
                {birthdays.length === 0 ? (
                  <p className="text-sm text-stone-500">{t.noBirthdaysYet}</p>
                ) : (
                  birthdays.map((b) => (
                    <div
                      key={b.targetKey}
                      className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-sm">{b.memberName}</p>
                        <p className="text-xs text-stone-500 tabular-nums">
                          {b.birthDate}
                          {b.familyNameEn ? ` · ${lang === 'si' ? b.familyNameSi : b.familyNameEn}` : ''}
                        </p>
                      </div>
                      {b.source === 'birthday' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditBday({ ...b })}
                            className="p-2 rounded-lg border border-stone-200 dark:border-stone-700"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteKey === `bday-${b.id}` ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteContentItem('birthday', b.id)}
                              className="rounded-lg bg-rose-700 text-white px-2.5 py-1.5 text-xs"
                            >
                              {lang === 'si' ? 'තහවුරු' : 'Confirm'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteKey(`bday-${b.id}`)}
                              className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-stone-400">
                          {lang === 'si' ? 'සාමාජික ගිණුමෙන්' : 'From Member profile'}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Trips Manager */}
          {contentCat === 'trips' && (
            <div className="space-y-2">
              {trips.length === 0 ? (
                <p className="text-sm text-stone-500">{t.noTripsYet}</p>
              ) : (
                trips.map((tr) => (
                  <div
                    key={tr.id}
                    className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-sm">{tr.title}</p>
                      <p className="text-xs text-stone-500 tabular-nums">
                        {tr.destination} · {tr.tripDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditTrip({ ...tr })}
                        className="p-2 rounded-lg border border-stone-200 dark:border-stone-700"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {confirmDeleteKey === `trip-${tr.id}` ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteContentItem('trip', tr.id)}
                          className="rounded-lg bg-rose-700 text-white px-2.5 py-1.5 text-xs"
                        >
                          {lang === 'si' ? 'තහවුරු' : 'Confirm'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteKey(`trip-${tr.id}`)}
                          className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Events Manager */}
          {contentCat === 'events' && (
            <div className="space-y-2">
              {events.length === 0 ? (
                <p className="text-sm text-stone-500">{t.noEventsYet}</p>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-sm">{ev.title}</p>
                      <p className="text-xs text-stone-500 tabular-nums">
                        {ev.eventDate} · {ev.location || ev.category} ·{' '}
                        <span className={ev.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'}>
                          {ev.status}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {ev.status !== 'approved' && (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await apiFetch(`/api/events/${ev.id}`, {
                              method: 'PATCH',
                              headers: authHeaders(true),
                              body: JSON.stringify({ status: 'approved' }),
                            });
                            if (res.ok) {
                              loadContentData();
                              onFamiliesChanged();
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1.5 text-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{t.approveEvent}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditEvent({ ...ev })}
                        className="p-2 rounded-lg border border-stone-200 dark:border-stone-700"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {confirmDeleteKey === `evt-${ev.id}` ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteContentItem('event', ev.id)}
                          className="rounded-lg bg-rose-700 text-white px-2.5 py-1.5 text-xs"
                        >
                          {lang === 'si' ? 'තහවුරු' : 'Confirm'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteKey(`evt-${ev.id}`)}
                          className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Gallery Manager */}
          {contentCat === 'gallery' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gallery.length === 0 ? (
                <p className="text-sm text-stone-500">{t.noGalleryYet}</p>
              ) : (
                gallery.map((g) => (
                  <div
                    key={g.id}
                    className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0">
                        {g.mediaType === 'video' ? (
                          <video src={g.mediaUrl} className="w-full h-full object-cover" />
                        ) : (
                          <img src={g.mediaUrl} alt={g.title} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{g.title}</p>
                        <p className="text-xs text-stone-500 truncate">
                          {g.momentDate} {g.location ? `· ${g.location}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditGallery({ ...g })}
                        className="p-2 rounded-lg border border-stone-200 dark:border-stone-700"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {confirmDeleteKey === `gal-${g.id}` ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteContentItem('gallery', g.id)}
                          className="rounded-lg bg-rose-700 text-white px-2.5 py-1.5 text-xs"
                        >
                          {lang === 'si' ? 'තහවුරු' : 'Confirm'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteKey(`gal-${g.id}`)}
                          className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Announcements / Notices Manager */}
          {contentCat === 'notices' && (
            <div className="space-y-4">
              <form
                onSubmit={handleAddAdminNotice}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={newNoticeTitle}
                    onChange={(e) => setNewNoticeTitle(e.target.value)}
                    placeholder={t.announcementTitle}
                    className="sm:col-span-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
                  />
                  <select
                    value={newNoticePriority}
                    onChange={(e) => setNewNoticePriority(e.target.value as 'normal' | 'important')}
                    className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
                  >
                    <option value="normal">{t.normalNotice}</option>
                    <option value="important">{t.importantNotice}</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  required
                  value={newNoticeBody}
                  onChange={(e) => setNewNoticeBody(e.target.value)}
                  placeholder={t.announcementBody}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-xl bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 text-xs font-medium min-h-[40px]"
                  >
                    + {t.postAnnouncement}
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {announcements.length === 0 ? (
                  <p className="text-sm text-stone-500">{t.noAnnouncementsYet}</p>
                ) : (
                  announcements.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-sm">{a.title}</p>
                        <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{a.body}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditAnn({ ...a })}
                          className="p-2 rounded-lg border border-stone-200 dark:border-stone-700"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteKey === `ann-${a.id}` ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteContentItem('announcement', a.id)}
                            className="rounded-lg bg-rose-700 text-white px-2.5 py-1.5 text-xs"
                          >
                            {lang === 'si' ? 'තහවුරු' : 'Confirm'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteKey(`ann-${a.id}`)}
                            className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Chat Moderation */}
          {contentCat === 'chat' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-stone-600 dark:text-stone-300">
                  {lang === 'si' ? 'කාමරය තෝරන්න:' : 'Chat Room:'}
                </label>
                <select
                  value={selectedChatRoom}
                  onChange={(e) => setSelectedChatRoom(e.target.value)}
                  className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm"
                >
                  {chatRooms.map((r) => (
                    <option key={r.roomId} value={r.roomId}>
                      {lang === 'si' ? r.nameSi : r.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-stone-500">{t.noMessagesYet}</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">
                          {msg.senderName}{' '}
                          <span className="font-normal text-stone-400">
                            · {new Date(msg.createdAt).toLocaleString()}
                          </span>
                        </p>
                        <p className="text-sm text-stone-700 dark:text-stone-300 truncate">
                          {msg.text || (msg.mediaUrl ? '[Media attachment]' : '')}
                        </p>
                      </div>
                      {confirmDeleteKey === `msg-${msg.id}` ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteContentItem('chat', msg.id)}
                          className="rounded-lg bg-rose-700 text-white px-2.5 py-1.5 text-xs shrink-0"
                        >
                          {lang === 'si' ? 'තහවුරු' : 'Confirm'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteKey(`msg-${msg.id}`)}
                          className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: BACKUP & RESET */}
      {subTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 space-y-4">
            <h3 className="font-display text-lg font-bold">
              {lang === 'si' ? 'දත්ත Backup බාගත කරන්න' : 'Export JSON Backup'}
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              {lang === 'si'
                ? 'සියලුම පවුල්, සාමාජිකයන්, උත්සව සහ ඡායාරූප සම්බන්ධතා JSON ගොනුවක් ලෙස සුරකින්න.'
                : 'Download a full JSON snapshot of your families, members, settings, and records.'}
            </p>
            <button
              type="button"
              disabled={exporting}
              onClick={handleExportBackup}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2.5 text-xs font-medium min-h-[42px]"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{lang === 'si' ? 'JSON බාගත කරන්න' : 'Download Backup'}</span>
            </button>
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 space-y-4">
            <h3 className="font-display text-lg font-bold">
              {lang === 'si' ? 'Backup ගොනුවක් ඇතුළත් කරන්න' : 'Import / Restore Backup'}
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              {lang === 'si'
                ? 'කලින් සුරැකි .json Backup ගොනුවක් තෝරා දත්ත නැවත පිහිටුවන්න.'
                : 'Restore families, members, and site settings from an exported .json backup file.'}
            </p>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportBackup}
              className="hidden"
            />
            <button
              type="button"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2.5 text-xs font-medium min-h-[42px]"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{lang === 'si' ? 'JSON ගොනුව තෝරන්න' : 'Select Backup JSON'}</span>
            </button>
          </div>

          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-stone-900 p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-rose-700 dark:text-rose-400">
              {lang === 'si' ? 'මුල් තත්ත්වයට පත් කරන්න' : 'Reset Portal to Defaults'}
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              {lang === 'si'
                ? 'මෙය සියලු දත්ත මකා පිරිසිදු මුල් තත්ත්වයට පත් කරයි. ප්‍රවේශමෙන් භාවිතා කරන්න.'
                : 'Clears added members/content and restores the clean starter portal houses.'}
            </p>
            {confirmReset ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={resetting}
                  onClick={handleResetPortal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 text-white px-4 py-2.5 text-xs font-medium min-h-[42px]"
                >
                  {resetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{lang === 'si' ? 'ඔව්, Reset කරන්න' : 'Confirm Reset'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-xl border border-stone-300 dark:border-stone-700 px-3 py-2.5 text-xs"
                >
                  {t.cancel}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 px-4 py-2.5 text-xs font-medium min-h-[42px]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{lang === 'si' ? 'Reset කරන්න' : 'Reset Portal'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit Family Modal */}
      <AnimatePresence>
        {editingFamily && (
          <EditFamilyModal
            lang={lang}
            family={editingFamily}
            localProfile={localProfile}
            onClose={() => setEditingFamily(null)}
            onSaved={() => {
              onFamiliesChanged();
              showToast('ok', lang === 'si' ? 'පවුල යාවත්කාලීන විය!' : 'Family updated!');
            }}
          />
        )}
      </AnimatePresence>

      {/* Edit Member Modal */}
      <AnimatePresence>
        {editingMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingMember(null)}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
          >
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveEditMember}
              className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 space-y-4 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">{t.editMember}</h3>
                <button type="button" onClick={() => setEditingMember(null)} className="p-2 text-stone-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {editingMember.photoUrl && (
                <img
                  src={editingMember.photoUrl}
                  alt={editingMember.name}
                  className="w-20 h-20 rounded-2xl object-cover"
                />
              )}
              <SinglePhotoUploader
                lang={lang}
                value={editingMember.photoUrl}
                onChange={(url) => setEditingMember({ ...editingMember, photoUrl: url })}
                purpose="avatar"
              />
              <input
                type="text"
                required
                value={editingMember.name}
                onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={editingMember.relationship}
                  onChange={(e) => setEditingMember({ ...editingMember, relationship: e.target.value })}
                  className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
                >
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {lang === 'si' ? r.si : r.en}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={editingMember.birthday}
                  onChange={(e) => setEditingMember({ ...editingMember, birthday: e.target.value })}
                  className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
                />
              </div>
              <textarea
                rows={3}
                value={editingMember.description}
                onChange={(e) => setEditingMember({ ...editingMember, description: e.target.value })}
                className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={savingMember}
                  className="px-5 py-2 rounded-xl bg-rose-700 text-white text-xs font-medium"
                >
                  {t.save}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Edit Modals */}
      {editBday && (
        <div
          onClick={() => setEditBday(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await apiFetch(`/api/birthdays/${editBday.id}`, {
                method: 'PATCH',
                headers: authHeaders(true),
                body: JSON.stringify({
                  memberName: editBday.memberName,
                  birthDate: editBday.birthDate,
                  notes: editBday.notes || '',
                }),
              });
              if (res.ok) {
                setEditBday(null);
                loadContentData();
                onFamiliesChanged();
                showToast('ok', 'Birthday updated!');
              }
            }}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-stone-900 p-6 space-y-3"
          >
            <h3 className="font-display text-lg font-semibold">{t.edit}</h3>
            <input
              type="text"
              required
              value={editBday.memberName}
              onChange={(e) => setEditBday({ ...editBday, memberName: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <input
              type="date"
              required
              value={editBday.birthDate}
              onChange={(e) => setEditBday({ ...editBday, birthDate: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditBday(null)} className="px-4 py-2 text-xs rounded-xl border border-stone-300">
                {t.cancel}
              </button>
              <button type="submit" className="px-5 py-2 text-xs rounded-xl bg-rose-700 text-white">
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {editTrip && (
        <div
          onClick={() => setEditTrip(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await apiFetch(`/api/trips/${editTrip.id}`, {
                method: 'PATCH',
                headers: authHeaders(true),
                body: JSON.stringify({
                  title: editTrip.title,
                  destination: editTrip.destination,
                  tripDate: editTrip.tripDate,
                  description: editTrip.description,
                }),
              });
              if (res.ok) {
                setEditTrip(null);
                loadContentData();
                onFamiliesChanged();
                showToast('ok', 'Trip updated!');
              }
            }}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-stone-900 p-6 space-y-3"
          >
            <h3 className="font-display text-lg font-semibold">{t.edit}</h3>
            <input
              type="text"
              required
              value={editTrip.title}
              onChange={(e) => setEditTrip({ ...editTrip, title: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <input
              type="text"
              required
              value={editTrip.destination}
              onChange={(e) => setEditTrip({ ...editTrip, destination: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <input
              type="date"
              required
              value={editTrip.tripDate}
              onChange={(e) => setEditTrip({ ...editTrip, tripDate: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <textarea
              rows={2}
              value={editTrip.description}
              onChange={(e) => setEditTrip({ ...editTrip, description: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditTrip(null)} className="px-4 py-2 text-xs rounded-xl border border-stone-300">
                {t.cancel}
              </button>
              <button type="submit" className="px-5 py-2 text-xs rounded-xl bg-rose-700 text-white">
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {editEvent && (
        <div
          onClick={() => setEditEvent(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await apiFetch(`/api/events/${editEvent.id}`, {
                method: 'PATCH',
                headers: authHeaders(true),
                body: JSON.stringify({
                  title: editEvent.title,
                  eventDate: editEvent.eventDate,
                  location: editEvent.location,
                  description: editEvent.description,
                  status: editEvent.status,
                }),
              });
              if (res.ok) {
                setEditEvent(null);
                loadContentData();
                onFamiliesChanged();
                showToast('ok', 'Event updated!');
              }
            }}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-stone-900 p-6 space-y-3"
          >
            <h3 className="font-display text-lg font-semibold">{t.edit}</h3>
            <input
              type="text"
              required
              value={editEvent.title}
              onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <input
              type="date"
              required
              value={editEvent.eventDate}
              onChange={(e) => setEditEvent({ ...editEvent, eventDate: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={editEvent.location}
              onChange={(e) => setEditEvent({ ...editEvent, location: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <textarea
              rows={2}
              value={editEvent.description}
              onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditEvent(null)} className="px-4 py-2 text-xs rounded-xl border border-stone-300">
                {t.cancel}
              </button>
              <button type="submit" className="px-5 py-2 text-xs rounded-xl bg-rose-700 text-white">
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {editGallery && (
        <div
          onClick={() => setEditGallery(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await apiFetch(`/api/gallery/${editGallery.id}`, {
                method: 'PATCH',
                headers: authHeaders(true),
                body: JSON.stringify({
                  title: editGallery.title,
                  location: editGallery.location,
                  caption: editGallery.caption,
                  momentDate: editGallery.momentDate,
                }),
              });
              if (res.ok) {
                setEditGallery(null);
                loadContentData();
                onFamiliesChanged();
                showToast('ok', 'Gallery item updated!');
              }
            }}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-stone-900 p-6 space-y-3"
          >
            <h3 className="font-display text-lg font-semibold">{t.edit}</h3>
            <input
              type="text"
              required
              value={editGallery.title}
              onChange={(e) => setEditGallery({ ...editGallery, title: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={editGallery.location}
              onChange={(e) => setEditGallery({ ...editGallery, location: e.target.value })}
              placeholder={t.photoLocationLabel}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={editGallery.momentDate}
              onChange={(e) => setEditGallery({ ...editGallery, momentDate: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <textarea
              rows={2}
              value={editGallery.caption}
              onChange={(e) => setEditGallery({ ...editGallery, caption: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditGallery(null)} className="px-4 py-2 text-xs rounded-xl border border-stone-300">
                {t.cancel}
              </button>
              <button type="submit" className="px-5 py-2 text-xs rounded-xl bg-rose-700 text-white">
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {editAnn && (
        <div
          onClick={() => setEditAnn(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await apiFetch(`/api/announcements/${editAnn.id}`, {
                method: 'PATCH',
                headers: authHeaders(true),
                body: JSON.stringify({
                  title: editAnn.title,
                  body: editAnn.body,
                  priority: editAnn.priority,
                }),
              });
              if (res.ok) {
                setEditAnn(null);
                loadContentData();
                onFamiliesChanged();
                showToast('ok', 'Announcement updated!');
              }
            }}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-stone-900 p-6 space-y-3"
          >
            <h3 className="font-display text-lg font-semibold">{t.edit}</h3>
            <input
              type="text"
              required
              value={editAnn.title}
              onChange={(e) => setEditAnn({ ...editAnn, title: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <textarea
              rows={3}
              required
              value={editAnn.body}
              onChange={(e) => setEditAnn({ ...editAnn, body: e.target.value })}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditAnn(null)} className="px-4 py-2 text-xs rounded-xl border border-stone-300">
                {t.cancel}
              </button>
              <button type="submit" className="px-5 py-2 text-xs rounded-xl bg-rose-700 text-white">
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
