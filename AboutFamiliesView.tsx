import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Edit3,
  Image as ImageIcon,
  Loader2,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { T } from '../i18n';
import {
  DEFAULT_ABOUT_STORY_EN,
  DEFAULT_ABOUT_STORY_SI,
  apiFetch,
} from '../lib/staticFallback';
import type { Family, Lang, LocalProfile, SiteSettings } from '../types';
import { EditFamilyModal } from './EditFamilyModal';
import { SinglePhotoUploader } from './MediaUploader';

interface Props {
  lang: Lang;
  siteSettings: SiteSettings;
  families: Family[];
  allMembersCount: number;
  localProfile: LocalProfile;
  onSelectFamily: (familyId: string) => void;
  onFamilyUpdated: (updated: Family) => void;
  onFamilyAdded: () => void;
  onOpenAdmin: () => void;
}

export const AboutFamiliesView: React.FC<Props> = ({
  lang,
  siteSettings,
  families,
  allMembersCount,
  localProfile,
  onSelectFamily,
  onFamilyUpdated,
  onFamilyAdded,
  onOpenAdmin,
}) => {
  const t = T[lang];
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [addModalOpen, setAddModalOpen] = useState(false);

  const [newNameEn, setNewNameEn] = useState('');
  const [newNameSi, setNewNameSi] = useState('');
  const [newDescEn, setNewDescEn] = useState('');
  const [newDescSi, setNewDescSi] = useState('');
  const [newCoverUrl, setNewCoverUrl] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [addError, setAddError] = useState('');

  const kicker =
    lang === 'si'
      ? siteSettings.heroKickerSi || t.heroKicker
      : siteSettings.heroKickerEn || t.heroKicker;
  const aboutTitle =
    lang === 'si'
      ? siteSettings.aboutTitleSi || 'අපේ පවුල් ගැන ❤️'
      : siteSettings.aboutTitleEn || 'ABOUT OUR FAMILIES ❤️';
  const aboutStory =
    lang === 'si'
      ? siteSettings.aboutStorySi || DEFAULT_ABOUT_STORY_SI
      : siteSettings.aboutStoryEn || DEFAULT_ABOUT_STORY_EN;

  const handleAddFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNameEn.trim() && !newNameSi.trim()) {
      setAddError(lang === 'si' ? 'පවුලේ නම අවශ්‍යයි' : 'Please enter a family name');
      return;
    }
    setSavingNew(true);
    setAddError('');
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-client-id': localProfile.clientId,
      };
      if (localProfile.name.trim()) {
        headers['x-author-name'] = encodeURIComponent(localProfile.name.trim());
      }
      const res = await apiFetch('/api/families', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nameEn: newNameEn.trim() || newNameSi.trim(),
          nameSi: newNameSi.trim() || newNameEn.trim(),
          descriptionEn: newDescEn.trim(),
          descriptionSi: newDescSi.trim(),
          coverPhotoUrl: newCoverUrl,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to add family');
      }
      setNewNameEn('');
      setNewNameSi('');
      setNewDescEn('');
      setNewDescSi('');
      setNewCoverUrl('');
      setAddModalOpen(false);
      onFamilyAdded();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add family');
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-28 lg:pb-16 space-y-10">
      {/* Always-Visible About Our Families Editorial Section */}
      <section className="rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 sm:p-8 lg:p-10 space-y-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              {kicker}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 dark:text-stone-50 text-balance">
              {aboutTitle}
            </h1>
            <p className="text-sm sm:text-base text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
              {aboutStory}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white px-4 py-2.5 text-xs sm:text-sm font-medium min-h-[44px] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addFamily}</span>
            </button>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-rose-300 dark:hover:border-rose-700 text-stone-800 dark:text-stone-100 px-4 py-2.5 text-xs sm:text-sm font-medium min-h-[44px] transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-rose-700 dark:text-rose-400" />
              <span>{t.navAdmin}</span>
            </button>
          </div>
        </div>

        {/* Clean Unboxed Stats Strip */}
        <div className="pt-5 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400 tabular-nums">
          <span>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">
              {families.length}
            </strong>{' '}
            {lang === 'si' ? 'පවුල්' : 'Connected Families'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">
              {allMembersCount}
            </strong>{' '}
            {t.membersCount}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {lang === 'si'
              ? 'සෑම පවුලක්ම හා මතකයන් පහතින් නරඹන්න'
              : 'Explore every household, member, and story below'}
          </span>
        </div>
      </section>

      {/* Families Grid */}
      <section className="space-y-6">
        <div className="border-b border-stone-200 dark:border-stone-800 pb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-50">
              {t.eightFamiliesHeading}
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
              {t.eightFamiliesSub}
            </p>
          </div>
        </div>

        {families.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-10 text-center space-y-4">
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {lang === 'si'
                ? 'තවම පවුල් එක් කර නැත. පළමු පවුල එක් කරන්න.'
                : 'No families added yet. Add your first family house below.'}
            </p>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white px-5 py-2.5 text-sm font-medium min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addFamily}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {families.map((fam) => {
              const name = lang === 'si' ? fam.nameSi : fam.nameEn;
              const desc =
                lang === 'si'
                  ? fam.descriptionSi || fam.descriptionEn
                  : fam.descriptionEn || fam.descriptionSi;
              const showPhoto = Boolean(fam.coverPhotoUrl) && !brokenImages[fam.id];
              const orderLabel =
                fam.sortOrder < 10 ? `0${fam.sortOrder}` : String(fam.sortOrder);

              return (
                <motion.article
                  key={fam.id}
                  initial={false}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.2 }}
                  className="group rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden grid grid-cols-1 sm:grid-cols-5 hover:border-rose-300 dark:hover:border-rose-800 hover:shadow-md transition-all"
                >
                  <div
                    onClick={() => onSelectFamily(fam.id)}
                    className="sm:col-span-2 aspect-4/3 sm:aspect-auto sm:h-full bg-stone-100 dark:bg-stone-800 cursor-pointer overflow-hidden"
                  >
                    {showPhoto ? (
                      <img
                        src={fam.coverPhotoUrl}
                        alt={name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [fam.id]: true }))
                        }
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full min-h-[180px] flex flex-col items-center justify-center p-4 text-center">
                        <span className="font-display text-3xl font-bold text-stone-300 dark:text-stone-700 tabular-nums">
                          {orderLabel}
                        </span>
                        <span className="text-xs text-stone-500 dark:text-stone-400 mt-1 flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>{t.noPhotoYet}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-3 p-6 flex flex-col justify-between gap-4">
                    <div
                      onClick={() => onSelectFamily(fam.id)}
                      className="cursor-pointer space-y-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100 group-hover:text-rose-700 dark:group-hover:text-rose-400 transition-colors">
                          {name}
                        </h3>
                        {typeof fam.memberCount === 'number' && (
                          <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums shrink-0">
                            {fam.memberCount} {t.membersCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                        {desc || t.noDescriptionYet}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                      <button
                        type="button"
                        onClick={() => onSelectFamily(fam.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 text-xs font-medium transition-colors min-h-[38px]"
                      >
                        <span>{t.viewFamily}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFamily(fam)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-xs font-medium text-stone-700 dark:text-stone-200 hover:border-rose-300 dark:hover:border-rose-700 min-h-[38px]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{t.editFamily}</span>
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      {/* Edit Existing Family Modal */}
      <AnimatePresence>
        {editingFamily && (
          <EditFamilyModal
            lang={lang}
            family={editingFamily}
            localProfile={localProfile}
            onClose={() => setEditingFamily(null)}
            onSaved={(updated) => {
              setBrokenImages((prev) => ({ ...prev, [updated.id]: false }));
              onFamilyUpdated(updated);
            }}
          />
        )}
      </AnimatePresence>

      {/* Add New Family Modal */}
      <AnimatePresence>
        {addModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAddModalOpen(false)}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
            >
              <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
                  {t.addFamily}
                </h3>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleAddFamily} className="p-6 space-y-4">
                {newCoverUrl && (
                  <div className="rounded-xl overflow-hidden aspect-4/3 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                    <img
                      src={newCoverUrl}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <SinglePhotoUploader
                  lang={lang}
                  value={newCoverUrl}
                  onChange={setNewCoverUrl}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      {t.familyNameEn}
                    </label>
                    <input
                      type="text"
                      value={newNameEn}
                      onChange={(e) => setNewNameEn(e.target.value)}
                      placeholder="e.g. Silva Family"
                      className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      {t.familyNameSi}
                    </label>
                    <input
                      type="text"
                      value={newNameSi}
                      onChange={(e) => setNewNameSi(e.target.value)}
                      placeholder="උදා: සිල්වා පවුල"
                      className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    {t.familyDescEn}
                  </label>
                  <textarea
                    rows={2}
                    value={newDescEn}
                    onChange={(e) => setNewDescEn(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    {t.familyDescSi}
                  </label>
                  <textarea
                    rows={2}
                    value={newDescSi}
                    onChange={(e) => setNewDescSi(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-base sm:text-sm"
                  />
                </div>
                {addError && <p className="text-xs text-rose-600 dark:text-rose-400">{addError}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-medium"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={savingNew}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-medium disabled:opacity-60"
                  >
                    {savingNew && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{t.addFamily}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
