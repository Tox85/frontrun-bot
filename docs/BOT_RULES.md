# BOT RULES — Bithumb-only, T0+T2 MVP

## Signal
- **T0 (annonce)**: Bithumb NoticePoller HTTP (500–800 ms, ETag/If-Modified-Since, KST→UTC, parsing ko).
- **T2 (ouverture)**: Bithumb WebSocket KRW.
- Baseline KR = Bithumb REST ALL_KRW **au boot** ( aucun Detected pendant l'init ).

## Gating & Dédup
- Nouveau si BASE ∉ baseline_kr.
- eventId (notice): sha256({s:'bithumb.notice', b:BASE, u:url||'', m:markets_sorted, t:trade_time_iso||''})
- eventId (ws): sha256({s:'bithumb.ws', b:BASE, u:'', m:['KRW'], t:''})
- Jamais de timestamp courant dans l'ID.
- processed_events en DB (insert-or-ignore).

## Anti-spam
- WS: double-check REST (3–5s) sur 1ère vue d'une base inconnue.
- Debounce 10s par base; warm-up 5s après reconnect WS ; mutex par base.
- Cooldown 24h après trade.

## Perps & Trade
- PerpCatalog: refresh 10–15 min + lookup on-demand (Bybit→HL→Binance).
- HL testnet only: **target_notional = balance * RISK_PCT * LEVERAGE_TARGET** ; ouvrir long immédiatement ; exit +180s (scheduler persistant, reduce-only).
- Circuit breaker: 3 fails d'ordre consécutifs → TRADING_ENABLED=false + alerte.

## Observabilité
- /health: bithumb_krw_tokens, sanity, leader_instance_id, OBSERVER_MODE, p95 detected→order_sent, p95 order_sent→ack.
- /metrics: detected/opened/closed/errors, telegram.queue_len, **ws.reconnects**, **exit.pending**, perps_*.

## Jamais faire
- Upbit en détection ou marché-polling générant de faux listings.
- Baseline KR alimentée par Binance/Bybit/HL.
- Telegram hors TelegramService ou en parallèle.
- EventId dépendant de l'heure courante.
