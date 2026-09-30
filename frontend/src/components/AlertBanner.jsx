import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  X,
} from 'lucide-react';

export default function AlertBanner({
  alert,
  language = 'en',
  onDismiss,
  showNormalState = false,
  className = '',
}) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  // Handle normal or no-alert state
  if (!alert || alert.severity === 'green' || alert.severity === 'normal') {
    if (!showNormalState) return null;

    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="alert-banner-normal"
        className={`flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs shadow-sm ${className}`}
      >
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="font-medium">
            {language === 'te'
              ? 'సాధారణ వాతావరణం — ప్రస్తుతానికి ఎటువంటి హెచ్చరికలు లేవు'
              : language === 'hi'
              ? 'सामान्य मौसम — वर्तमान में कोई सक्रिय चेतावनी नहीं है'
              : 'Normal Conditions — No Active Weather Warnings'}
          </span>
        </div>
        {onDismiss && (
          <button
            onClick={() => {
              setIsDismissed(true);
              onDismiss(alert?.id || 'normal');
            }}
            aria-label="Dismiss alert"
            className="p-1 rounded-full text-emerald-400 hover:text-emerald-200 hover:bg-emerald-500/20 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Safe fallback for incomplete / missing fields
  const rawSeverity = (alert.severity || 'yellow').toLowerCase();
  const isRed = rawSeverity === 'red' || rawSeverity === 'critical' || rawSeverity === 'severe';
  const isOrange = rawSeverity === 'orange';

  // Multilingual content extraction
  let title = alert.title || 'Weather Advisory';
  let message = alert.description || alert.message || 'No additional details provided';

  if (language && alert.translations && alert.translations[language]) {
    const tLang = alert.translations[language];
    if (tLang.title) title = tLang.title;
    if (tLang.description || tLang.message) message = tLang.description || tLang.message;
  }

  // Severity visual styling and label
  let severityLabel = 'Yellow Watch';
  let badgeStyle = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  let containerStyle = 'bg-yellow-950/40 border-yellow-500/50 text-yellow-100';
  let Icon = AlertCircle;

  if (isRed) {
    severityLabel = 'Red Warning (Critical)';
    badgeStyle = 'bg-rose-500 text-white border-rose-400 animate-pulse font-extrabold';
    containerStyle = 'bg-rose-950/60 border-rose-500/60 text-rose-100 shadow-rose-950/50 shadow-md';
    Icon = ShieldAlert;
  } else if (isOrange) {
    severityLabel = 'Orange Alert (Severe)';
    badgeStyle = 'bg-orange-500 text-white border-orange-400 font-bold';
    containerStyle = 'bg-orange-950/50 border-orange-500/60 text-orange-100 shadow-orange-950/40 shadow-sm';
    Icon = AlertTriangle;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss(alert.id || alert._id);
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="alert-banner"
      data-severity={rawSeverity}
      className={`relative p-3.5 rounded-2xl border transition-all ${containerStyle} ${className}`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start space-x-3">
          <div className="mt-0.5 flex-shrink-0">
            <Icon className="w-5 h-5 text-current animate-bounce" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center flex-wrap gap-2">
              <span
                data-testid="alert-severity"
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeStyle}`}
              >
                {severityLabel}
              </span>
              <h4 data-testid="alert-title" className="text-xs font-bold uppercase tracking-wide">
                {title}
              </h4>
            </div>
            <p data-testid="alert-message" className="text-xs leading-relaxed opacity-95">
              {message}
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={handleDismiss}
            aria-label="Dismiss alert"
            data-testid="alert-dismiss-btn"
            className="p-1 rounded-full text-current opacity-70 hover:opacity-100 hover:bg-white/10 transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
