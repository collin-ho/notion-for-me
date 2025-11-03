import * as client from './notion_client.js';
import * as openai from './openai_client.js';

// Log with timestamp
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [PROJECT_INFO] ${message}`);
}

/**
 * Find "Project Information" section in meeting page blocks
 * @param {Array} blocks - All blocks from meeting page
 * @returns {Object|null} - { startIndex, endIndex, heading } or null if not found
 */
export function findProjectInfoSection(blocks) {
  let projectInfoIndex = -1;
  let nextHeadingIndex = -1;

  // Look for "Project Information" heading (case insensitive)
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    
    // Check heading blocks
    if (block.type.includes('heading')) {
      const text = block[block.type].rich_text
        .map(t => t.plain_text)
        .join('')
        .toLowerCase()
        .trim();
      
      if (text.includes('project information') || text.includes('project info')) {
        projectInfoIndex = i;
        continue;
      }
      
      // If we found project info section, this is the next heading
      if (projectInfoIndex !== -1) {
        nextHeadingIndex = i;
        break;
      }
    }
  }

  if (projectInfoIndex === -1) {
    return null;
  }

  // If no next heading found, go to end of blocks
  if (nextHeadingIndex === -1) {
    nextHeadingIndex = blocks.length;
  }

  return {
    startIndex: projectInfoIndex,
    endIndex: nextHeadingIndex,
    heading: blocks[projectInfoIndex],
  };
}

/**
 * Extract bullet points from a section
 * @param {Array} blocks - All blocks from page
 * @param {number} startIndex - Start of section
 * @param {number} endIndex - End of section
 * @returns {Array<string>} - Array of bullet text
 */
export function extractInfoBullets(blocks, startIndex, endIndex) {
  const bullets = [];

  for (let i = startIndex + 1; i < endIndex; i++) {
    const block = blocks[i];

    // Extract from bulleted_list_item
    if (block.type === 'bulleted_list_item' && block.bulleted_list_item) {
      const text = block.bulleted_list_item.rich_text
        .map(t => t.plain_text)
        .join('')
        .trim();
      
      if (text) {
        bullets.push(text);
      }
    }

    // Also extract from numbered_list_item
    if (block.type === 'numbered_list_item' && block.numbered_list_item) {
      const text = block.numbered_list_item.rich_text
        .map(t => t.plain_text)
        .join('')
        .trim();
      
      if (text) {
        bullets.push(text);
      }
    }

    // Extract from paragraph (in case user just typed lines)
    if (block.type === 'paragraph' && block.paragraph) {
      const text = block.paragraph.rich_text
        .map(t => t.plain_text)
        .join('')
        .trim();
      
      // Only include if it starts with - or • or has meaningful content
      if (text && (text.startsWith('-') || text.startsWith('•') || text.length > 10)) {
        // Remove leading - or •
        const cleaned = text.replace(/^[-•]\s*/, '').trim();
        if (cleaned) {
          bullets.push(cleaned);
        }
      }
    }
  }

  return bullets;
}

/**
 * Extract and categorize project information from a meeting page
 * @param {string} meetingPageId - Notion page ID
 * @returns {Promise<Object|null>} - Categorized data or null if no project info found
 */
export async function extractAndCategorize(meetingPageId) {
  try {
    log(`Extracting project info from meeting: ${meetingPageId}`);

    // Get all blocks from meeting page
    const blocks = await client.getAllBlocksRecursive(meetingPageId);
    log(`Retrieved ${blocks.length} blocks from meeting`);

    // Find project information section
    const section = findProjectInfoSection(blocks);
    
    if (!section) {
      log('No "Project Information" section found');
      return null;
    }

    log(`Found "Project Information" section at index ${section.startIndex}`);

    // Extract bullets from that section
    const bullets = extractInfoBullets(blocks, section.startIndex, section.endIndex);
    
    if (bullets.length === 0) {
      log('Project Information section is empty');
      return null;
    }

    log(`Extracted ${bullets.length} bullet points`);
    bullets.forEach((b, i) => log(`  ${i + 1}. ${b.substring(0, 60)}...`));

    // Send to OpenAI for categorization
    log('Sending to OpenAI for categorization...');
    const categorized = await openai.categorizeProjectInfo(bullets);
    
    // Log results
    log('Categorization complete:');
    log(`  Credentials: ${categorized.credentials.length}`);
    log(`  Contacts: ${categorized.contacts.length}`);
    log(`  Links: ${categorized.links.length}`);
    log(`  Decisions: ${categorized.decisions.length}`);
    log(`  Other: ${categorized.other.length}`);

    return categorized;

  } catch (error) {
    log(`Error extracting project info: ${error.message}`, 'ERROR');
    console.error(error.stack);
    return null;
  }
}

/**
 * Check if a meeting has project information to extract
 * @param {string} meetingPageId - Notion page ID
 * @returns {Promise<boolean>} - True if project info section exists
 */
export async function hasProjectInfo(meetingPageId) {
  try {
    const blocks = await client.getAllBlocksRecursive(meetingPageId);
    const section = findProjectInfoSection(blocks);
    
    if (!section) {
      return false;
    }

    const bullets = extractInfoBullets(blocks, section.startIndex, section.endIndex);
    return bullets.length > 0;

  } catch (error) {
    log(`Error checking for project info: ${error.message}`, 'ERROR');
    return false;
  }
}

// CLI test if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const meetingPageId = process.argv[2];

  if (!meetingPageId) {
    console.log('Usage: node service/project_info_extractor.js <meeting_page_id>');
    console.log('Example: node service/project_info_extractor.js 2967a873-fa31-8136-8299-d13b5bd279b7');
    process.exit(1);
  }

  console.log(`Testing project info extraction for meeting: ${meetingPageId}\n`);

  const result = await extractAndCategorize(meetingPageId);

  if (result) {
    console.log('\n=== CATEGORIZED PROJECT INFORMATION ===\n');
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\nNo project information found in this meeting.');
  }
}

