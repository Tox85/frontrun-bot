export type ListingTiming = 'live' | 'future' | 'stale';
export declare function classifyListingTiming(tradeTimeUtc?: Date | null, nowUtc?: Date, liveWindowMs?: number): ListingTiming;
