import React, { useRef, useState } from 'react';
import { Upload, Trash2, Loader2 } from 'lucide-react';
import { T } from '../i18n';
import { apiFetch } from '../lib/staticFallback';
import type { Lang, MediaAsset } from '../types';

interface SingleUploadProps {
  lang: Lang;
  value: string;
  onChange: (url: string) => void;
  purpose?: 'media' | 'avatar';
  accept?: string;
  label?: string;
}

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|bmp|tiff?|avif)$/i;

export async function prepareImageForUpload(file: File, maxDim = 2048): Promise<File> {
  const isImage = file.type.startsWith('image/') || IMAGE_EXT_RE.test(file.name);
  if (
    !isImage ||
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml'
  ) {
    return file;
  }

  let objectUrl: string | null = null;
  let bitmap: ImageBitmap | null = null;

  try {
    let srcWidth = 0;
    let srcHeight = 0;
    let drawSource: CanvasImageSource | null = null;

    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file);
        srcWidth = bitmap.width;
        srcHeight = bitmap.height;
        drawSource = bitmap;
      } catch {
        bitmap = null;
      }
    }

    if (!drawSource && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      objectUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('decode failed'));
        el.src = objectUrl!;
      });
      srcWidth = img.naturalWidth || img.width;
      srcHeight = img.naturalHeight || img.height;
      drawSource = img;
    }

    if (!drawSource || !srcWidth || !srcHeight) {
      return file;
    }

    const largestSide = Math.max(srcWidth, srcHeight);
    if (largestSide <= maxDim && file.size <= 900 * 1024) {
      return file;
    }

    const scale = Math.min(1, maxDim / largestSide);
    const targetW = Math.max(1, Math.round(srcWidth * scale));
    const targetH = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(drawSource, 0, 0, targetW, targetH);

    // Progressive quality downscale so even huge multi-megapixel images stay fast & host-friendly
    const targetBytes = 1.8 * 1024 * 1024;
    let quality = 0.88;
    let blob: Blob | null = null;

    for (let pass = 0; pass < 3; pass++) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
      );
      if (!blob || blob.size <= targetBytes) break;
      quality -= 0.14;
    }

    if (!blob) return file;
    if (blob.size >= file.size && largestSide <= maxDim) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    try {
      bitmap?.close?.();
    } catch {
      // ignore bitmap close errors
    }
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore revoke errors
      }
    }
  }
}

export async function uploadSingleFile(file: File, purpose = 'media') {
  const maxDim = purpose === 'avatar' ? 1024 : 2048;
  const prepared = await prepareImageForUpload(file, maxDim);
  const formData = new FormData();
  formData.append('file', prepared);
  formData.append('purpose', purpose);
  const res = await apiFetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  return data;
}

export const SinglePhotoUploader: React.FC<SingleUploadProps> = ({
  lang,
  value,
  onChange,
  purpose = 'media',
  accept = 'image/*',
  label,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const t = T[lang];

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const data = await uploadSingleFile(file, purpose);
      onChange(data.url);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFile}
        className="hidden"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3.5 py-2 text-xs font-medium text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-60 min-h-[40px]"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          <span>{uploading ? t.uploading : value ? t.changePhoto : label || t.uploadPhoto}</span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors min-h-[40px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.removePhoto}</span>
          </button>
        )}
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
};

interface MultiUploadProps {
  lang: Lang;
  items: MediaAsset[];
  onChange: (items: MediaAsset[]) => void;
}

export const MultiMediaUploader: React.FC<MultiUploadProps> = ({ lang, items, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState('');
  const t = T[lang];

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const uploaded: MediaAsset[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgressText(`${i + 1}/${files.length}`);
        const data = await uploadSingleFile(files[i], 'media');
        uploaded.push({ url: data.url, type: data.type, name: data.name });
      }
      onChange([...items, ...uploaded]);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgressText('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFiles}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3.5 py-2 text-xs font-medium text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors min-h-[40px]"
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        <span>{uploading ? `${t.uploading} ${progressText}` : t.uploadMedia}</span>
      </button>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      {items.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {items.map((item, idx) => (
            <div
              key={`${item.url}-${idx}`}
              className="relative group rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 aspect-square bg-stone-100 dark:bg-stone-800"
            >
              {item.type === 'video' ? (
                <video src={item.url} className="w-full h-full object-cover" />
              ) : (
                <img
                  src={item.url}
                  alt={item.name || 'Uploaded media'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                aria-label="Remove media"
                className="absolute top-1 right-1 rounded-full bg-black/70 text-white p-1 opacity-90 hover:bg-rose-700"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
