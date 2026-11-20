import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Share,
  Smartphone,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { T } from '../i18n';
import type { Lang } from '../types';

interface Props {
  lang: Lang;
}

interface ModalProps {
  lang: Lang;
  isOpen: boolean;
  isInstallable: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInIframe: boolean;
  onInstallClick: () => void;
  onAlreadyInstalled: () => void;
  onClose: () => void;
}

const InstallAppModal: React.FC<ModalProps> = ({
  lang,
  isOpen,
  isInstallable,
  isIOS,
  isAndroid,
  isInIframe,
  onInstallClick,
  onAlreadyInstalled,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const t = T[lang];

  useEffect(() => {
    if (isOpen) {
      setShowSteps(!isInstallable && !isInIframe);
    }
  }, [isOpen, isInstallable, isInIframe]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard fallback ignored
    }
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl"
          >
            {/* App Card Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <img
                  src="/emblem.png"
                  alt="Our Families"
                  className="w-14 h-14 rounded-full object-cover shrink-0 shadow-md ring-2 ring-amber-400/50"
                />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    OUR FAMILIES · APP
                  </p>
                  <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100 leading-snug">
                    {isIOS
                      ? t.iosGuideTitle
                      : lang === 'si'
                        ? 'OUR FAMILIES App එක Install කරගන්න'
                        : 'Install OUR FAMILIES App'}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    {lang === 'si'
                      ? 'ඔබේ දුරකථනයේ Home Screen එකට එක් කරගන්න'
                      : 'Add directly to your phone or computer home screen'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.close}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* App Benefits */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-stone-50 dark:bg-stone-800/70 p-2.5 border border-stone-200/70 dark:border-stone-700/70">
                <Sparkles className="w-4 h-4 text-rose-600 mx-auto mb-1" />
                <p className="text-[11px] font-medium text-stone-700 dark:text-stone-200 leading-tight">
                  {lang === 'si' ? 'ක්ෂණික පිවිසුම' : '1-Tap Open'}
                </p>
              </div>
              <div className="rounded-xl bg-stone-50 dark:bg-stone-800/70 p-2.5 border border-stone-200/70 dark:border-stone-700/70">
                <Bell className="w-4 h-4 text-rose-600 mx-auto mb-1" />
                <p className="text-[11px] font-medium text-stone-700 dark:text-stone-200 leading-tight">
                  {lang === 'si' ? 'සජීවී පණිවිඩ' : 'Live Updates'}
                </p>
              </div>
              <div className="rounded-xl bg-stone-50 dark:bg-stone-800/70 p-2.5 border border-stone-200/70 dark:border-stone-700/70">
                <WifiOff className="w-4 h-4 text-rose-600 mx-auto mb-1" />
                <p className="text-[11px] font-medium text-stone-700 dark:text-stone-200 leading-tight">
                  {lang === 'si' ? 'Offline සහාය' : 'Offline Ready'}
                </p>
              </div>
            </div>

            {/* Primary Install CTA */}
            <div className="mt-5 space-y-3">
              {isInstallable ? (
                <button
                  type="button"
                  onClick={onInstallClick}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white py-3.5 text-sm font-semibold shadow-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'si' ? 'දැන්ම Install කරන්න' : 'Install App Now'}</span>
                </button>
              ) : isInIframe ? (
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white py-3.5 text-sm font-semibold shadow-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>
                    {lang === 'si'
                      ? 'Browser එකෙන් විවෘත කර Install කරන්න'
                      : 'Open in Browser & Install'}
                  </span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSteps(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white py-3.5 text-sm font-semibold shadow-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'si' ? 'App එක Install කරන ආකාරය' : 'Install App'}</span>
                </button>
              )}

              {/* Step-by-step instructions when native prompt isn't available */}
              {showSteps && (
                <div className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  {isIOS ? (
                    <div className="space-y-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/70 p-4 border border-stone-200/70 dark:border-stone-700">
                      <p className="flex items-start gap-2">
                        <span className="font-bold text-rose-700 dark:text-rose-400">1.</span>
                        <span>
                          {t.iosStep1} <Share className="w-3.5 h-3.5 inline text-rose-600 ml-1" />
                        </span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="font-bold text-rose-700 dark:text-rose-400">2.</span>
                        <span>{t.iosStep2}</span>
                      </p>
                    </div>
                  ) : isAndroid ? (
                    <div className="space-y-2 rounded-xl bg-stone-50 dark:bg-stone-800/70 p-4 border border-stone-200/70 dark:border-stone-700">
                      <p>
                        {lang === 'si'
                          ? '1. Chrome බ්‍රව්සරයේ ඉහළ දකුණු කෙළවරේ ඇති ⋮ (Menu) ඔබන්න.'
                          : '1. Tap the ⋮ (Menu) button in the top-right corner of Chrome.'}
                      </p>
                      <p>
                        {lang === 'si'
                          ? '2. "Install app" හෝ "Add to Home screen" තෝරන්න.'
                          : '2. Select "Install app" or "Add to Home screen".'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-xl bg-stone-50 dark:bg-stone-800/70 p-4 border border-stone-200/70 dark:border-stone-700">
                      <p>
                        {lang === 'si'
                          ? 'ඔබගේ බ්‍රව්සරයේ ලිපින තීරුවේ (Address bar) ඇති Install අයිකනය හෝ බ්‍රව්සර් මෙනුවේ "Install OUR FAMILIES" / "Add to Home Screen" තෝරන්න.'
                          : 'Use the Install icon in your browser address bar, or open your browser menu and choose "Install OUR FAMILIES" / "Add to Home Screen".'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isInIframe && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <span className="truncate">
                    {lang === 'si'
                      ? 'හෝ link එක copy කර Chrome/Safari හි අරින්න'
                      : 'Or copy link to open in Chrome/Safari'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 px-2.5 py-1 text-xs font-medium text-stone-800 dark:text-stone-100 shrink-0"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copied
                        ? lang === 'si'
                          ? 'Copy විය!'
                          : 'Copied!'
                        : lang === 'si'
                          ? 'Copy'
                          : 'Copy'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onAlreadyInstalled}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 py-2.5 px-3 text-xs font-semibold transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {lang === 'si' ? 'මම දැනටමත් Install කළා' : 'I Already Installed'}
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="sm:w-28 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 py-2.5 px-4 text-xs font-medium transition-colors"
              >
                {lang === 'si' ? 'පසුව' : 'Later'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const PWAInstallButton: React.FC<Props> = ({ lang }) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isInIframe,
    install,
    markInstalled,
  } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const t = T[lang];

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    const result = await install();
    if (result === 'accepted') {
      setShowGuide(false);
      return;
    }
    if (result === 'unavailable') {
      setShowGuide(true);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
          isInstallable
            ? 'border-rose-600 bg-rose-700 text-white hover:bg-rose-800 shadow-xs'
            : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-700 dark:hover:text-rose-300'
        }`}
      >
        {isIOS ? (
          <Smartphone className="w-3.5 h-3.5" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span>{isIOS ? t.installIOS : t.installApp}</span>
      </motion.button>

      <InstallAppModal
        lang={lang}
        isOpen={showGuide}
        isInstallable={isInstallable}
        isIOS={isIOS}
        isAndroid={isAndroid}
        isInIframe={isInIframe}
        onInstallClick={() => void handleClick()}
        onAlreadyInstalled={() => {
          markInstalled();
          setShowGuide(false);
        }}
        onClose={() => setShowGuide(false)}
      />
    </>
  );
};

export const StartupInstallPrompt: React.FC<Props> = ({ lang }) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isInIframe,
    install,
    markInstalled,
  } = usePWAInstall();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isInstalled) {
      setOpen(false);
      return;
    }
    let snoozed = false;
    try {
      snoozed = window.sessionStorage.getItem('of_install_prompt_closed') === '1';
    } catch {
      snoozed = false;
    }
    if (snoozed) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isInstalled]);

  if (isInstalled) {
    return null;
  }

  const handleClose = () => {
    try {
      window.sessionStorage.setItem('of_install_prompt_closed', '1');
    } catch {
      // ignore sessionStorage restriction
    }
    setOpen(false);
  };

  const handleInstallClick = async () => {
    const result = await install();
    if (result === 'accepted') {
      setOpen(false);
    }
  };

  return (
    <InstallAppModal
      lang={lang}
      isOpen={open}
      isInstallable={isInstallable}
      isIOS={isIOS}
      isAndroid={isAndroid}
      isInIframe={isInIframe}
      onInstallClick={() => void handleInstallClick()}
      onAlreadyInstalled={() => {
        markInstalled();
        setOpen(false);
      }}
      onClose={handleClose}
    />
  );
};
