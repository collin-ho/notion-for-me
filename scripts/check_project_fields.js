import { readFile } from 'fs/promises';
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function checkProjectFields() {
  const config = JSON.parse(await readFile('./CA_V2_CONFIG.json', 'utf-8'));
  
  console.log('Checking Project field options across databases...\n');
  
  // Get each database
  const databases = {
    'Projects': config.databases.projects.id,
    'Meetings': config.databases.meetings.id,
    'Tasks': config.databases.tasks.id
  };
  
  for (const [name, id] of Object.entries(databases)) {
    try {
      const db = await notion.databases.retrieve({ database_id: id });
      
      // Find Project property
      let projectProp = null;
      let projectPropName = null;
      
      for (const [propName, prop] of Object.entries(db.properties)) {
        if (propName === 'Project' || propName.toLowerCase().includes('project')) {
          projectProp = prop;
          projectPropName = propName;
          break;
        }
      }
      
      console.log(`\n${name} DB:`);
      console.log(`  Property name: ${projectPropName || 'NOT FOUND'}`);
      
      if (projectProp && projectProp.select) {
        console.log(`  Type: Select`);
        console.log(`  Options (${projectProp.select.options.length}):`);
        projectProp.select.options.forEach((opt, i) => {
          console.log(`    ${i + 1}. ${opt.name}`);
        });
      } else if (projectProp) {
        console.log(`  Type: ${projectProp.type}`);
      } else {
        console.log(`  ERROR: Project property not found!`);
      }
      
    } catch (error) {
      console.log(`\n${name} DB: ERROR - ${error.message}`);
    }
  }
}

checkProjectFields();


