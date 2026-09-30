import React from 'react';
import { Check, Globe } from 'lucide-react';
import { supportedLanguages as defaultSupportedLanguages } from '../i18n';

export default function LanguageSelector({
  selectedLanguage = 'en',
  onSelectLanguage,
  languages = defaultSupportedLanguages,
  layout = 'grid',
  className = '',
}) {
  const handleSelect = (code) => {
    if (onSelectLanguage) {
      onSelectLanguage(code);
    }
  };

  return (
    <div
      role="region"
      aria-label="Language Selector"
      data-testid="language-selector"
      className={`space-y-2 ${className}`}
    >
      <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
        <Globe className="w-3.5 h-3.5 text-sky-400" />
        <span>Select Language</span>
      </div>

      <div
        role="radiogroup"
        aria-label="Available languages"
        className={
          layout === 'inline'
            ? 'flex flex-wrap gap-1.5'
            : 'grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-72 overflow-y-auto'
        }
      >
        {languages.map((lang) => {
          const isSelected = selectedLanguage === lang.code;
          return (
            <button
              key={lang.code}
              role="radio"
              aria-checked={isSelected}
              data-testid={`lang-option-${lang.code}`}
              data-selected={isSelected}
              onClick={() => handleSelect(lang.code)}
              className={`text-left p-2 rounded-xl border text-xs font-medium flex items-center justify-between transition-all ${
                isSelected
                  ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold shadow-sm ring-1 ring-sky-500/50'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xs">{lang.name}</span>
                {lang.native && lang.native !== lang.name && (
                  <span className="text-[10px] opacity-75">{lang.native}</span>
                )}
              </div>
              {isSelected && (
                <Check
                  data-testid={`lang-check-${lang.code}`}
                  className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 ml-1.5"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
