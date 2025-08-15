export interface BithumbNotice {
    id: number;
    title: string;
    categories: string[];
    pc_url: string;
    published_at: string;
    content?: string;
}
export interface ProcessedNotice {
    eventId: string;
    base: string;
    title: string;
    url: string;
    publishedAtUtc: string;
    goLiveAt?: string;
    priority: 'high' | 'medium' | 'low';
    status: 'scheduled' | 'live' | 'completed';
    source: 'bithumb.api';
}
export declare class NoticeClient {
    private readonly baseUrl;
    private readonly keywords;
    private readonly rateLimit;
    constructor();
    /**
     * Récupère les dernières notices depuis l'API officielle Bithumb
     */
    fetchLatestNotices(count?: number): Promise<BithumbNotice[]>;
    /**
     * Filtre les notices pour détecter les nouveaux listings
     */
    isListingNotice(notice: BithumbNotice): boolean;
    /**
     * Extrait la base du token depuis le titre
     */
    extractTokenBase(notice: BithumbNotice): string | null;
    /**
     * Convertit le timestamp KST en UTC
     */
    parsePublishedUtc(notice: BithumbNotice): string;
    /**
     * Détecte si c'est un pré-listing (date future)
     */
    isFutureListing(notice: BithumbNotice): boolean;
    /**
     * Calcule la priorité du listing
     */
    calculatePriority(notice: BithumbNotice): 'high' | 'medium' | 'low';
    /**
     * Génère un EventId unique et déterministe
     */
    generateEventId(notice: BithumbNotice): string;
    /**
     * Traite une notice et la convertit en format interne
     */
    processNotice(notice: BithumbNotice): ProcessedNotice | null;
    /**
     * Récupère et traite les dernières notices
     */
    getLatestListings(count?: number): Promise<ProcessedNotice[]>;
}
