import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalNotifications } from './hooks/useGlobalNotifications';
import { NotificationBell } from './components/NotificationBell';
import type { NotificationResponse } from '../../types/notification';

export function NotificationBellContainer() {
  const { notifications, markAsRead } = useGlobalNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSelect(notification: NotificationResponse) {
    setIsOpen(false);
    await markAsRead(notification.id);
    // The collaborative wall is the default tab of the patient detail page — there is no
    // dedicated /wall route.
    navigate(`/patients/${notification.patientId}`);
  }

  return (
    <NotificationBell
      ref={containerRef}
      notifications={notifications}
      isOpen={isOpen}
      onToggle={() => setIsOpen(open => !open)}
      onSelect={handleSelect}
    />
  );
}
