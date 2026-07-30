import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';

const OFFLINE_MUTATION_EVENT = 'schoolos:offline-mutation-blocked';

export default function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleBlockedMutation = () => {
      toast.error('You are offline. Reconnect before saving or submitting changes.', {
        id: 'schoolos-offline-mutation',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_MUTATION_EVENT, handleBlockedMutation);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_MUTATION_EVENT, handleBlockedMutation);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('schoolos-offline', !online);
    return () => document.documentElement.classList.remove('schoolos-offline');
  }, [online]);

  if (online) return null;

  return (
    <div
      className="pwa-network-banner"
      role="status"
      aria-live="polite"
    >
      <WifiOff aria-hidden="true" size={16} />
      <span>You’re offline. Live school data and all save actions are unavailable.</span>
      <a href={`${import.meta.env.BASE_URL}offline`}>Offline help</a>
    </div>
  );
}
