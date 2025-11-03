import crypto from 'crypto';

// Extract to-do blocks from a page
export function extractTodos(blocks) {
  const todos = [];
  
  for (const block of blocks) {
    if (block.type === 'to_do' && block.to_do) {
      const text = block.to_do.rich_text
        .map(t => t.plain_text)
        .join('')
        .trim();
      
      if (text) {
        todos.push({
          text,
          checked: block.to_do.checked || false,
          blockId: block.id
        });
      }
    }
  }
  
  return todos;
}

// Generate Line Key for idempotency
export function generateLineKey(meetingId, todoText) {
  const normalized = todoText.trim().toLowerCase();
  const content = `${meetingId}:${normalized}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Extract meeting title from page properties
export function getMeetingTitle(page) {
  if (page.properties.Title?.title) {
    return page.properties.Title.title
      .map(t => t.plain_text)
      .join('')
      .trim();
  }
  
  if (page.properties.Name?.title) {
    return page.properties.Name.title
      .map(t => t.plain_text)
      .join('')
      .trim();
  }
  
  return '[Untitled Meeting]';
}

// Extract project from page properties
export function getProjectFromPage(page) {
  if (page.properties.Project?.select) {
    return page.properties.Project.select.name;
  }
  return null;
}

// Check if meeting should be processed
export function shouldProcessMeeting(page) {
  const processed = page.properties.Processed?.checkbox || false;
  const lastProcessed = page.properties['Last Processed']?.date?.start;
  const lastEdited = new Date(page.last_edited_time);
  
  // Case 1: Never processed
  if (!processed) {
    return true;
  }
  
  // Case 2: Processed but edited after last processing
  if (lastProcessed) {
    const lastProcessedDate = new Date(lastProcessed);
    if (lastEdited > lastProcessedDate) {
      return true;
    }
  }
  
  // Already processed and no changes since
  return false;
}


