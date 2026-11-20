import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Loader2 } from 'lucide-react';
import { T } from '../i18n';
import { apiFetch } from '../lib/staticFallback';
import type { Family, Lang, LocalProfile } from '../types';
import { SinglePhotoUploader } from './MediaUploader';

interface Props {
  lang: Lang;
  family: Family;
  localProfile?: LocalProfile;
  onClose: () => void;
  onSaved: (updated: Family) => void;
}

export const EditFamilyModal: React.FC<Props> = ({
  lang,
  family,
  localProfile,
  onClose,
  onSaved,
}) => {
  const t = T[lang];
  const [nameEn, setNameEn] = useState(family.nameEn);
  const [nameSi, setNameSi] = useState(family.nameSi);
  const [descriptionEn, setDescriptionEn] = useState(family.descriptionEn);
  const [descriptionSi, setDescriptionSi] = useState(family.descriptionSi);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(family.coverPhotoUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (localProfile?.clientId) headers['x-client-id'] = localProfile.clientId;
      if (localProfile?.name?.trim()) headers['x-author-name'] = encodeURIComponent(localProfile.name.trim());

      const res = await apiFetch(`/api/families/${family.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          nameEn,
          nameSi,
          descriptionEn,
          descriptionSi,
          coverPhotoUrl,
        }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!res.ok || !data.family) {
        throw new Error(data.error || `Failed to update family (${res.status})`);
      }
      onSaved(data.family);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
            {t.editFamily} — {lang === 'si' ? family.nameSi : family.nameEn}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {coverPhotoUrl && (
            <div className="rounded-xl overflow-hidden aspect-4/3 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
              <img
                src={coverPhotoUrl}
                alt={nameEn}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <SinglePhotoUploader
            lang={lang}
            value={coverPhotoUrl}
            onChange={setCoverPhotoUrl}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t.familyNameEn}
              </label>
              <input
                type="text"
                required
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t.familyNameSi}
              </label>
              <input
                type="text"
                required
                value={nameSi}
                onChange={(e) => setNameSi(e.target.value)}
                className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              {t.familyDescEn}
            </label>
            <textarea
              rows={2}
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              {t.familyDescSi}
            </label>
            <textarea
              rows={2}
              value={descriptionSi}
              onChange={(e) => setDescriptionSi(e.target.value)}
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
            />
          </div>

          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-medium disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t.save}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
