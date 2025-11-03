// Project inference based on keywords
const PROJECT_KEYWORDS = {
  'ClickUp': ['clickup', 'click up', 'click-up', 'cu', 'cuarc'],
  'Docebo': ['docebo', 'lms', 'learning management', 'cogent uni', 'uni'],
  'HubSpot': ['hubspot', 'crm', 'hs', 'hub spot'],
  'AI Sales': ['ai sales', 'retell', 'retellai', 'retell ai', 'sai', 'sales ai'],
  'Insider Knowledge': ['insider', 'insider knowledge', 'ik', 'merlin'],
  'PD OTN': ['pd', 'otn', 'pd otn', 'professional development'],
  'Podcast': ['podcast', 'episode', 'recording', 'riverside'],
  'Quarterly Economic Review': ['qer', 'economic review', 'quarterly', 'eco repo'],
  'Support/Other': []  // Fallback, no keywords
};

// Check for hashtag project override in blocks (e.g., #proj:ClickUp)
export function extractHashtagProject(blocks) {
  for (const block of blocks) {
    if (block.type === 'paragraph' && block.paragraph?.rich_text) {
      const text = block.paragraph.rich_text.map(t => t.plain_text).join('');
      const match = text.match(/#proj:(\w+)/i);
      
      if (match) {
        const projectName = match[1].toLowerCase();
        
        // Try to match to known projects
        for (const [project, keywords] of Object.entries(PROJECT_KEYWORDS)) {
          if (project.toLowerCase().includes(projectName) || 
              keywords.some(kw => kw.includes(projectName))) {
            return { project, confidence: 1.0 };
          }
        }
      }
    }
  }
  
  return null;
}

// Infer project from meeting title
export function inferProject(meetingTitle, blocks = [], threshold = 0.6) {
  // First check for hashtag override
  const hashtagProject = extractHashtagProject(blocks);
  if (hashtagProject) {
    return hashtagProject;
  }
  
  const titleLower = meetingTitle.toLowerCase();
  
  // Check title against keywords
  for (const [project, keywords] of Object.entries(PROJECT_KEYWORDS)) {
    if (project === 'Support/Other') continue;
    
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        return {
          project,
          confidence: 0.8
        };
      }
    }
  }
  
  // No match found
  return {
    project: 'Support/Other',
    confidence: 0.0
  };
}

// Determine if project needs review based on confidence
export function needsReview(confidence, threshold = 0.6) {
  return confidence < threshold;
}


