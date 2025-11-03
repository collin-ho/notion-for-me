import { readFile } from 'fs/promises';
import * as client from './notion_client.js';
import * as extractors from './extractors.js';
import * as inference from './inference.js';
import * as parsers from './parsers.js';
import * as projectInfo from './project_info_extractor.js';
import * as projectPage from './project_page_updater.js';
import * as quickTodo from './quick_todo_processor_v2.js';

// Load configuration
async function loadConfig() {
  const config = JSON.parse(await readFile('./CA_V2_CONFIG.json', 'utf-8'));
  return config;
}

// Log with timestamp
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

// Process a single meeting
async function processMeeting(meeting, tasksDbId, config) {
  const meetingTitle = extractors.getMeetingTitle(meeting);
  log(`Processing meeting: "${meetingTitle}" (${meeting.id})`);
  
  try {
    // Get all blocks from meeting page
    const blocks = await client.getAllBlocksRecursive(meeting.id);
    log(`  Found ${blocks.length} blocks`);
    
    // Extract to-dos
    const todos = extractors.extractTodos(blocks);
    log(`  Found ${todos.length} to-do items`);
    
    if (todos.length === 0) {
      // No tasks to create, but still mark as processed
      await client.updatePage(meeting.id, {
        'Processed': { checkbox: true },
        'Last Processed': { date: { start: new Date().toISOString() } }
      });
      log(`  No to-dos found, marked as processed`);
      return { created: 0, skipped: 0 };
    }
    
    // Get or infer project
    let project = extractors.getProjectFromPage(meeting);
    let needsReview = false;
    
    if (!project) {
      const inferred = inference.inferProject(meetingTitle, blocks);
      project = inferred.project;
      needsReview = inference.needsReview(inferred.confidence);
      log(`  Inferred project: ${project} (confidence: ${inferred.confidence}, needs review: ${needsReview})`);
    } else {
      log(`  Project from page: ${project}`);
    }
    
    // Create tasks
    let created = 0;
    let skipped = 0;
    
    for (const todo of todos) {
      const lineKey = extractors.generateLineKey(meeting.id, todo.text);
      
      // Check if task already exists
      const exists = await client.taskExists(tasksDbId, lineKey);
      if (exists) {
        log(`  Skipped (duplicate): ${todo.text.substring(0, 50)}...`);
        skipped++;
        continue;
      }
      
      // Parse due date and priority
      const dueDate = parsers.parseDueDate(todo.text);
      const priority = parsers.parsePriority(todo.text);
      
      // Determine status based on checked state
      const status = todo.checked ? 'Done' : 'Backlog';
      
      // Create task
      try {
        await client.createPage(tasksDbId, {
          'Title': {
            title: [{ text: { content: todo.text } }]
          },
          'Status': {
            select: { name: status }
          },
          'Priority': {
            select: { name: priority }
          },
          ...(dueDate && {
            'Due': {
              date: { start: dueDate }
            }
          }),
          'Project': {
            select: { name: project }
          },
          'From Meeting': {
            relation: [{ id: meeting.id }]
          },
          'Sprint?': {
            checkbox: false
          },
          'Line Key': {
            rich_text: [{ text: { content: lineKey } }]
          }
        });
        
        log(`  Created task: ${todo.text.substring(0, 60)}... [${priority}${dueDate ? ', due ' + dueDate : ''}]`);
        created++;
        
      } catch (error) {
        log(`  Failed to create task: ${error.message}`, 'ERROR');
        skipped++;
      }
    }
    
    // NEW: Check for project information section
    log(`  Checking for project information...`);
    const hasInfo = await projectInfo.hasProjectInfo(meeting.id);
    
    if (hasInfo) {
      log(`  Found project information section - extracting and categorizing...`);
      const categorized = await projectInfo.extractAndCategorize(meeting.id);
      
      if (categorized) {
        const meetingTitle = extractors.getMeetingTitle(meeting);
        log(`  Updating project page for: ${project}`);
        const updated = await projectPage.updateProjectPage(project, categorized, meetingTitle, meeting.id);
        
        if (updated) {
          log(`  Successfully updated project page`);
        } else {
          log(`  Failed to update project page (may not exist yet)`, 'WARN');
        }
      }
    } else {
      log(`  No project information section found`);
    }
    
    // Update meeting properties
    const updateProps = {
      'Processed': { checkbox: true },
      'Last Processed': { date: { start: new Date().toISOString() } }
    };
    
    if (!extractors.getProjectFromPage(meeting)) {
      updateProps['Project'] = { select: { name: project } };
      updateProps['Needs Review?'] = { checkbox: needsReview };
    }
    
    await client.updatePage(meeting.id, updateProps);
    log(`  Updated meeting: Processed=true, Project=${project}, Needs Review=${needsReview}`);
    
    return { created, skipped };
    
  } catch (error) {
    log(`  Error processing meeting: ${error.message}`, 'ERROR');
    console.error(error.stack);
    return { created: 0, skipped: 0 };
  }
}

// Process quick todos
async function processQuickTodos(tasksDbId) {
  log('Checking for quick todos...');
  
  try {
    // Query for tasks with no status or Backlog status (new quick todos)
    const response = await client.queryDatabase(tasksDbId, {
      or: [
        {
          property: 'Status',
          select: {
            is_empty: true
          }
        },
        {
          property: 'Status',
          select: {
            equals: 'Backlog'
          }
        }
      ]
    });
    
    // Filter for quick todos that need processing
    const quickTodos = response.results.filter(task => quickTodo.isQuickTodo(task));
    
    log(`Found ${quickTodos.length} quick todos to process`);
    
    if (quickTodos.length === 0) {
      return;
    }
    
    let processed = 0;
    let tasksCreated = 0;
    let projectInfoRouted = 0;
    
    for (const task of quickTodos) {
      const title = task.properties.Title?.title?.map(t => t.plain_text).join('') || '(untitled)';
      log(`Processing quick todo: "${title}" (${task.id})`);
      
      const result = await quickTodo.processQuickTodo(task);
      if (result) {
        processed++;
        if (result.taskCreated) tasksCreated++;
        if (result.projectInfoRouted) projectInfoRouted++;
      }
    }
    
    log(`Quick todos complete: ${processed} processed (${tasksCreated} tasks, ${projectInfoRouted} project info routed)`);
    
  } catch (error) {
    log(`Error processing quick todos: ${error.message}`, 'ERROR');
    console.error(error.stack);
  }
}

// Main polling function
async function pollMeetings() {
  log('Starting poll...');
  
  try {
    const config = await loadConfig();
    const meetingsDbId = config.databases.meetings.id;
    const tasksDbId = config.databases.tasks.id;
    
    // Query for meetings that need processing
    const response = await client.queryDatabase(meetingsDbId, {
      or: [
        {
          property: 'Processed',
          checkbox: {
            equals: false
          }
        },
        {
          and: [
            {
              property: 'Processed',
              checkbox: {
                equals: true
              }
            },
            {
              property: 'Last Processed',
              date: {
                is_not_empty: true
              }
            }
          ]
        }
      ]
    }, [
      {
        property: 'Created',
        direction: 'descending'
      }
    ]);
    
    log(`Found ${response.results.length} meetings to check`);
    
    // Filter meetings that should be processed
    const meetingsToProcess = response.results.filter(meeting => 
      extractors.shouldProcessMeeting(meeting)
    );
    
    log(`${meetingsToProcess.length} meetings need processing`);
    
    // Process each meeting
    let totalCreated = 0;
    let totalSkipped = 0;
    
    if (meetingsToProcess.length > 0) {
      for (const meeting of meetingsToProcess) {
        const result = await processMeeting(meeting, tasksDbId, config);
        totalCreated += result.created;
        totalSkipped += result.skipped;
      }
      log(`Meeting poll complete: ${totalCreated} tasks created, ${totalSkipped} skipped`);
    } else {
      log('No meetings to process');
    }
    
    // Process quick todos
    await processQuickTodos(tasksDbId);
    
  } catch (error) {
    log(`Poll failed: ${error.message}`, 'ERROR');
    console.error(error.stack);
  }
}

// Run once or start polling loop
export async function runOnce() {
  await pollMeetings();
}

export async function startPolling(intervalMs = 60000) { // 1 minute default
  log(`Starting automation service (polling every ${intervalMs / 1000}s)`);
  
  // Run immediately
  await pollMeetings();
  
  // Then poll on interval
  setInterval(async () => {
    await pollMeetings();
  }, intervalMs);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const mode = args[0] || 'once';
  
  if (mode === 'loop') {
    const interval = parseInt(args[1]) || 300000;
    startPolling(interval);
  } else {
    runOnce().then(() => {
      log('Single run complete');
      process.exit(0);
    });
  }
}


