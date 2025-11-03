import * as client from './notion_client.js';
import * as openai from './openai_client.js';
import * as projectInfo from './project_info_extractor.js';
import * as projectPage from './project_page_updater.js';
import { readFile } from 'fs/promises';

// Log with timestamp
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [QUICK_TODO_V2] ${message}`);
}

/**
 * Extract content from specific section (heading-based)
 * @param {Array} blocks - All blocks from page
 * @param {string} sectionHeading - Heading to find (e.g., "📋 Task")
 * @returns {string} - Content under that heading
 */
function extractSectionContent(blocks, sectionHeading) {
  let sectionIndex = -1;
  let nextHeadingIndex = -1;

  // Find the section heading
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    
    if (block.type.includes('heading')) {
      const text = block[block.type].rich_text
        .map(t => t.plain_text)
        .join('')
        .trim();
      
      if (text.includes(sectionHeading) || text.includes(sectionHeading.replace(/[📋📌]/g, '').trim())) {
        sectionIndex = i;
        continue;
      }
      
      if (sectionIndex !== -1) {
        nextHeadingIndex = i;
        break;
      }
    }
  }

  if (sectionIndex === -1) {
    return '';
  }

  // Extract content between headings
  const endIndex = nextHeadingIndex === -1 ? blocks.length : nextHeadingIndex;
  let content = '';

  for (let i = sectionIndex + 1; i < endIndex; i++) {
    const block = blocks[i];
    
    // Skip dividers
    if (block.type === 'divider') {
      continue;
    }
    
    if (block.type === 'paragraph' && block.paragraph?.rich_text) {
      const text = block.paragraph.rich_text
        .map(t => t.plain_text)
        .join('')
        .trim();
      if (text) {
        content += text + '\n';
      }
    }
    
    if (block.type.includes('heading') && block[block.type]?.rich_text) {
      const text = block[block.type].rich_text
        .map(t => t.plain_text)
        .join('')
        .trim();
      if (text) {
        content += text + '\n';
      }
    }
    
    // Also capture bulleted lists
    if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
      const text = block.bulleted_list_item.rich_text
        .map(t => t.plain_text)
        .join('')
        .trim();
      if (text) {
        content += '- ' + text + '\n';
      }
    }
  }

  return content.trim();
}

/**
 * Delete a section from a page (heading + content until next heading)
 * @param {string} pageId - Page ID
 * @param {string} sectionHeading - Heading to delete
 * @returns {Promise<boolean>} - True if successful
 */
async function deleteSection(pageId, sectionHeading) {
  try {
    const blocks = await client.getAllBlocksRecursive(pageId);
    
    let sectionIndex = -1;
    let nextHeadingIndex = -1;

    // Find the section heading
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      
      if (block.type.includes('heading')) {
        const text = block[block.type].rich_text
          .map(t => t.plain_text)
          .join('')
          .trim();
        
        if (text.includes(sectionHeading) || text.includes(sectionHeading.replace(/[📋📌]/g, '').trim())) {
          sectionIndex = i;
          continue;
        }
        
        if (sectionIndex !== -1) {
          nextHeadingIndex = i;
          break;
        }
      }
    }

    if (sectionIndex === -1) {
      log(`Section "${sectionHeading}" not found for deletion`);
      return true; // Already gone, that's fine
    }

    // Delete all blocks from section heading to next heading (or end)
    const endIndex = nextHeadingIndex === -1 ? blocks.length : nextHeadingIndex;
    
    for (let i = sectionIndex; i < endIndex; i++) {
      const block = blocks[i];
      try {
        await client.notion.blocks.delete({ block_id: block.id });
      } catch (error) {
        log(`Could not delete block ${block.id}: ${error.message}`, 'WARN');
      }
    }

    log(`Deleted section "${sectionHeading}"`);
    return true;

  } catch (error) {
    log(`Error deleting section: ${error.message}`, 'ERROR');
    return false;
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
  // 3. AND Status is Backlog or empty (default for new tasks)
  
  const hasMinimalTitle = !titleText || titleText.length < 5 || titleText.toLowerCase().includes('untitled');
  const hasMissingFields = !project || !priority;
  const isNewTask = !status || status.name === 'Backlog';
  
  return hasMinimalTitle && hasMissingFields && isNewTask;
}

/**
 * Process a quick todo with AI (v2 with Project Info section)
 * @param {Object} page - Task page object
 * @returns {Promise<Object|null>} - Result with success info
 */
export async function processQuickTodo(page) {
  try {
    const pageId = page.id;
    log(`Processing quick todo v2: ${pageId}`);
    
    // Get all blocks
    const blocks = await client.getAllBlocksRecursive(pageId);
    
    // Extract both sections
    const taskContent = extractSectionContent(blocks, '📋 Task');
    const projectInfoContent = extractSectionContent(blocks, '📌 Project Info');
    
    log(`Task section: ${taskContent ? taskContent.substring(0, 50) + '...' : '(empty)'}`);
    log(`Project Info section: ${projectInfoContent ? projectInfoContent.substring(0, 50) + '...' : '(empty)'}`);
    
    if (!taskContent && !projectInfoContent) {
      log('Both sections empty, skipping', 'WARN');
      return null;
    }
    
    let taskSuccess = false;
    let projectInfoSuccess = false;
    
    // ========================================
    // STEP 1: Process Task Section (if filled)
    // ========================================
    if (taskContent && taskContent.length > 3) {
      log('Processing Task section...');
      
      try {
        const parsed = await openai.parseQuickTodo(taskContent);
        const tasks = parsed.tasks || [];
        
        log(`Parsed ${tasks.length} task(s)`);
        
        if (tasks.length === 0) {
          log('No tasks parsed', 'WARN');
          return null;
        }
        
        // First task updates the current page
        const firstTask = tasks[0];
        log(`Task 1: Title="${firstTask.title}", Project=${firstTask.project}, Priority=${firstTask.priority}, Due=${firstTask.due}`);
        
        const updates = {};
        
        const currentTitle = page.properties.Title?.title || [];
        const currentTitleText = currentTitle.map(t => t.plain_text).join('').trim();
        
        if (!currentTitleText || currentTitleText.length < 5 || currentTitleText.toLowerCase().includes('untitled')) {
          updates['Title'] = {
            title: [{ text: { content: firstTask.title } }]
          };
        }
        
        if (!page.properties.Project?.select && firstTask.project) {
          updates['Project'] = {
            select: { name: firstTask.project }
          };
        }
        
        if (!page.properties.Priority?.select) {
          updates['Priority'] = {
            select: { name: firstTask.priority }
          };
        }
        
        if (!page.properties.Due?.date && firstTask.due) {
          updates['Due'] = {
            date: { start: firstTask.due }
          };
        }
        
        // Always set Status to Backlog if empty
        if (!page.properties.Status?.select) {
          updates['Status'] = {
            select: { name: 'Backlog' }
          };
        }
        
        if (Object.keys(updates).length > 0) {
          await client.updatePage(pageId, updates);
          log(`Task 1 properties updated: ${Object.keys(updates).join(', ')}`);
        }
        
        // Create additional tasks as new pages (if multiple tasks detected)
        if (tasks.length > 1) {
          const config = JSON.parse(await readFile('./CA_V2_CONFIG.json', 'utf-8'));
          const tasksDbId = config.databases.tasks.id;
          
          for (let i = 1; i < tasks.length; i++) {
            const task = tasks[i];
            log(`Creating Task ${i + 1}: "${task.title}"`);
            
            try {
              await client.createPage(tasksDbId, {
                'Title': {
                  title: [{ text: { content: task.title } }]
                },
                'Status': {
                  select: { name: 'Backlog' }
                },
                'Priority': {
                  select: { name: task.priority }
                },
                ...(task.due && {
                  'Due': {
                    date: { start: task.due }
                  }
                }),
                ...(task.project && {
                  'Project': {
                    select: { name: task.project }
                  }
                })
              });
              
              log(`Task ${i + 1} created successfully`);
            } catch (error) {
              log(`Failed to create Task ${i + 1}: ${error.message}`, 'ERROR');
            }
          }
        }
        
        taskSuccess = true;
        
      } catch (error) {
        log(`Error processing task section: ${error.message}`, 'ERROR');
      }
    }
    
    // ========================================
    // STEP 2: Process Project Info Section (if filled)
    // ========================================
    if (projectInfoContent && projectInfoContent.length > 5) {
      log('Processing Project Info section...');
      
      try {
        // Parse into bullets (split by newlines)
        const bullets = projectInfoContent
          .split('\n')
          .map(line => line.replace(/^[-•]\s*/, '').trim())
          .filter(line => line.length > 0);
        
        if (bullets.length > 0) {
          log(`Extracted ${bullets.length} project info bullets`);
          
          // Send to OpenAI for categorization
          const categorized = await openai.categorizeProjectInfo(bullets);
          log(`Categorized: ${categorized.credentials.length} credentials, ${categorized.contacts.length} contacts, ${categorized.links.length} links, ${categorized.decisions.length} decisions`);
          
          // Detect project from content
          let detectedProject = null;
          const allContent = bullets.join(' ').toLowerCase();
          
          // Check against project keywords
          const projectKeywords = {
            'ClickUp': ['clickup', 'click up'],
            'HubSpot': ['hubspot', 'hub spot'],
            'Docebo': ['docebo'],
            'AI Sales': ['ai sales', 'retell'],
            'Insider Knowledge': ['insider', 'merlin'],
            'PD OTN': ['pd otn', 'otn'],
            'Podcast': ['podcast'],
            'Quarterly Economic Review': ['qer', 'economic'],
          };
          
          for (const [project, keywords] of Object.entries(projectKeywords)) {
            if (keywords.some(kw => allContent.includes(kw))) {
              detectedProject = project;
              break;
            }
          }
          
          if (!detectedProject) {
            log('Could not detect project from content, defaulting to Support/Other', 'WARN');
            detectedProject = 'Support/Other';
          }
          
          log(`Detected project: ${detectedProject}`);
          
          // Route to project page
          const meetingTitle = 'Quick Info Entry';
          const updated = await projectPage.updateProjectPage(
            detectedProject,
            categorized,
            meetingTitle,
            pageId
          );
          
          if (updated) {
            log('Project page updated successfully');
            projectInfoSuccess = true;
          } else {
            log('Project page update failed', 'ERROR');
          }
        }
        
      } catch (error) {
        log(`Error processing project info section: ${error.message}`, 'ERROR');
        console.error(error.stack);
      }
    }
    
    // ========================================
    // STEP 3: Cleanup (ONLY after successful processing)
    // ========================================
    if (taskSuccess || projectInfoSuccess) {
      log('Processing successful, cleaning up...');
      
      // Scenario A: Both sections filled
      if (taskContent && projectInfoContent && taskSuccess && projectInfoSuccess) {
        log('Both sections processed - deleting Project Info section, keeping page as task');
        await deleteSection(pageId, '📌 Project Info');
        return { taskCreated: true, projectInfoRouted: true, pageDeleted: false };
      }
      
      // Scenario B: Only Project Info filled
      if (!taskContent && projectInfoContent && projectInfoSuccess) {
        log('Only Project Info processed - deleting entire page (inbox entry)');
        try {
          await client.notion.pages.update({
            page_id: pageId,
            archived: true
          });
          return { taskCreated: false, projectInfoRouted: true, pageDeleted: true };
        } catch (error) {
          log(`Could not archive page: ${error.message}`, 'WARN');
          return { taskCreated: false, projectInfoRouted: true, pageDeleted: false };
        }
      }
      
      // Scenario C: Only Task filled
      if (taskContent && !projectInfoContent && taskSuccess) {
        log('Only Task processed - deleting empty Project Info section');
        await deleteSection(pageId, '📌 Project Info');
        return { taskCreated: true, projectInfoRouted: false, pageDeleted: false };
      }
      
      return { taskCreated: taskSuccess, projectInfoRouted: projectInfoSuccess, pageDeleted: false };
    }
    
    log('Processing failed, not cleaning up', 'WARN');
    return null;
    
  } catch (error) {
    log(`Error processing quick todo: ${error.message}`, 'ERROR');
    console.error(error.stack);
    return null;
  }
}

