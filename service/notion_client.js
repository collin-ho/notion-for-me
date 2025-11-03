import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

const notion = new Client({ 
  auth: process.env.NOTION_TOKEN,
  timeoutMs: 90000 // 90 seconds for production reliability
});

// Rate limiting: 350ms delay between requests (about 3 req/sec)
const RATE_LIMIT_DELAY = 350;
const MAX_RETRIES = 5;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exponential backoff with jitter
function getBackoffDelay(attempt) {
  const baseDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
  const jitter = Math.random() * 1000;
  return baseDelay + jitter;
}

// Wrapper for API calls with rate limiting and retry logic
async function apiCall(fn, ...args) {
  let lastError;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await delay(RATE_LIMIT_DELAY);
      return await fn(...args);
    } catch (error) {
      lastError = error;
      
      if (error.code === 'rate_limited' || error.status === 429) {
        const backoffDelay = getBackoffDelay(attempt);
        console.warn(`Rate limited, retrying in ${backoffDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(backoffDelay);
        continue;
      }
      
      // Don't retry on other errors
      throw error;
    }
  }
  
  throw lastError;
}

// Query database with filters
export async function queryDatabase(databaseId, filter = {}, sorts = []) {
  const params = {
    database_id: databaseId,
    ...(Object.keys(filter).length > 0 && { filter }),
    ...(sorts.length > 0 && { sorts })
  };
  
  return apiCall(() => notion.databases.query(params));
}

// Get page properties
export async function getPage(pageId) {
  return apiCall(() => notion.pages.retrieve({ page_id: pageId }));
}

// Get all blocks from a page (with pagination)
export async function getBlocks(blockId) {
  const blocks = [];
  let cursor;
  
  do {
    const response = await apiCall(() => 
      notion.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
        page_size: 100
      })
    );
    
    blocks.push(...response.results);
    cursor = response.next_cursor;
  } while (cursor);
  
  return blocks;
}

// Recursively get all blocks including children
export async function getAllBlocksRecursive(blockId) {
  const blocks = await getBlocks(blockId);
  const allBlocks = [];
  
  for (const block of blocks) {
    allBlocks.push(block);
    
    if (block.has_children && block.type !== 'child_page' && block.type !== 'child_database') {
      try {
        const children = await getAllBlocksRecursive(block.id);
        allBlocks.push(...children);
      } catch (error) {
        // Skip blocks we can't access (like transcription blocks)
        if (error.code === 'object_not_found' || error.message?.includes('transcription')) {
          console.warn(`Skipping inaccessible block: ${block.type} (${block.id})`);
        } else {
          throw error;
        }
      }
    }
  }
  
  return allBlocks;
}

// Optimized: Get only top-level blocks (no recursion)
// Much faster for finding section headings in project pages
export async function getTopLevelBlocks(blockId) {
  return await getBlocks(blockId);
}

// Create a new page in a database
export async function createPage(databaseId, properties, children = []) {
  const params = {
    parent: {
      type: 'database_id',
      database_id: databaseId
    },
    properties,
    ...(children.length > 0 && { children })
  };
  
  return apiCall(() => notion.pages.create(params));
}

// Update page properties
export async function updatePage(pageId, properties) {
  return apiCall(() => notion.pages.update({
    page_id: pageId,
    properties
  }));
}

// Check if a task with given Line Key already exists
export async function taskExists(tasksDbId, lineKey) {
  const response = await queryDatabase(tasksDbId, {
    property: 'Line Key',
    rich_text: {
      equals: lineKey
    }
  });
  
  return response.results.length > 0;
}

export { notion };


