# BOT RULES — Bithumb-only, Production Ready

## Architecture & Détection
- **T0 (annonce)**: Bithumb NoticePoller HTTP (API publique notices, ≥1100ms, KST→UTC)
- **T2 (ouverture)**: Bithumb WebSocket KRW (filet de sécurité)
- **Baseline KR**: Bithumb REST ALL_KRW **au boot uniquement** (aucun Detected pendant l'init)
- **Aucun Upbit**: détection strictement Bithumb-only

## Gating & Dédup
- Nouveau si BASE ∉ baseline_kr
- eventId déterministe (pas de Date.now()):
  - Notice: sha256("bithumb.notice|" + base + "|" + url + "|" + sorted_markets + "|" + trade_time_iso_opt)
  - WS: sha256("bithumb.ws|" + base + "|KRW")
- processed_events en DB (INSERT OR IGNORE, eventId UNIQUE)

## Anti-spam & Rate Limiting
- WS: double-check REST (3–5s) sur 1ère vue d'une base inconnue
- Debounce 10s par base; warm-up 5s après reconnect WS; mutex par base
- Cooldown 24h après trade
- RateLimiter: reset de fenêtre basé uniquement sur config exchange

## Perps & Trading
- PerpCatalog: refresh 10–15 min + lookup on-demand (Bybit→HL→Binance)
- HL testnet only: target_notional = balance * RISK_PCT * LEVERAGE_TARGET
- Exit +180s (scheduler persistant, reduce-only)
- Circuit breaker: 3 fails d'ordre consécutifs → TRADING_ENABLED=false + alerte

## Singleton & Leadership
- Un seul leader actif; les autres en OBSERVER_MODE (aucun trade/telegram)
- Instance lock en DB avec heartbeat
- Failover automatique si leader down

## Telegram
- Un seul TelegramService avec queue 1 msg/s
- Respect strict de retry_after sur 429
- OBSERVER_MODE → aucun envoi
- Dédup par eventId

## Observabilité
- **/health**: leader_instance_id, OBSERVER_MODE, baseline.krw_count, sanity, p95 latences
- **/metrics**: ws.reconnects, exit.pending, telegram.queue_len, perps_*, notice.5xx
- Alertes Telegram admin sur métriques critiques

## Sécurité
- Pas de log de secrets
- Docker non-root
- SQLite WAL
- Endpoints sensibles protégés

## Endpoints API
- GET /health, /metrics, /baseline, /whoami, /status
- POST /simulate/notice, /simulate/ws, /simulate/notify-burst
- POST /trading/enable|disable

## Jamais faire
- Upbit en détection ou marché-polling
- Baseline KR alimentée par Binance/Bybit/HL
- Telegram hors TelegramService ou en parallèle
- EventId dépendant de l'heure courante
- Scraping du site web Bithumb (uniquement API notices)
