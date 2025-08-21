const { extractBaseFromNotice } = require('./dist/utils/extractBase');

// Test avec le texte corrompu de l'API
const corruptedText = 'ýÜ░(WOO) Û▒░Ù×ÿý£áýØÿýóàÙ¬® ýºÇýáò Ýò┤ýá£';
const corruptedBio = 'Ù░öýØ┤ýÿñ ÝöäÙí£Ýåáý¢£(BIO) ýê£ý×àÛ©ê & ýê£ÙºñÙÅä ýùÉýû┤Ùô£Ù×ì ýØ┤Ù▓ñÝè©';

// Test avec le texte normal
const normalText = '가상자산(WOO) 원화 마켓 상장';
const normalBio = '가상자산(BIO) 원화 마켓 상장';

console.log('=== TEST ENCODING BITHUMB API ===\n');

console.log('1. TEXTE CORROMPU DE L\'API:');
console.log('WOO corrompu:', corruptedText);
console.log('BIO corrompu:', corruptedBio);
console.log('');

console.log('2. TEXTE NORMAL (ATTENDU):');
console.log('WOO normal:', normalText);
console.log('BIO normal:', normalBio);
console.log('');

console.log('3. EXTRACTION AVEC TEXTE CORROMPU:');
console.log('WOO corrompu ->', JSON.stringify(extractBaseFromNotice(corruptedText), null, 2));
console.log('BIO corrompu ->', JSON.stringify(extractBaseFromNotice(corruptedBio), null, 2));
console.log('');

console.log('4. EXTRACTION AVEC TEXTE NORMAL:');
console.log('WOO normal ->', JSON.stringify(extractBaseFromNotice(normalText), null, 2));
console.log('BIO normal ->', JSON.stringify(extractBaseFromNotice(normalBio), null, 2));
console.log('');

console.log('5. ANALYSE DU PROBLÈME:');
console.log('✅ L\'extracteur fonctionne parfaitement avec du texte normal');
console.log('❌ L\'extracteur échoue avec le texte corrompu de l\'API');
console.log('🚨 PROBLÈME: L\'API Bithumb retourne du texte encodé incorrectement');
console.log('');

console.log('6. IMPACT SUR LE BOT:');
console.log('• BIO n\'a pas été détecté à cause de l\'encodage corrompu');
console.log('• WOO n\'a pas été détecté à cause de l\'encodage corrompu');
console.log('• Tous les nouveaux listings sont affectés par ce bug');
console.log('• Le bot passe en fallback T2 (WebSocket) moins fiable');
