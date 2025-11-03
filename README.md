# CA-v2 - Notion Meeting & Task Automation

**Version:** 2.0 (OpenAI Enhanced)  
**Status:** Active Development  
**Last Updated:** October 24, 2025

---

## 🎯 What This Does

Automatically converts meeting notes into organized tasks, with intelligent project information capture and routing.

**Workflow:**
1. Record meeting with Notion AI (`/meet`)
2. AI extracts action items (checkboxes) AND project information
3. Automation creates tasks in Tasks DB
4. **NEW:** Project info automatically routed to project pages
5. Everything linked and organized by project

---

## 🚀 Current Status

### ✅ Working Now
- Meeting → Task automation
- Project inference from meeting titles
- Priority and due date parsing
- Task deduplication
- Dashboard with all views

### 🔨 Building Now
- OpenAI integration for smart categorization
- Project information extraction & routing
- Project pages as knowledge bases
- AI-powered quick todo parsing

**See:** `CA_V2_IMPLEMENTATION_PLAN_251024.md` for detailed implementation plan

---

## 📂 Project Structure

```
/Users/collinhoben/notion-forMe/
├── CA_V2_CONFIG.json                    # Database IDs
├── CA_V2_IMPLEMENTATION_PLAN_251024.md  # Current plan ⭐
├── NOTION_API_REFERENCE.md              # API reference
├── package.json                          # Dependencies
├── .env                                  # API keys (not in repo)
│
├── service/                              # Automation modules
│   ├── automation.js                     # Main service
│   ├── notion_client.js                  # Notion API wrapper
│   ├── extractors.js                     # Data extraction
│   ├── parsers.js                        # Date/priority parsing
│   └── inference.js                      # Project inference
│
├── scripts/
│   └── setup_ca_v2.js                    # Database setup
│
└── ARCHIVE_251024/                       # Old docs & scripts
    └── ARCHIVE_INDEX.md                  # What's archived
```

---

## 🗄️ Databases

All databases live in the **CA-v2** Notion workspace:

### Meetings DB
- Stores meeting notes and AI transcriptions
- Links to generated tasks
- Auto-detects project from title

### Tasks DB  
- All actionable work items
- Created from meetings OR manually
- Sprint planning with checkbox toggle

### Projects DB
- Project pages with embedded views
- **NEW:** Knowledge base for credentials, contacts, decisions
- Auto-updated from meeting information

**Dashboard:** [View in Notion](https://www.notion.so/2967a873fa31810db2a0e5f94136dd4e)

---

## 📋 Implementation Plan

Follow the step-by-step plan in `CA_V2_IMPLEMENTATION_PLAN_251024.md`

**Current Phase:** Phase 1 - OpenAI Integration Setup

**Next Steps:**
1. Add OpenAI dependency
2. Set up API key
3. Create OpenAI client module
4. Test connection

---

## 🛠️ Commands

```bash
# Run automation once
npm run automate

# Run automation continuously (every 5 min)
npm run automate:watch

# Set up databases (already done)
npm run setup
```

---

## 🔑 Environment Variables

Required in `.env`:
```bash
NOTION_TOKEN=secret_xxx           # Notion integration token
OPENAI_API_KEY=sk-xxx            # OpenAI API key (NEW)
```

**Setup Instructions:**

1. **Get OpenAI API Key:**
   - Go to https://platform.openai.com/api-keys
   - Create a new API key
   - Copy the key (starts with `sk-`)

2. **Add to .env file:**
   - Open `.env` in your project root
   - Replace `sk-your-key-here` with your actual key
   - Save the file

3. **Test the connection:**
   ```bash
   node service/openai_client.js test
   ```

**Cost Estimate:** ~$1-2/month for typical usage with gpt-5-nano (even cheaper and better!)

---

## 📖 Documentation

- **Implementation Plan:** `CA_V2_IMPLEMENTATION_PLAN_251024.md` - Full roadmap
- **API Reference:** `NOTION_API_REFERENCE.md` - Notion API details
- **Archive:** `ARCHIVE_251024/` - Old plans and scripts

---

## 💡 Key Features

### v1 (Working)
- ✅ Automatic task creation from meetings
- ✅ Project inference
- ✅ Due date parsing (natural language)
- ✅ Priority detection
- ✅ Duplicate prevention
- ✅ Sprint planning workflow

### v2 (Building)
- 🔨 OpenAI-powered info categorization
- 🔨 Automated project page updates
- 🔨 Smart credential/contact routing
- 🔨 AI quick todo parsing
- 🔨 Project knowledge base

---

## 🐛 Troubleshooting

**Automation not running?**
- Check `.env` has `NOTION_TOKEN`
- Verify `CA_V2_CONFIG.json` has correct IDs
- Run `npm run automate` to test

**Tasks not appearing?**
- Meeting must have checkbox items (to-do blocks)
- Meeting must be edited 10-60 minutes ago
- Check automation logs for errors

**OpenAI integration failing?** (when implemented)
- Verify `OPENAI_API_KEY` in `.env`
- Check token usage/billing
- Review logs for API errors

---

## 📞 Contact

**Owner:** Collin @ Cogent Analytics  
**Created:** October 2025

---

## 🗂️ Archives

- `ARCHIVE_251023/` - Initial migration work
- `ARCHIVE_251024/` - Phase 1 docs and scripts

See `ARCHIVE_251024/ARCHIVE_INDEX.md` for details.
