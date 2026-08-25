'use client';

import { useEffect } from 'react';

export default function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      return;
    }

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    const scope = `${basePath || ''}/`;

    navigator.serviceWorker
      .register(`${basePath}/sw.js`, { scope })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const urls = [
          window.location.href,
          ...performance
            .getEntriesByType('resource')
            .map((entry) => entry.name),
        ];
        registration.active?.postMessage({
          type: 'PREPARE_OFFLINE',
          urls,
        });
      })
      .catch(() => {
        // Scanning remains available online if offline caching is unavailable.
      });
  }, []);

  return null;
}
