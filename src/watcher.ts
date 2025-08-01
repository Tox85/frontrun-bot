import axios from "axios";
import fs from "fs";

const API_URL = "https://api.bithumb.com/public/ticker/ALL_KRW";
const KNOWN_TOKENS_FILE = "knownTokens.json";

// Charger les tokens connus depuis le fichier JSON
function loadKnownTokens(): string[] {
  try {
    const data = fs.readFileSync(KNOWN_TOKENS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Sauvegarder les tokens connus dans le fichier JSON
function saveKnownTokens(tokens: string[]) {
  fs.writeFileSync(
    KNOWN_TOKENS_FILE,
    JSON.stringify(tokens, null, 2),
    "utf-8"
  );
}

// Simuler une action de trading
async function simulateTrade(token: string) {
  console.log(`🚀 [TRADE] Simuler achat du token : ${token}`);
}

export async function fetchBithumbListings(): Promise<string[]> {
  console.log("🔍 Récupération des tokens via API Bithumb.");
  try {
    const response = await axios.get(API_URL);
    const data = response.data;

    if (!data || !data.data) {
      throw new Error("❌ Données API invalides");
    }

    const tokens = Object.keys(data.data).filter((t) => t !== "date");
    console.log("📈 Nombre de tokens actuels :", tokens.length);
    return tokens;
  } catch (err) {
    console.error("❌ Erreur lors du fetch API :", err);
    return [];
  }
}

// Fonction principale de surveillance
export async function checkBithumbAndTrade() {
  console.log("🔄 Vérification des nouveaux listings.");

  const currentTokens = await fetchBithumbListings();
  const knownTokens = loadKnownTokens();

  const newTokens = currentTokens.filter(
    (t) => !knownTokens.includes(t)
  );

  if (newTokens.length > 0) {
    console.log("🆕 NOUVEAUX LISTINGS :", newTokens);

    for (const token of newTokens) {
      await simulateTrade(token);
    }

    // === CORRECTION APPLIQUÉE ICI ===
    // Fusion simple et suppression des doublons
    const updatedTokens = Array.from(
      new Set([
        ...knownTokens,
        ...newTokens
      ])
    );
    saveKnownTokens(updatedTokens);
    // ===============================

  } else {
    console.log("⏳ Aucun nouveau token détecté.");
  }
}
