const stopWords = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'arent', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could', 'couldnt',
  'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during',
  'each', 'few', 'for', 'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have',
  'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here', 'heres', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im',
  'ive', 'if', 'in', 'into', 'is', 'isnt', 'it', 'its', 'itself', 'lets', 'me',
  'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off',
  'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out',
  'over', 'own', 'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should',
  'shouldnt', 'so', 'some', 'such', 'than', 'that', 'thats', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'theres', 'these', 'they',
  'theyd', 'theyll', 'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed', 'well', 'were',
  'weve', 'werent', 'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which',
  'while', 'who', 'whos', 'whom', 'why', 'whys', 'with', 'wont', 'would',
  'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve', 'your', 'yours', 'yourself',
  'yourselves', 'lost', 'found', 'looking', 'searching', 'item', 'belonging', 'missing'
]);

/**
 * Tokenize and normalize text into set of clean keywords
 */
function extractKeywords(text) {
  if (!text) return new Set();
  
  // Lowercase, remove punctuation, split by space
  const words = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
    .split(/\s+/);
    
  const keywords = new Set();
  for (const word of words) {
    if (word && word.length > 1 && !stopWords.has(word)) {
      keywords.add(word);
    }
  }
  return keywords;
}

/**
 * Calculate Jaccard similarity coefficient between two sets
 */
function calculateJaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  
  let intersectionSize = 0;
  for (const elem of setA) {
    if (setB.has(elem)) {
      intersectionSize++;
    }
  }
  
  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}

/**
 * Calculate geospatial distance in kilometers between two coords using Haversine formula
 */
function getGeoDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Compute the matching score between two items.
 * Returns a score between 0.0 and 1.0
 */
function computeMatchScore(itemA, itemB) {
  // 1. Category check. Items MUST belong to same category or be general category.
  // If they don't match, heavily discount the match unless one of them is "Other"
  let categoryScore = 0.5;
  if (itemA.category === itemB.category) {
    categoryScore = 1.0;
  } else if (itemA.category !== 'Other' && itemB.category !== 'Other') {
    return 0.0; // Hard fail on mismatching core categories
  }

  // 2. Keyword similarity in Title
  const titleKeywordsA = extractKeywords(itemA.title);
  const titleKeywordsB = extractKeywords(itemB.title);
  const titleSim = calculateJaccardSimilarity(titleKeywordsA, titleKeywordsB);

  // 3. Keyword similarity in Description
  const descKeywordsA = extractKeywords(itemA.description);
  const descKeywordsB = extractKeywords(itemB.description);
  const descSim = calculateJaccardSimilarity(descKeywordsA, descKeywordsB);

  // Text score (Title gets 65% weight, Description gets 35%)
  const textScore = (titleSim * 0.65) + (descSim * 0.35);

  // 4. Date Proximity (Closer is better, max out at 30 days)
  const dateA = new Date(itemA.date);
  const dateB = new Date(itemB.date);
  const diffDays = Math.abs(dateA - dateB) / (1000 * 60 * 60 * 24);
  let dateScore = 1.0;
  if (diffDays > 0) {
    dateScore = Math.max(0.2, 1.0 - (diffDays / 30)); // drops to 0.2 at 30 days or more
  }

  // 5. GPS distance factor (if both have GPS points)
  let geoScore = 1.0;
  if (itemA.latitude && itemA.longitude && itemB.latitude && itemB.longitude) {
    const distanceKm = getGeoDistance(itemA.latitude, itemA.longitude, itemB.latitude, itemB.longitude);
    if (distanceKm !== null) {
      // 0 to 500 meters is full match, dropping off to 0.2 at 3km
      geoScore = Math.max(0.1, 1.0 - (distanceKm / 3.0));
    }
  }

  // Compute weighted final score
  // If text similarity is extremely low (< 0.05), return 0 to prevent spamming matches
  if (titleSim === 0 && titleKeywordsA.size > 0 && titleKeywordsB.size > 0) {
    return 0;
  }

  // Final Score: 50% Text, 20% Category, 15% Date, 15% Geo
  const finalScore = (textScore * 0.5) + (categoryScore * 0.2) + (dateScore * 0.15) + (geoScore * 0.15);
  
  return parseFloat(finalScore.toFixed(3));
}

/**
 * Finds all potential matches for a given item among items of the opposite type.
 */
function findMatches(targetItem, allItems) {
  const targetType = targetItem.type; // 'lost' or 'found'
  const matchType = targetType === 'lost' ? 'found' : 'lost';
  
  const suggestions = [];
  
  for (const item of allItems) {
    const itemUserStr = item.userId?._id?.toString() || item.userId?.toString() || '';
    const targetUserStr = targetItem.userId?._id?.toString() || targetItem.userId?.toString() || '';

    // Only match against items of the opposite type, that are still open, and not posted by the same user
    if (
      item.type === matchType && 
      item.status === 'open' && 
      item._id.toString() !== targetItem._id.toString() &&
      itemUserStr !== targetUserStr
    ) {
      const score = computeMatchScore(targetItem, item);
      if (score >= 0.15) { // Threshold for potential match suggestion
        suggestions.push({
          item,
          score
        });
      }
    }
  }
  
  // Sort descending by score
  return suggestions.sort((a, b) => b.score - a.score);
}

module.exports = {
  extractKeywords,
  computeMatchScore,
  findMatches
};
