import { useEffect, useState } from 'react';

import { useCollectionApi } from '../lib/useCollectionApi';
import type { FileVariant } from '../lib/apiClient';

export function useFileObjectUrl(
  documentId: string | undefined,
  variant: FileVariant,
  enabled = true,
): string | null {
  const api = useCollectionApi();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    setObjectUrl(null);
    if (!enabled || !documentId || !api.idToken) return undefined;

    let cancelled = false;
    let createdUrl: string | null = null;
    void api.fetchObject(documentId, variant)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [api, documentId, enabled, variant]);

  if (!enabled || !documentId) return null;
  return api.idToken ? objectUrl : api.fileUrl(documentId, variant);
}
