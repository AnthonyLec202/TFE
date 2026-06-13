import { forwardRef } from 'react';
import { Bell } from 'lucide-react';
import type { NotificationResponse } from '../../../types/notification';

export interface NotificationBellProps {
  notifications: NotificationResponse[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (notification: NotificationResponse) => void;
}

export const NotificationBell = forwardRef<HTMLDivElement, NotificationBellProps>(
  function NotificationBell({ notifications, isOpen, onToggle, onSelect }, ref) {
    const unreadCount = notifications.length;

    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={onToggle}
          className="relative flex items-center justify-center w-9 h-9 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="Notifications"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 z-50 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-900">Notifications</span>
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">Aucune notification.</p>
            ) : (
              <ul className="max-h-96 overflow-y-auto py-1">
                {notifications.map(notification => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(notification)}
                      className="w-full flex flex-col items-start gap-0.5 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-slate-800">{notification.title}</span>
                      <span className="text-xs text-slate-500">{notification.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }
);
