export interface CardArtAsset {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  name: string;
  normal?: string;
  large?: string;
  png?: string;
  artCrop?: string;
  borderCrop?: string;
  fetchedAt?: number;
  cacheHit?: boolean;
  error?: string;
}
