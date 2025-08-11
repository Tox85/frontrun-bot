@echo off
echo 🚂 Simulation de l'environnement Railway en local...
echo.

REM Configuration des variables d'environnement
set NODE_ENV=production
set RAILWAY_ENVIRONMENT=production
set PORT=8080

REM Hyperliquid
set HL_ENABLED=1
set HL_TESTNET=1
set HYPERLIQUID_WALLET_ADDRESS=0x1234567890123456789012345678901234567890
set HYPERLIQUID_PRIVATE_KEY=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

REM Exchanges
set UPBIT_ENABLED=1
set BITHUMB_ENABLED=1
set BINANCE_ENABLED=0
set BYBIT_ENABLED=0

REM Telegram (désactivé pour les tests)
set TELEGRAM_ENABLED=0
set TELEGRAM_BOT_TOKEN=
set TELEGRAM_CHAT_ID=

REM Trading
set TRADE_AMOUNT_USDT=400
set LEVERAGE=20
set STOP_LOSS_PERCENT=5
set POSITION_SIZE_USDC=400

REM Risk Management
set RISK_PER_TRADE_USDC_DEFAULT=0.5
set RISK_PCT_OF_BAL=0.04
set MAX_LEVERAGE_DEFAULT=25
set ORDER_TIMEOUT_MS=15000
set PERP_CHECK_TIMEOUT_MS=200
set DRY_RUN=1

REM Monitoring
set ENABLE_GLOBAL_MONITORING=0
set ENABLE_KOREAN_LOGS=1
set ENABLE_VERBOSE_LOGS=0

REM Debug
set ENVZ_ENABLED=1

REM Désactiver le chargement .env
set DOTENV_DISABLE=true

echo 🔧 Configuration Railway simulée:
echo   NODE_ENV: %NODE_ENV%
echo   RAILWAY_ENVIRONMENT: %RAILWAY_ENVIRONMENT%
echo   PORT: %PORT%
echo   HL_ENABLED: %HL_ENABLED%
echo   UPBIT_ENABLED: %UPBIT_ENABLED%
echo   BITHUMB_ENABLED: %BITHUMB_ENABLED%
echo   ENVZ_ENABLED: %ENVZ_ENABLED%
echo.

echo 🚀 Démarrage du bot en mode Railway simulé...
echo.

REM Construire le projet d'abord
echo 📦 Construction du projet...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ❌ Échec de la construction
    pause
    exit /b 1
)

echo ✅ Construction réussie
echo.

REM Démarrer le bot
echo 🤖 Démarrage du bot...
node dist/main.js

pause
