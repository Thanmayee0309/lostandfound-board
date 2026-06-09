const aiEngine = require('./utils/aiEngine');

console.log('===================================================');
console.log('RUNNING LOST & FOUND BOARD AI ENGINE VERIFICATION');
console.log('===================================================\n');

// 1. Test Keyword Extraction
console.log('Test 1: Keyword Tokenization & Stop Words Removal...');
const text1 = 'I lost my premium Black leather wallet containing credit cards near library';
const keywords1 = aiEngine.extractKeywords(text1);
console.log('Text:', text1);
console.log('Extracted Keywords:', Array.from(keywords1));
console.log('---------------------------------------------------\n');

// 2. Test Similar Items (High Match)
console.log('Test 2: High Similarity Match Calculation...');
const lostItem = {
  title: 'Black leather cardholder wallet',
  description: 'Lost cardholder, black color, leather material, has my driving license and some notes.',
  category: 'Wallets & Cards',
  type: 'lost',
  date: '2026-06-05',
  latitude: 17.2185,
  longitude: 78.2736
};

const foundItem1 = {
  title: 'Found black leather card wallet',
  description: 'Found a cardholder wallet in black leather. Has cards in it. Pick up at library counter.',
  category: 'Wallets & Cards',
  type: 'found',
  date: '2026-06-06',
  latitude: 17.2188,
  longitude: 78.2738
};

const score1 = aiEngine.computeMatchScore(lostItem, foundItem1);
console.log(`Lost: "${lostItem.title}"`);
console.log(`Found: "${foundItem1.title}"`);
console.log(`Computed Match Score: ${Math.round(score1 * 100)}%`);
if (score1 >= 0.40) {
  console.log('✅ PASS: Similarity is above match threshold (High Match)');
} else {
  console.log('❌ FAIL: Expected high similarity score');
}
console.log('---------------------------------------------------\n');

// 3. Test Disparate Items (Low/Zero Match)
console.log('Test 3: Zero Similarity Mismatch Category...');
const foundItem2 = {
  title: 'Lost Blue Cotton Hoodie jacket',
  description: 'A blue colored sweatshirt with zipper, medium size.',
  category: 'Clothing & Bags',
  type: 'found',
  date: '2026-06-01',
  latitude: 17.2210,
  longitude: 78.2750
};

const score2 = aiEngine.computeMatchScore(lostItem, foundItem2);
console.log(`Lost: "${lostItem.title}"`);
console.log(`Found: "${foundItem2.title}"`);
console.log(`Computed Match Score: ${Math.round(score2 * 100)}%`);
if (score2 === 0) {
  console.log('✅ PASS: Correctly scored 0% due to category mismatch');
} else {
  console.log('❌ FAIL: Expected 0% score for mismatching category');
}
console.log('---------------------------------------------------\n');

// 4. Test List Match Recommendations
console.log('Test 4: Match Suggestions Scanning...');
const databaseItems = [
  { _id: '1', userId: 'user_a', title: 'leather keys holder', description: 'found keys in leather cover', category: 'Keys & ID Cards', type: 'found', date: '2026-06-02', status: 'open' },
  { _id: '2', userId: 'user_b', title: 'Found: Black cardholder wallet', description: 'Found card holder wallet on first floor library', category: 'Wallets & Cards', type: 'found', date: '2026-06-05', status: 'open', latitude: 17.2186, longitude: 78.2737 },
  { _id: '3', userId: 'user_c', title: 'lost laptop bag', description: 'black laptop bag containing notebook', category: 'Clothing & Bags', type: 'found', date: '2026-06-06', status: 'open' }
];

const targetItem = {
  _id: 'target',
  userId: 'user_d',
  title: 'Lost black leather wallet',
  description: 'Lost wallet with driving license',
  category: 'Wallets & Cards',
  type: 'lost',
  date: '2026-06-06',
  latitude: 17.2185,
  longitude: 78.2736
};

const matches = aiEngine.findMatches(targetItem, databaseItems);
console.log(`Scanning database for matches matching: "${targetItem.title}"`);
console.log(`Found ${matches.length} matching item(s):`);
matches.forEach((m, i) => {
  console.log(`${i+1}. "${m.item.title}" - Score: ${Math.round(m.score * 100)}% (ID: ${m.item._id})`);
});

if (matches.length > 0 && matches[0].item._id === '2') {
  console.log('✅ PASS: Successfully matched and ranked the black cardholder first.');
} else {
  console.log('❌ FAIL: Matching ranking mismatch');
}
console.log('\n===================================================');
console.log('VERIFICATION COMPLETED SUCCESSFULLY!');
console.log('===================================================');
