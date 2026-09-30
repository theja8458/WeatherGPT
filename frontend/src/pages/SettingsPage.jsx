import React from 'react';
import { Settings, User, Bell, Globe, Shield } from 'lucide-react';
import { useWeather } from '../context/WeatherContext';
import { supportedLanguages } from '../i18n';

export default function SettingsPage() {
  const { selectedLanguage, setSelectedLanguage, currentLocation } = useWeather();

  return (
    <div className="space-y-4 pb-24 pt-2">
      <div className="p-4 rounded-3xl bg-slate-800/80 border border-slate-700/60 shadow-lg">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-2xl bg-sky-500/20 text-sky-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">App Settings</h2>
            <p className="text-[11px] text-slate-400">Preferences & Persona Configuration</p>
          </div>
        </div>

        <div className="space-y-3 divide-y divide-slate-700/40 text-xs">
          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-200">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>Display Language</span>
            </div>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sky-300 font-medium focus:outline-none"
            >
              {supportedLanguages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-200">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Default Persona / Role</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-700 text-slate-200 font-medium">
              Citizen (Prompt 15)
            </span>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-200">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>IMD Weather Notifications</span>
            </div>
            <span className="text-emerald-400 font-semibold">Enabled</span>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-200">
              <Shield className="w-4 h-4 text-teal-400" />
              <span>Data Providers</span>
            </div>
            <span className="text-slate-400 text-[11px]">IMD, MoES, Open-Meteo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
