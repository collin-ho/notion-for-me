// Parse due dates from natural language text
export function parseDueDate(text, timezone = 'America/New_York') {
  const textLower = text.toLowerCase();
  const now = new Date();
  
  // Helper to format date as YYYY-MM-DD
  function formatDate(date) {
    return date.toISOString().split('T')[0];
  }
  
  // Helper to get next occurrence of a weekday
  function getNextWeekday(dayName) {
    const days = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    const targetDay = days[dayName.toLowerCase()];
    const currentDay = now.getDay();
    
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    
    const result = new Date(now);
    result.setDate(now.getDate() + daysToAdd);
    return result;
  }
  
  // Explicit date formats
  // YYYY-MM-DD
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return isoMatch[0];
  }
  
  // MM/DD or MM-DD
  const shortDateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (shortDateMatch) {
    const month = shortDateMatch[1].padStart(2, '0');
    const day = shortDateMatch[2].padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
  
  // Relative dates
  if (textLower.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return formatDate(tomorrow);
  }
  
  if (textLower.includes('next week')) {
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    return formatDate(nextWeek);
  }
  
  // By Friday, by this Friday, etc.
  const weekdayMatch = textLower.match(/\b(?:by|this|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    const isNext = textLower.includes('next ' + weekdayMatch[1]);
    const targetDate = getNextWeekday(weekdayMatch[1]);
    
    if (isNext) {
      targetDate.setDate(targetDate.getDate() + 7);
    }
    
    return formatDate(targetDate);
  }
  
  // End of month
  if (textLower.includes('end of month') || textLower.includes('eom')) {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return formatDate(lastDay);
  }
  
  // End of week
  if (textLower.includes('end of week') || textLower.includes('eow')) {
    return formatDate(getNextWeekday('Friday'));
  }
  
  // No date found
  return null;
}

// Parse priority from text
export function parsePriority(text) {
  const textLower = text.toLowerCase();
  
  // High priority keywords
  const highKeywords = [
    'urgent', 'asap', 'critical', 'emergency', 'immediately',
    'high priority', 'top priority', 'blocking', 'must have',
    'important', 'crucial'
  ];
  
  // Low priority keywords
  const lowKeywords = [
    'nice to have', 'when you can', 'low priority',
    'optional', 'future', 'someday', 'backlog',
    'eventually', 'if time'
  ];
  
  // Count keyword matches
  let highCount = 0;
  let lowCount = 0;
  
  for (const keyword of highKeywords) {
    if (textLower.includes(keyword)) {
      highCount++;
    }
  }
  
  for (const keyword of lowKeywords) {
    if (textLower.includes(keyword)) {
      lowCount++;
    }
  }
  
  // Strong evidence for high priority
  if (highCount >= 2 || textLower.includes('high priority') || textLower.includes('urgent')) {
    return 'High';
  }
  
  // Evidence for low priority
  if (lowCount >= 1 || textLower.includes('low priority')) {
    return 'Low';
  }
  
  // Default
  return 'Medium';
}



