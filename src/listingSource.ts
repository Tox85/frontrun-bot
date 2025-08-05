// Interface pour la source de nouveaux listings
export interface ListingSource {
  startListening(callback: (symbol: string, metadata?: any) => void): void;
  stopListening(): void;
}

// Métadonnées pour les listings
export interface ListingMetadata {
  title?: string;
  url?: string;
  timestamp?: number;
  source?: string;
  price?: string;
  volume?: string;
} 