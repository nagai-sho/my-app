import { useCollectionApi } from '../lib/useCollectionApi';
import type { FileVariant } from '../lib/apiClient';

export function useFileObjectUrl(
  documentId: string | undefined,
  variant: FileVariant,
  enabled = true,
): string | null {
  const api = useCollectionApi();

  if (!enabled || !documentId) return null;
  // The file endpoint is same-origin and authenticates with the shared
  // HttpOnly cookie. Keep the URL direct so the browser sends the cookie and
  // the Service Worker can continue to exclude private R2 responses.
  return api.fileUrl(documentId, variant);
}
