import * as client from './notion_client.js';
import { readFile } from 'fs/promises';

// Log with timestamp
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [PROJECT_PAGE] ${message}`);
}

// Load configuration
async function loadConfig() {
  const config = JSON.parse(await readFile('./CA_V2_CONFIG.json', 'utf-8'));
  return config;
}

/**
 * Find a project page by project name
 * @param {string} projectName - Name of the project (e.g., "ClickUp", "HubSpot")
 * @returns {Promise<string|null>} - Page ID or null if not found
 */
export async function findProjectPage(projectName) {
  try {
    const config = await loadConfig();
    const projectsDbId = config.databases.projects.id;

    // Query for project with matching name
    const response = await client.queryDatabase(projectsDbId, {
      property: 'Name',
      title: {
        equals: projectName
      }
    });

    if (response.results.length === 0) {
      log(`Project page not found for: ${projectName}`, 'WARN');
      return null;
    }

    const pageId = response.results[0].id;
    log(`Found project page for ${projectName}: ${pageId}`);
    return pageId;

  } catch (error) {
    log(`Error finding project page: ${error.message}`, 'ERROR');
    return null;
  }
}

/**
 * Format an entry - just clean content, no metadata
 * @param {string} content - The content to add
 * @param {string} meetingTitle - Title of the source meeting (unused, kept for API compatibility)
 * @param {string} meetingId - ID of the source meeting (unused, kept for API compatibility)
 * @returns {string} - Formatted entry (no leading dash needed - will be real bullets)
 */
export function formatEntry(content, meetingTitle, meetingId) {
  // Simple and clean - just the content (dash added by bullet list formatting)
  return content;
}

/**
 * Append content to a specific section in a project page with fallback
 * @param {string} pageId - Project page ID
 * @param {string} sectionHeading - Heading to find (e.g., "🔑 Credentials & Access")
 * @param {string} content - Content to append
 * @param {string} fallbackSection - Section to use if primary not found (default: "💡 Project Context & Decisions")
 * @param {number} retryCount - Current retry attempt (internal use)
 * @returns {Promise<boolean>} - True if successful
 */
export async function appendToSection(pageId, sectionHeading, content, fallbackSection = '💡 Project Context & Decisions', retryCount = 0) {
  try {
    log(`Appending to section "${sectionHeading}" in page ${pageId}`);
    log(`Content length: ${content.length} chars`);
    log(`Content preview: ${content.substring(0, 100)}...`);

    // Get ONLY top-level blocks (no recursion) - much faster!
    const startTime = Date.now();
    const blocks = await client.getTopLevelBlocks(pageId);
    const fetchTime = Date.now() - startTime;
    log(`Fetched ${blocks.length} top-level blocks in ${fetchTime}ms`);
    
    // Find the section heading (top-level only)
    let sectionBlock = null;

    for (const block of blocks) {
      if (block.type.includes('heading')) {
        const text = block[block.type].rich_text
          .map(t => t.plain_text)
          .join('')
          .trim();
        
        if (text === sectionHeading || text.includes(sectionHeading.split(' ').slice(1).join(' '))) {
          sectionBlock = block;
          log(`Found section heading, block ID: ${block.id}`);
          break;
        }
      }
    }

    if (!sectionBlock) {
      // Try fallback section if primary not found
      if (fallbackSection && sectionHeading !== fallbackSection) {
        log(`Section "${sectionHeading}" not found, trying fallback: "${fallbackSection}"`, 'WARN');
        return await appendToSection(pageId, fallbackSection, content, null, retryCount); // No further fallback
      }
      
      log(`Section "${sectionHeading}" not found in page`, 'ERROR');
      const availableHeadings = blocks
        .filter(b => b.type.includes('heading'))
        .map(b => b[b.type].rich_text.map(t => t.plain_text).join(''))
        .join(', ');
      log(`Available headings: ${availableHeadings}`);
      return false;
    }

    // Parse content into individual list items (split by newlines)
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    // Create bulleted list items (actual Notion bullets, not text)
    const bulletBlocks = lines.map(line => {
      // Remove leading dash if present (we'll use real bullets)
      const cleanLine = line.trim().replace(/^-\s*/, '');
      
      return {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            {
              type: 'text',
              text: { content: cleanLine }
            }
          ]
        }
      };
    });
    
    // Append actual bulleted list items directly to the page, after the section heading
    log(`Attempting to append ${bulletBlocks.length} bulleted list item(s) after block ${sectionBlock.id}...`);
    const appendStart = Date.now();
    
    await client.notion.blocks.children.append({
      block_id: pageId,
      children: bulletBlocks,
      after: sectionBlock.id
    });
    
    const appendTime = Date.now() - appendStart;
    log(`Append completed in ${appendTime}ms`);
    log(`Successfully appended ${bulletBlocks.length} bulleted items to "${sectionHeading}"`);
    return true;

  } catch (error) {
    // Retry logic for timeouts or rate limits
    if ((error.code === 'notionhq_client_request_timeout' || error.status === 429) && retryCount < 2) {
      const waitTime = (retryCount + 1) * 3000; // 3s, 6s
      log(`Operation failed (${error.message}), retrying in ${waitTime/1000}s... (attempt ${retryCount + 1}/2)`, 'WARN');
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return appendToSection(pageId, sectionHeading, content, fallbackSection, retryCount + 1);
    }
    
    log(`Error appending to section: ${error.message}`, 'ERROR');
    console.error(error.stack);
    return false;
  }
}

/**
 * Update project page with categorized information
 * @param {string} projectName - Name of the project
 * @param {Object} categorized - Categorized data from OpenAI
 * @param {string} meetingTitle - Title of source meeting
 * @param {string} meetingId - ID of source meeting
 * @returns {Promise<boolean>} - True if successful
 */
export async function updateProjectPage(projectName, categorized, meetingTitle, meetingId) {
  try {
    log(`Updating project page for: ${projectName}`);

    // Find the project page
    const pageId = await findProjectPage(projectName);
    
    if (!pageId) {
      log(`Cannot update - project page not found for: ${projectName}`, 'ERROR');
      return false;
    }

    let successCount = 0;
    let totalItems = 0;

    // Add credentials
    if (categorized.credentials && categorized.credentials.length > 0) {
      log(`Adding ${categorized.credentials.length} credential(s)`);
      for (const cred of categorized.credentials) {
        totalItems++;
        const formatted = formatEntry(cred, meetingTitle, meetingId);
        const success = await appendToSection(pageId, '🔑 Credentials & Access', formatted);
        if (success) successCount++;
      }
    }

    // Add contacts
    if (categorized.contacts && categorized.contacts.length > 0) {
      log(`Adding ${categorized.contacts.length} contact(s)`);
      for (const contact of categorized.contacts) {
        totalItems++;
        const formatted = formatEntry(contact, meetingTitle, meetingId);
        const success = await appendToSection(pageId, '👥 Key Contacts', formatted);
        if (success) successCount++;
      }
    }

    // Add links
    if (categorized.links && categorized.links.length > 0) {
      log(`Adding ${categorized.links.length} link(s)`);
      for (const link of categorized.links) {
        totalItems++;
        const formatted = formatEntry(link, meetingTitle, meetingId);
        const success = await appendToSection(pageId, '🔗 Important Links', formatted);
        if (success) successCount++;
      }
    }

    // Add decisions (to chronological log)
    if (categorized.decisions && categorized.decisions.length > 0) {
      log(`Adding ${categorized.decisions.length} decision(s)`);
      // Simple and clean - just the decisions (will be real bullets)
      const decisionBlock = categorized.decisions.join('\n');
      
      totalItems++;
      const success = await appendToSection(pageId, '💡 Project Context & Decisions', decisionBlock);
      if (success) successCount++;
    }

    // Add other items if any
    if (categorized.other && categorized.other.length > 0) {
      log(`Adding ${categorized.other.length} uncategorized item(s) to decisions log`);
      // Simple and clean - just the items (will be real bullets)
      const otherBlock = categorized.other.join('\n');
      
      totalItems++;
      const success = await appendToSection(pageId, '💡 Project Context & Decisions', otherBlock);
      if (success) successCount++;
    }

    log(`Update complete: ${successCount}/${totalItems} items added successfully`);
    return successCount > 0;

  } catch (error) {
    log(`Error updating project page: ${error.message}`, 'ERROR');
    console.error(error.stack);
    return false;
  }
}

// CLI test if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'find') {
    const projectName = process.argv[3];
    if (!projectName) {
      console.log('Usage: node service/project_page_updater.js find <project_name>');
      console.log('Example: node service/project_page_updater.js find ClickUp');
      process.exit(1);
    }

    const pageId = await findProjectPage(projectName);
    if (pageId) {
      console.log(`\nFound project page: ${pageId}`);
      console.log(`URL: https://www.notion.so/${pageId.replace(/-/g, '')}`);
    } else {
      console.log(`\nProject page not found for: ${projectName}`);
    }

  } else if (command === 'test') {
    // Test update with sample data
    const projectName = process.argv[3] || 'ClickUp';
    
    const testData = {
      credentials: ['Test API Key: abc-123-test'],
      contacts: ['Test Contact: John Doe (john@example.com, developer)'],
      links: ['Test Link: https://example.com/docs'],
      decisions: ['Test Decision: This is a test entry'],
      other: []
    };

    console.log(`\nTesting update for project: ${projectName}\n`);
    const success = await updateProjectPage(
      projectName,
      testData,
      'Test Meeting',
      '00000000-0000-0000-0000-000000000000'
    );

    if (success) {
      console.log('\n✅ Test update successful!');
    } else {
      console.log('\n❌ Test update failed.');
    }

  } else {
    console.log('Usage:');
    console.log('  node service/project_page_updater.js find <project_name>   - Find a project page');
    console.log('  node service/project_page_updater.js test [project_name]   - Test update (default: ClickUp)');
  }
}

