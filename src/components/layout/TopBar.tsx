import { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, ChevronDown } from 'lucide-react';
import { clsx } from '@/utils/clsx';
import type { User } from '@/types';

interface TopBarProps {
  title: string;
  onMenuClick: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  user: User;
  onProfile: () => void;
  onWorkshopSettings: () => void;
  onHelpSupport: () => void;
  onSignOut: () => void;
}

export function TopBar({ title, onMenuClick, search, onSearchChange, user, onProfile, onWorkshopSettings, onHelpSupport, onSignOut }: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const notifications = [
    { id: 1, text: 'Pressure Vessel Repair payment overdue', time: '2h ago', color: 'bg-red-500' },
    { id: 2, text: 'I-Beam 300mm stock below reorder level', time: '5h ago', color: 'bg-amber-500' },
    { id: 3, text: 'New job created: Roof Truss Set - Building B', time: '1d ago', color: 'bg-blue-500' },
  ];

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-charcoal-700/60 bg-charcoal-900/80 px-4 backdrop-blur-md lg:px-6">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-steel-400 hover:bg-charcoal-700 hover:text-steel-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-semibold text-steel-100">{title}</h2>

        {/* Search */}
        <div className="relative ml-auto hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search customers, jobs, inventory…"
            className="w-64 rounded-lg border border-charcoal-700 bg-charcoal-800/80 py-2 pl-9 pr-14 text-sm text-steel-100 placeholder-steel-500 transition-colors focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 lg:w-80"
          />
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded border border-charcoal-600 bg-charcoal-700 px-1.5 py-0.5 text-[10px] font-medium text-steel-300">
            <span className="text-xs">⌘</span><span>K</span>
          </div>
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative ml-auto md:ml-0">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative rounded-lg p-2 text-steel-400 hover:bg-charcoal-700 hover:text-steel-100 transition-colors"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-charcoal-900" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-charcoal-700 bg-charcoal-800 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-charcoal-700 px-4 py-3">
                <span className="text-sm font-semibold text-steel-100">Notifications</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                  {notifications.length} new
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 border-b border-charcoal-700/50 px-4 py-3 hover:bg-charcoal-700/40">
                    <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.color)} />
                    <div>
                      <p className="text-sm text-steel-200">{n.text}</p>
                      <p className="mt-0.5 text-xs text-steel-500">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full border-t border-charcoal-700 px-4 py-2.5 text-center text-sm text-amber-400 hover:bg-charcoal-700/40">
                View all notifications
              </button>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg p-1.5 pr-2 hover:bg-charcoal-700/60 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-charcoal-950">
              {initials}
            </div>
            <div className="hidden text-left lg:block">
              <p className="text-sm font-medium text-steel-100">{user.name}</p>
              <p className="text-xs text-steel-500 capitalize">{user.role}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-steel-500 lg:block" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-charcoal-700 bg-charcoal-800 shadow-2xl shadow-black/40">
              <div className="border-b border-charcoal-700 px-4 py-3">
                <p className="text-sm font-medium text-steel-100">{user.name}</p>
                <p className="text-xs text-steel-500">{user.email ?? '—'}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setProfileOpen(false); onProfile(); }}
                  className="w-full px-4 py-2 text-left text-sm text-steel-300 hover:bg-charcoal-700/40"
                >
                  My Profile
                </button>
                <button
                  onClick={() => { setProfileOpen(false); onWorkshopSettings(); }}
                  className="w-full px-4 py-2 text-left text-sm text-steel-300 hover:bg-charcoal-700/40"
                >
                  Workshop Settings
                </button>
                <button
                  onClick={() => { setProfileOpen(false); onHelpSupport(); }}
                  className="w-full px-4 py-2 text-left text-sm text-steel-300 hover:bg-charcoal-700/40"
                >
                  Help & Support
                </button>
              </div>
              <button
                onClick={() => { setProfileOpen(false); setConfirmSignOut(true); }}
                className="w-full border-t border-charcoal-700 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-charcoal-700/40"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Sign Out confirmation */}
      {confirmSignOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-charcoal-700 bg-charcoal-800 shadow-2xl">
            <div className="border-b border-charcoal-700 px-5 py-4">
              <h3 className="text-base font-semibold text-steel-100">Sign Out</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-steel-300">Are you sure you want to sign out? You'll need to log in again to access the dashboard.</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-charcoal-700 px-5 py-4">
              <button
                onClick={() => setConfirmSignOut(false)}
                className="rounded-lg bg-charcoal-700 px-4 py-2 text-sm text-steel-100 hover:bg-charcoal-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmSignOut(false); onSignOut(); }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
