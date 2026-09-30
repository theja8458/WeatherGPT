import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, MessageSquare, AlertTriangle, Sprout, Compass, LineChart, Settings, ShieldAlert } from 'lucide-react';
import { useWeather } from '../context/WeatherContext';

export default function BottomNav() {
  const { t } = useTranslation();
  const { userRole } = useWeather();

  const navItems = [
    { to: '/', label: t('home', 'Home'), icon: Home },
    { to: '/chat', label: t('chat', 'Chat'), icon: MessageSquare },
    ...(userRole === 'disaster_manager'
      ? [{ to: '/officer', label: 'Officer', icon: ShieldAlert }]
      : [{ to: '/advisory', label: t('advisory', 'Advisory'), icon: Sprout }]),
    { to: '/alerts', label: t('alerts', 'Alerts'), icon: AlertTriangle },
    { to: '/map', label: t('map', 'Map'), icon: Compass },
    { to: '/climate', label: t('climate', 'Climate'), icon: LineChart },
    { to: '/settings', label: t('settings', 'Settings'), icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-1 py-1 shadow-2xl">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-1 px-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-sky-400 font-bold scale-105'
                    : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
