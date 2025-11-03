import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Load project options from transformation
async function getProjectOptions() {
  const projectData = JSON.parse(
    await readFile('./TRANSFORMED_251023/project_options.json', 'utf-8')
  );
  return projectData.options;
}

// Create Meetings database
async function createMeetingsDatabase(parentPageId) {
  console.log('\n📋 Creating Meetings database...');
  
  const projectOptions = await getProjectOptions();
  
  const database = await notion.databases.create({
    parent: {
      type: 'page_id',
      page_id: parentPageId
    },
    title: [
      {
        type: 'text',
        text: { content: 'Meetings' }
      }
    ],
    properties: {
      'Title': {
        title: {}
      },
      'Created': {
        created_time: {}
      },
      'Project': {
        select: {
          options: projectOptions.map(name => ({ name }))
        }
      },
      'Processed': {
        checkbox: {}
      },
      'Last Processed': {
        date: {}
      },
      'AI Summary': {
        rich_text: {}
      },
      'Decisions': {
        rich_text: {}
      },
      'Needs Review?': {
        checkbox: {}
      }
    }
  });
  
  console.log(`  ✓ Meetings database created`);
  console.log(`  ID: ${database.id}`);
  console.log(`  URL: ${database.url}`);
  
  return database;
}

// Create Tasks database
async function createTasksDatabase(parentPageId, meetingsDbId) {
  console.log('\n📋 Creating Tasks database...');
  
  const projectOptions = await getProjectOptions();
  
  const database = await notion.databases.create({
    parent: {
      type: 'page_id',
      page_id: parentPageId
    },
    title: [
      {
        type: 'text',
        text: { content: 'Tasks' }
      }
    ],
    properties: {
      'Title': {
        title: {}
      },
      'Status': {
        select: {
          options: [
            { name: 'Backlog', color: 'gray' },
            { name: 'Next', color: 'yellow' },
            { name: 'Doing', color: 'blue' },
            { name: 'Done', color: 'green' }
          ]
        }
      },
      'Due': {
        date: {}
      },
      'Project': {
        select: {
          options: projectOptions.map(name => ({ name }))
        }
      },
      'From Meeting': {
        relation: {
          database_id: meetingsDbId,
          type: 'dual_property',
          dual_property: {}
        }
      },
      'Sprint?': {
        checkbox: {}
      },
      'Line Key': {
        rich_text: {}
      },
      'Priority': {
        select: {
          options: [
            { name: 'High', color: 'red' },
            { name: 'Medium', color: 'yellow' },
            { name: 'Low', color: 'gray' }
          ]
        }
      }
    }
  });
  
  console.log(`  ✓ Tasks database created`);
  console.log(`  ID: ${database.id}`);
  console.log(`  URL: ${database.url}`);
  
  return database;
}

// Create Podcast Episodes database
async function createPodcastDatabase(parentPageId) {
  console.log('\n📋 Creating Podcast Episodes database...');
  
  const database = await notion.databases.create({
    parent: {
      type: 'page_id',
      page_id: parentPageId
    },
    title: [
      {
        type: 'text',
        text: { content: 'Podcast Episodes' }
      }
    ],
    properties: {
      'Episode Title': {
        title: {}
      },
      'Episode Number': {
        number: {}
      },
      'Release Date': {
        date: {}
      },
      'Status': {
        status: {}
      },
      'Topics': {
        multi_select: {
          options: [
            { name: 'Technology' },
            { name: 'Business' },
            { name: 'Science' },
            { name: 'Culture' },
            { name: 'Health' },
            { name: 'Politics' },
            { name: 'Education' },
            { name: 'Entertainment' }
          ]
        }
      },
      'Guests': {
        rich_text: {}
      },
      'Duration': {
        rich_text: {}
      },
      'Episode Notes': {
        rich_text: {}
      },
      'Audio File': {
        url: {}
      }
    }
  });
  
  console.log(`  ✓ Podcast Episodes database created`);
  console.log(`  ID: ${database.id}`);
  console.log(`  URL: ${database.url}`);
  
  return database;
}

// Main setup function
async function setupCAv2() {
  console.log('🚀 Setting up CA-v2 workspace...\n');
  
  // First, we need to find or create a parent page in CA-v2
  console.log('🔍 Searching for CA-v2 workspace...');
  
  const search = await notion.search({
    query: 'CA-v2',
    filter: { property: 'object', value: 'page' }
  });
  
  let parentPage;
  
  if (search.results.length > 0) {
    parentPage = search.results[0];
    console.log(`  ✓ Found existing CA-v2 page: ${parentPage.id}`);
  } else {
    console.log('  ℹ️  No CA-v2 page found.');
    console.log('\n📌 Please create a page called "CA-v2" in your Notion workspace first,');
    console.log('   then share it with this integration, and run this script again.');
    console.log('\n   OR provide the page ID of an existing page to use as parent.\n');
    return;
  }
  
  try {
    // Create databases
    const meetingsDb = await createMeetingsDatabase(parentPage.id);
    const tasksDb = await createTasksDatabase(parentPage.id, meetingsDb.id);
    const podcastDb = await createPodcastDatabase(parentPage.id);
    
    // Save configuration
    const config = {
      workspace: 'CA-v2',
      parent_page_id: parentPage.id,
      databases: {
        meetings: {
          id: meetingsDb.id,
          url: meetingsDb.url
        },
        tasks: {
          id: tasksDb.id,
          url: tasksDb.url
        },
        podcasts: {
          id: podcastDb.id,
          url: podcastDb.url
        }
      },
      created_at: new Date().toISOString()
    };
    
    await writeFile(
      './CA_V2_CONFIG.json',
      JSON.stringify(config, null, 2)
    );
    
    console.log('\n✅ CA-v2 setup complete!\n');
    console.log('📝 Configuration saved to: CA_V2_CONFIG.json\n');
    console.log('🔗 Your new databases:');
    console.log(`   Meetings: ${meetingsDb.url}`);
    console.log(`   Tasks: ${tasksDb.url}`);
    console.log(`   Podcasts: ${podcastDb.url}`);
    console.log('\n📌 Next step: Run `npm run load` to import your data\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    if (error.code === 'object_not_found') {
      console.error('\n⚠️  The parent page was not found or the integration doesn\'t have access.');
      console.error('   Make sure you\'ve shared the CA-v2 page with your integration.\n');
    }
    throw error;
  }
}

// Run setup
setupCAv2().catch(console.error);

