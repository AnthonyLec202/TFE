import { forwardRef } from 'react';
import { Bell } from 'lucide-react';
import type { NotificationResponse, NotificationType } from '../../../types/notification';

export interface NotificationBellProps {
  notifications: NotificationResponse[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (notification: NotificationResponse) => void;
}

function resolveNotificationTitle(type: NotificationType): string {
  switch (type) {
    case 'NewPost':     return 'Nouvelle publication';
    case 'NewComment':  return 'Nouveau commentaire';
    case 'PatientUpdated': return 'Dossier mis à jour';
  }
}

function resolveNotificationMessage(notification: NotificationResponse): string {
  const actorName = [notification.actorFirstName, notification.actorLastName]
    .filter(Boolean)
    .join(' ');

  switch (notification.type) {
    case 'NewPost':
      return actorName
        ? `${actorName} a publié sur le mur.`
        : 'Une nouvelle publication a été ajoutée.';
    case 'NewComment':
      return actorName
        ? `${actorName} a ajouté un commentaire.`
        : 'Un nouveau commentaire a été ajouté.';
    case 'PatientUpdated':
      return actorName
        ? `${actorName} a mis à jour le dossier.`
        : 'Le dossier patient a été mis à jour.';
  }
}

export const NotificationBell = forwardRef<HTMLDivElement, NotificationBellProps>(
  function NotificationBell({ notifications, isOpen, onToggle, onSelect }, ref) {
    const unreadCount = notifications.length;

    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={onToggle}
          className="relative flex items-center justify-center w-[38px] h-[38px] rounded-full text-taupe-500 hover:bg-sand-100 hover:text-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol-600 focus-visible:ring-offset-2"
          aria-label="Notifications"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-terracotta text-white text-[10px] font-semibold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] z-50 rounded-xl border border-sand-200 bg-white shadow-[0_8px_28px_rgba(45,40,33,0.14)] overflow-hidden">
            <div className="px-4 py-3 border-b border-sand-100">
              <span className="text-sm font-medium text-ink">Notifications</span>
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-taupe-400 text-center">Aucune notification.</p>
            ) : (
              <ul className="max-h-96 overflow-y-auto py-1">
                {notifications.map(notification => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(notification)}
                      className="w-full flex flex-col items-start gap-0.5 px-4 py-2.5 text-left hover:bg-sand-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-ink">
                        {resolveNotificationTitle(notification.type)}
                      </span>
                      <span className="text-xs text-taupe-500">
                        {resolveNotificationMessage(notification)}
                      </span>
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
