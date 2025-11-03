import * as client from './notion_client.js';
import * as openai from './openai_client.js';

// Log with timestamp
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [QUICK_TODO] ${message}`);
}

/**
 * Extract text content from a task page
 * @param {string} pageId - Task page ID
 * @returns {Promise<string>} - Concatenated text content
 */
async function extractPageContent(pageId) {
  try {
    const blocks = await client.getAllBlocksRecursive(pageId);
    
    let content = '';
    for (const block of blocks) {
      if (block.type === 'paragraph' && block.paragraph?.rich_text) {
        const text = block.paragraph.rich_text
          .map(t => t.plain_text)
          .join('')
          .trim();
        if (text) {
          content += text + ' ';
        }
      }
      
      // Also check heading blocks
      if (block.type.includes('heading') && block[block.type]?.rich_text) {
        const text = block[block.type].rich_text
          .map(t => t.plain_text)
          .join('')
          .trim();
        if (text) {
          content += text + ' ';
        }
      }
    }
    
    return content.trim();
  } catch (error) {
    log(`Error extracting page content: ${error.message}`, 'ERROR');
    return '';
  }
}

/**
 * Check if a task is a quick todo that needs processing
 * @param {Object} page - Task page object
 * @returns {boolean} - True if it's a quick todo needing AI processing
 */
export function isQuickTodo(page) {
  const title = page.properties.Title?.title || [];
  const titleText = title.map(t => t.plain_text).join('').trim();
  
  const project = page.properties.Project?.select;
  const priority = page.properties.Priority?.select;
  const status = page.properties.Status?.select;
  
  // It's a quick todo if:
  // 1. Title is empty or very short (< 5 chars) OR looks like default "Untitled"
  // 2. AND (Project is empty OR Priority is empty)
  // 3. AND Status is Backlog (default for new tasks)
  
  const hasMinimalTitle = !titleText || titleText.length < 5 || titleText.toLowerCase().includes('untitled');
  const hasMissingFields = !project || !priority;
  const isNewTask = !status || status.name === 'Backlog';
  
  return hasMinimalTitle && hasMissingFields && isNewTask;
}

/**
 * Process a quick todo with AI
 * @param {Object} page - Task page object
 * @returns {Promise<Object|null>} - Updated properties or null
 */
export async function processQuickTodo(page) {
  try {
    const pageId = page.id;
    log(`Processing quick todo: ${pageId}`);
    
    // Extract content from page body
    const content = await extractPageContent(pageId);
    
    if (!content || content.length < 3) {
      log('No content found in page body, skipping', 'WARN');
      return null;
    }
    
    log(`Extracted content: "${content.substring(0, 100)}..."`);
    
    // Send to GPT-5 Nano for parsing
    log('Sending to GPT-5 Nano for parsing...');
    const parsed = await openai.parseQuickTodo(content);
    
    log(`Parsed result: Title="${parsed.title}", Project=${parsed.project}, Priority=${parsed.priority}, Due=${parsed.due}`);
    
    // Build update properties (only update if currently empty)
    const updates = {};
    
    // Always update title if it's minimal/empty
    const currentTitle = page.properties.Title?.title || [];
    const currentTitleText = currentTitle.map(t => t.plain_text).join('').trim();
    
    if (!currentTitleText || currentTitleText.length < 5 || currentTitleText.toLowerCase().includes('untitled')) {
      updates['Title'] = {
        title: [{ text: { content: parsed.title } }]
      };
    }
    
    // Update Project only if empty
    if (!page.properties.Project?.select && parsed.project) {
      updates['Project'] = {
        select: { name: parsed.project }
      };
    }
    
    // Update Priority only if empty
    if (!page.properties.Priority?.select) {
      updates['Priority'] = {
        select: { name: parsed.priority }
      };
    }
    
    // Update Due only if empty
    if (!page.properties.Due?.date && parsed.due) {
      updates['Due'] = {
        date: { start: parsed.due }
      };
    }
    
    // Update page with parsed properties
    if (Object.keys(updates).length > 0) {
      await client.updatePage(pageId, updates);
      log(`Successfully updated ${Object.keys(updates).length} properties`);
      return updates;
    } else {
      log('No properties to update (all manually filled)', 'INFO');
      return null;
    }
    
  } catch (error) {
    log(`Error processing quick todo: ${error.message}`, 'ERROR');
    console.error(error.stack);
    return null;
  }
}

// CLI test if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const taskPageId = process.argv[2];

  if (!taskPageId) {
    console.log('Usage: node service/quick_todo_processor.js <task_page_id>');
    console.log('Example: node service/quick_todo_processor.js 2967a873-fa31-8151-b5d1-ed6b944fcfff');
    process.exit(1);
  }

  console.log(`Testing quick todo processing for task: ${taskPageId}\n`);

  // Fetch the page first
  const page = await client.notion.pages.retrieve({ page_id: taskPageId });
  
  console.log('Current page state:');
  console.log(`  Title: ${page.properties.Title?.title?.map(t => t.plain_text).join('') || '(empty)'}`);
  console.log(`  Project: ${page.properties.Project?.select?.name || '(empty)'}`);
  console.log(`  Priority: ${page.properties.Priority?.select?.name || '(empty)'}`);
  console.log(`  Due: ${page.properties.Due?.date?.start || '(empty)'}`);
  console.log();

  const result = await processQuickTodo(page);

  if (result) {
    console.log('\n✅ Quick todo processed successfully!');
    console.log('Updated properties:', Object.keys(result).join(', '));
  } else {
    console.log('\n❌ Quick todo processing failed or no updates needed.');
  }
}


