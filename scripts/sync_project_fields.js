import { readFile } from 'fs/promises';
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// The correct project options from Projects DB
const CORRECT_OPTIONS = [
  { name: 'ClickUp' },
  { name: 'HubSpot' },
  { name: 'Docebo' },
  { name: 'AI Sales' },
  { name: 'Insider Knowledge' },
  { name: 'PD OTN' },
  { name: 'Podcast' },
  { name: 'Quarterly Economic Review' },
  { name: 'Support/Other' }
];

async function syncProjectFields() {
  const config = JSON.parse(await readFile('./CA_V2_CONFIG.json', 'utf-8'));
  
  console.log('Syncing Project field options to match Projects DB...\n');
  
  const databasesToSync = {
    'Meetings': config.databases.meetings.id,
    'Tasks': config.databases.tasks.id
  };
  
  for (const [name, id] of Object.entries(databasesToSync)) {
    try {
      console.log(`Updating ${name} DB...`);
      
      await notion.databases.update({
        database_id: id,
        properties: {
          Project: {
            select: {
              options: CORRECT_OPTIONS
            }
          }
        }
      });
      
      console.log(`  ✅ ${name} DB updated successfully\n`);
      
    } catch (error) {
      console.log(`  ❌ ${name} DB failed: ${error.message}\n`);
    }
  }
  
  console.log('Sync complete! All databases should now have matching Project options.');
}

syncProjectFields();

