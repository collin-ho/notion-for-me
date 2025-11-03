import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get model from env or use default
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Log token usage for cost tracking
function logTokenUsage(usage, operation) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [OPENAI] ${operation}:`);
  console.log(`  Prompt tokens: ${usage.prompt_tokens}`);
  console.log(`  Completion tokens: ${usage.completion_tokens}`);
  console.log(`  Total tokens: ${usage.total_tokens}`);
  
  // Rough cost estimate for gpt-4o-mini
  // $0.150 / 1M input tokens, $0.600 / 1M output tokens
  const inputCost = (usage.prompt_tokens / 1000000) * 0.150;
  const outputCost = (usage.completion_tokens / 1000000) * 0.600;
  const totalCost = inputCost + outputCost;
  console.log(`  Estimated cost: $${totalCost.toFixed(6)}`);
}

/**
 * Categorize project information bullets into structured categories
 * @param {string[]} bullets - Array of bullet point strings from meeting
 * @returns {Promise<Object>} - Categorized data: { credentials, contacts, links, decisions, other }
 */
export async function categorizeProjectInfo(bullets) {
  if (!bullets || bullets.length === 0) {
    return { credentials: [], contacts: [], links: [], decisions: [], other: [] };
  }

  const bulletsText = bullets.map((b, i) => `${i + 1}. ${b}`).join('\n');

  const prompt = `You are a smart project information formatter. Categorize each bullet, **clean up the formatting**, but **NEVER lose actual data** (keys, URLs, names, etc).

**CRITICAL RULES:**
1. PRESERVE all actual values (API keys, URLs, emails, phone numbers, names, etc)
2. REMOVE filler words ("this is the", "here is", "I got the", etc)
3. FORMAT professionally and consistently
4. ADD clarity if needed, but don't remove data

**Categories:**
- credentials: API keys, passwords, access tokens, login information
- contacts: Names, emails, phone numbers, roles, key people
- links: URLs, documentation links, repository links
- decisions: Strategic decisions, commitments, approvals, key determinations
- other: Anything that doesn't fit above

**Input:**
${bulletsText}

**Formatting Examples:**
Input: "this is the clickup api key sk-proj-abc123xyz for the teams summaries project"
Output: "ClickUp API Key: sk-proj-abc123xyz (for teams summaries)"

Input: "contact person is Karen Smith her email is karen@example.com and she handles sales"
Output: "Karen Smith - karen@example.com (Sales contact)"

Input: "here's the link to the docs https://docs.example.com/api"
Output: "Documentation: https://docs.example.com/api"

Input: "we decided to use the new API starting next month"
Output: "Decision: Use new API starting next month"

**Your task:**
1. Categorize each bullet
2. Remove filler words ("this is", "here is", "I got", etc)
3. Format cleanly (use colons, dashes, parentheses appropriately)
4. Keep ALL important data (keys, values, URLs, names, numbers)

Return ONLY valid JSON:
{
  "credentials": ["formatted credential with exact values"],
  "contacts": ["formatted contact details"],
  "links": ["formatted URLs"],
  "decisions": ["formatted decision text"],
  "other": ["formatted other info"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that categorizes project information. Always return valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    logTokenUsage(response.usage, 'categorizeProjectInfo');

    const result = JSON.parse(response.choices[0].message.content);
    
    // Ensure all categories exist
    return {
      credentials: result.credentials || [],
      contacts: result.contacts || [],
      links: result.links || [],
      decisions: result.decisions || [],
      other: result.other || [],
    };

  } catch (error) {
    console.error('[OPENAI] Error categorizing project info:', error.message);
    
    // Retry once on rate limit or timeout
    if (error.status === 429 || error.code === 'ETIMEDOUT') {
      console.log('[OPENAI] Retrying after 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return categorizeProjectInfo(bullets);
    }
    
    // On other errors, return all items as "other"
    return {
      credentials: [],
      contacts: [],
      links: [],
      decisions: [],
      other: bullets,
    };
  }
}

/**
 * Parse a quick todo text into structured task properties
 * @param {string} todoText - Free-form todo text (e.g., "send proposal to ClickUp client urgent by Friday")
 * @returns {Promise<Object>} - Parsed task: { title, project, priority, due, context }
 */
export async function parseQuickTodo(todoText) {
  if (!todoText || todoText.trim().length === 0) {
    throw new Error('Todo text cannot be empty');
  }

  const prompt = `Analyze this task description and extract properties. If there are MULTIPLE distinct tasks, return an array. If ONE task, return a single object.

Text: "${todoText}"

Return ONLY valid JSON in this format:

For SINGLE task:
{
  "tasks": [{
    "title": "concise, clean task title (5-10 words max, actionable)",
    "project": "detected project name or null",
    "priority": "High/Medium/Low",
    "due": "YYYY-MM-DD format or null",
    "context": "brief additional context or null"
  }]
}

For MULTIPLE tasks:
{
  "tasks": [
    { "title": "first task", "project": "Project1", "priority": "High", "due": "2024-10-26", "context": null },
    { "title": "second task", "project": "Project2", "priority": "Medium", "due": null, "context": null }
  ]
}

**Title Guidelines:**
- Make it concise and actionable (e.g., "Update team on project status" not "update Jody and Lindsay on their live gos this week and run a case study...")
- Remove filler words, clean up grammar
- Start with action verb when possible
- Combine related mini-tasks into one clear title

**Priority keywords:**
- High: urgent, asap, critical, important, emergency, immediately, blocking, today, end of day
- Low: nice to have, optional, when you can, someday, eventually, if time
- Default: Medium

**Date parsing:**
- tomorrow/today: calculate date
- Friday/Monday/etc: next occurrence
- this week/next week: appropriate date
- end of week/eow: next Friday
- end of month/eom: last day of month
- MM/DD or YYYY-MM-DD: exact date
- If no date: null

**Project detection (look for explicit mentions OR infer from context):**
Keywords:
- ClickUp, Click Up, CU, "click up" → "ClickUp"
- HubSpot, Hub Spot, HS, "hub spot" → "HubSpot"  
- Docebo, LMS, Uni, "learning" → "Docebo"
- AI Sales, Retell, RetellAI, SAI, "sales ai" → "AI Sales"
- Insider, Merlin, "insider knowledge" → "Insider Knowledge"
- PD, OTN, "professional development" → "PD OTN"
- Podcast, Episode, "podcast" → "Podcast"
- QER, Economic, "quarterly" → "Quarterly Economic Review"
- Support, Other, "support / other" → "Support / Other"

Context clues:
- WPR, weekly reports, dashboards, automations → likely "ClickUp"
- CRM, contacts, leads, deals → likely "HubSpot"
- Training, LMS, courses → likely "Docebo"
- Recordings, episodes → likely "Podcast"

If truly unclear: null (don't guess)

Current date: ${new Date().toISOString().split('T')[0]}`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that parses task descriptions. Always return valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    logTokenUsage(response.usage, 'parseQuickTodo');

    const result = JSON.parse(response.choices[0].message.content);
    
    // Return tasks array (could be single or multiple tasks)
    if (result.tasks && Array.isArray(result.tasks)) {
      return {
        tasks: result.tasks.map(task => ({
          title: task.title || todoText,
          project: task.project || null,
          priority: task.priority || 'Medium',
          due: task.due || null,
          context: task.context || null,
        }))
      };
    }
    
    // Fallback to single task format
    return {
      tasks: [{
        title: result.title || todoText,
        project: result.project || null,
        priority: result.priority || 'Medium',
        due: result.due || null,
        context: result.context || null,
      }]
    };

  } catch (error) {
    console.error('[OPENAI] Error parsing quick todo:', error.message);
    
    // Retry once on rate limit or timeout
    if (error.status === 429 || error.code === 'ETIMEDOUT') {
      console.log('[OPENAI] Retrying after 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return parseQuickTodo(todoText);
    }
    
    // On other errors, return basic parsed todo
    return {
      title: todoText,
      project: null,
      priority: 'Medium',
      due: null,
      context: null,
    };
  }
}

/**
 * Test OpenAI connection
 * @returns {Promise<boolean>} - True if connection successful
 */
export async function testConnection() {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: 'Say "OK" if you can read this.',
        },
      ],
      max_completion_tokens: 10,
    });

    console.log('[OPENAI] Connection test successful');
    console.log('[OPENAI] Response:', response.choices[0].message.content);
    return true;

  } catch (error) {
    console.error('[OPENAI] Connection test failed:', error.message);
    return false;
  }
}

// CLI test if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'test') {
    // Test connection
    console.log('Testing OpenAI connection...');
    const success = await testConnection();
    process.exit(success ? 0 : 1);

  } else if (command === 'categorize') {
    // Test categorization
    const testBullets = [
      'API Key: abc-123-xyz (for marketing automation)',
      'Documentation: https://hubspot.com/docs/api',
      'Key Contact: Chuck (chuck@email.com, sales hub lead)',
      'Decision: Collin leads marketing side, Chuck may build sales functionality',
      'Budget approved: $50k for implementation',
    ];

    console.log('Testing categorization with sample bullets...\n');
    const result = await categorizeProjectInfo(testBullets);
    console.log('\nCategorized result:');
    console.log(JSON.stringify(result, null, 2));

  } else if (command === 'parse') {
    // Test quick todo parsing
    const testTodo = process.argv[3] || 'send proposal to ClickUp client urgent by Friday';

    console.log(`Testing quick todo parsing: "${testTodo}"\n`);
    const result = await parseQuickTodo(testTodo);
    console.log('\nParsed result:');
    console.log(JSON.stringify(result, null, 2));

  } else {
    console.log('Usage:');
    console.log('  node service/openai_client.js test                    - Test connection');
    console.log('  node service/openai_client.js categorize              - Test categorization');
    console.log('  node service/openai_client.js parse "todo text here"  - Test todo parsing');
  }
}

