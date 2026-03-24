import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import type { CardArtAsset } from '../types';

const CACHE_TTL_MS = 48 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'openarena:scryfall-art:';
const memoryCache = new Map<string, CardArtAsset>();
const pendingRequests = new Map<string, Promise<CardArtAsset>>();

interface ScryfallImages {
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

interface ScryfallFace {
  image_uris?: ScryfallImages;
}

interface ScryfallCardResponse {
  name: string;
  image_uris?: ScryfallImages;
  card_faces?: ScryfallFace[];
}

function getCacheKey(name: string): string {
  return name.trim().toLowerCase();
}

function getStorageKey(name: string): string {
  return `${STORAGE_PREFIX}${getCacheKey(name)}`;
}

function readFromStorage(name: string): CardArtAsset | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(name));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CardArtAsset;
    if (!parsed.fetchedAt || Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(getStorageKey(name));
      return null;
    }

    return { ...parsed, cacheHit: true };
  } catch {
    return null;
  }
}

function writeToStorage(name: string, asset: CardArtAsset): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(name), JSON.stringify(asset));
  } catch {
    // Storage failures should not break rendering.
  }
}

function normalizeResponse(name: string, response: ScryfallCardResponse): CardArtAsset {
  const imageUris = response.image_uris ?? response.card_faces?.find((face) => face.image_uris)?.image_uris;

  if (!imageUris) {
    return {
      status: 'error',
      name,
      fetchedAt: Date.now(),
      error: 'No image URIs returned by Scryfall.',
    };
  }

  return {
    status: 'loaded',
    name: response.name,
    normal: imageUris.normal,
    large: imageUris.large,
    png: imageUris.png,
    artCrop: imageUris.art_crop,
    borderCrop: imageUris.border_crop,
    fetchedAt: Date.now(),
  };
}

async function requestCardArt(name: string): Promise<CardArtAsset> {
  const cacheKey = getCacheKey(name);
  const cached = memoryCache.get(cacheKey) ?? readFromStorage(name);

  if (cached) {
    memoryCache.set(cacheKey, cached);
    return cached;
  }

  const existingRequest = pendingRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetch(
    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`,
    {
      headers: {
        Accept: 'application/json;q=0.9,*/*;q=0.8',
      },
    },
  )
    .then(async (response) => {
      if (!response.ok) {
        return {
          status: 'error' as const,
          name,
          fetchedAt: Date.now(),
          error: `Scryfall request failed (${response.status})`,
        };
      }

      const payload = (await response.json()) as ScryfallCardResponse;
      const asset = normalizeResponse(name, payload);
      memoryCache.set(cacheKey, asset);
      if (asset.status === 'loaded') {
        writeToStorage(name, asset);
      }
      return asset;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown art request failure';
      const asset: CardArtAsset = {
        status: 'error',
        name,
        fetchedAt: Date.now(),
        error: message,
      };
      memoryCache.set(cacheKey, asset);
      return asset;
    })
    .finally(() => {
      pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, request);
  return request;
}

export function prefetchCardArt(name: string): Promise<CardArtAsset> {
  return requestCardArt(name);
}

export function useCardArt(
  name: string | undefined,
  options?: { enabled?: boolean },
): CardArtAsset {
  const enabled = options?.enabled ?? true;
  const deferredName = useDeferredValue(name);

  const [asset, setAsset] = useState<CardArtAsset>(() => {
    if (!deferredName || !enabled) {
      return { status: 'idle', name: deferredName ?? '' };
    }

    return (
      memoryCache.get(getCacheKey(deferredName)) ??
      readFromStorage(deferredName) ?? {
        status: 'loading',
        name: deferredName,
      }
    );
  });

  useEffect(() => {
    if (!deferredName || !enabled) {
      startTransition(() => {
        setAsset({ status: 'idle', name: deferredName ?? '' });
      });
      return;
    }

    const cached = memoryCache.get(getCacheKey(deferredName)) ?? readFromStorage(deferredName);
    if (cached) {
      startTransition(() => {
        setAsset(cached);
      });
      return;
    }

    let cancelled = false;
    startTransition(() => {
      setAsset({ status: 'loading', name: deferredName });
    });

    void requestCardArt(deferredName).then((resolved) => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setAsset(resolved);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [deferredName, enabled]);

  return asset;
}
