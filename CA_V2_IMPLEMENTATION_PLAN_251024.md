# CA-v2 Implementation Plan - OpenAI Enhanced

**Created:** October 24, 2025  
**Status:** In Progress  
**Version:** 2.0 (OpenAI Integration)

---

## 🎯 Overview

Enhanced CA-v2 system with intelligent project information capture using OpenAI for smart categorization and routing of meeting data to project pages.

### What's Different in v2.0
- ✅ OpenAI integration for smart info categorization
- ✅ Automated project page updates with structured data
- ✅ AI-powered quick todo parsing
- ✅ Project pages as living knowledge bases

---

## 📊 Current State

### ✅ What's Built & Working
- [x] Dashboard page with all sections
- [x] Meetings DB (with all fields)
- [x] Tasks DB (with all fields)
- [x] Projects DB (structure exists, empty)
- [x] Quick Actions callout with Meeting button
- [x] Active Sprint view (Board, filtered by Sprint?)
- [x] This Week view (Table, filtered by Due date)
- [x] Active Projects view (Gallery, filtered by Status=Active)
- [x] Recent Meetings view (Table, last 30 days)
- [x] All Databases links section
- [x] Meeting template with AI prompt
- [x] Automation: Meetings → Checkboxes → Tasks

### 🔲 What Needs Building
- [ ] OpenAI integration in automation service
- [ ] Project information extraction & routing
- [ ] Project page template structure
- [ ] Quick todo AI parsing workflow
- [ ] Migration workflow for old project data

---

## 📋 Implementation Checklist

---

## PHASE 1: OpenAI Integration Setup

### Step 1.1: Environment & Dependencies
- [x] Add OpenAI npm package: `npm install openai`
- [x] Add `OPENAI_API_KEY` to `.env` file
- [x] Test OpenAI connection with simple test script ✅
- [x] Document API key setup in README

**Files to modify:**
- [x] `package.json` (add dependency)
- [x] `.env` (add API key placeholder)
- [x] Create: `service/openai_client.js`

---

### Step 1.2: Create OpenAI Service Module
- [x] Create `service/openai_client.js` with:
  - [x] OpenAI client initialization
  - [x] `categorizeProjectInfo()` function
  - [x] `parseQuickTodo()` function  
  - [x] Error handling and retry logic
  - [x] Token usage logging

**Deliverable:** ✅ Working OpenAI client module created

**Features:**
- Categorizes project info into: credentials, contacts, links, decisions
- Parses quick todos with AI
- Includes retry logic for rate limits
- Logs token usage and cost estimates
- CLI testing commands available

---

## PHASE 2: Project Information Extraction

### Step 2.1: Update Meeting Template Prompt
- [ ] Open meeting template in Notion
- [ ] Update AI prompt to include "Project Information" section
- [ ] Add instructions for extracting:
  - [ ] Credentials & API keys
  - [ ] Key contacts
  - [ ] Important links
  - [ ] Decisions & commitments
- [ ] Test with a sample meeting
- [ ] Document the prompt in this plan

**Updated Prompt:**
```
First, rename this page to reflect the meeting topic and date (format: "Project Name - Meeting Topic - MM/DD").

Then, analyze the meeting summary, notes, and transcript above (ignore any callout boxes or prompts below). Extract two key sections:

1. PROJECT INFORMATION (if any direct info was shared)
Look for and extract:
- API keys, credentials, or access information
- Important URLs, documentation links, or repository links
- Technical specifications or configuration details
- Key contacts (names, emails, roles)
- Important decisions or commitments made
- Budget/timeline information

Format each as a clear bullet with context. If no direct project info was shared, skip this section.

2. ACTION ITEMS
Create a checklist of ONLY actionable work items:
- State each task clearly and actionably
- Include any person mentioned (owner/assignee) in the task text
- Note any deadlines or timeframes (use words like "tomorrow", "Friday", "next week", "urgent")
- Include brief context about what project/area it relates to

ONLY include items that are:
- Actual work tasks (building, creating, reviewing, contacting, deciding)
- Project-related deliverables
- Clear next steps that move the project forward

DO NOT include:
- Personal scheduling or time-off mentions
- General discussion points without clear actions
- Information shared for context only
- FYI items or background information

Be selective - quality over quantity. Format as individual checkbox items below the "Action Items" heading.
```

---

### Step 2.2: Extract Project Info from Meetings
- [x] Create `service/project_info_extractor.js` with:
  - [x] `findProjectInfoSection()` - finds "Project Information" heading
  - [x] `extractInfoBullets()` - gets all bullets under that section
  - [x] `sendToOpenAI()` - categorizes with OpenAI
  - [x] Returns structured data: `{ credentials: [], contacts: [], links: [], decisions: [] }`

**✅ Deliverable:** Project info extractor module complete

**Test cases:** (will test with real meeting after Phase 3)
- [ ] Meeting with credentials
- [ ] Meeting with contacts only
- [ ] Meeting with mixed info
- [ ] Meeting with no project info section

---

## PHASE 3: Project Page Structure

### Step 3.1: Design Project Page Template
- [ ] Create template structure (see below)
- [ ] Define sections for categorized info
- [ ] Plan how automation will append data
- [ ] Decide on date formatting for logs

**Project Page Template Structure:**
```markdown
# [Project Name]

**Status:** Active | On Hold | Completed
**Owner:** [Your name]
**Started:** [Date]

---

## 📋 Quick Reference

### 🔑 Credentials & Access
[Automated entries from meetings]

### 👥 Key Contacts
[Automated entries from meetings]

### 🔗 Important Links
[Automated entries from meetings]

---

## 💡 Project Context & Decisions

[Chronological log with date and meeting reference]

**Added [MM/DD] from [Meeting Title]:**
- [Decision or context item]
- [Another item]

---

## 📊 Active Tasks
[Embedded Tasks DB view - filtered to this project, Status != Done]

---

## 💬 Related Meetings  
[Embedded Meetings DB view - filtered to this project, last 90 days]

---

## 📝 Ongoing Notes
[Free-form section for manual additions]
```

---

### Step 3.2: Create Project Pages in Notion
- [x] **USER COMPLETED:** Created initial project pages for:
  - [x] ClickUp
  - [x] HubSpot
  - [x] Docebo
  - [x] AI Sales
  - [x] Insider Knowledge
  - [x] PD OTN
  - [x] Podcast
  - [x] Quarterly Economic Review
  - [x] Support/Other
- [x] Apply template structure to each
- [x] Add embedded Tasks and Meetings views (user will refine filters)
- [x] Test navigation from dashboard

**See:** `PROJECT_PAGE_SETUP_GUIDE.md` for detailed instructions

---

### Step 3.3: Build Project Page Updater
- [x] Create `service/project_page_updater.js` with:
  - [x] `findProjectPage()` - gets project page ID from Projects DB
  - [x] `appendToSection()` - adds content to specific section
  - [x] `formatEntry()` - formats with date and meeting reference
  - [x] `updateProjectPage()` - routes all categorized data to correct sections

**✅ Deliverable:** Project page updater module complete

**CLI Commands:**
- `node service/project_page_updater.js find <project_name>` - Find a project page
- `node service/project_page_updater.js test [project_name]` - Test update with sample data

**Test cases:** (will test with real project pages)
- [ ] Add credentials to existing section
- [ ] Add first contact to empty section
- [ ] Add decision with date formatting
- [ ] Handle project page not found

---

## PHASE 4: Automation Service Update

### Step 4.1: Integrate Project Info Processing
- [x] Update `service/automation.js` to:
  - [x] Import project_info_extractor
  - [x] Import project_page_updater  
  - [x] Import openai_client
  - [x] After processing tasks, check for project info section
  - [x] If found, extract and categorize
  - [x] Route to appropriate project page sections
  - [x] Log all operations

**✅ Deliverable:** Full integration complete

**Flow:**
```
1. Process meeting (existing)
2. Extract todos → create tasks (existing)
3. ✅ NEW: Check for "Project Information" section
4. ✅ NEW: If found → extract bullets
5. ✅ NEW: Send to GPT-5 Nano for categorization
6. ✅ NEW: Update project page with categorized data
7. Mark meeting as processed (existing)
```

---

### Step 4.2: Add Logging & Error Handling
- [x] Add detailed logging for project info operations
- [x] Handle OpenAI API errors gracefully
- [x] Handle missing project pages
- [x] Log token usage for cost tracking
- [x] Add retry logic for API failures

**✅ All error handling and logging implemented in modules**

---

### Step 4.3: Testing
- [ ] Test end-to-end with real meeting
- [ ] Verify credentials go to right section
- [ ] Verify contacts go to right section
- [ ] Verify links go to right section
- [ ] Verify decisions logged with date
- [ ] Check for duplicates/conflicts
- [ ] Test with multiple projects in one meeting

---

## PHASE 5: Quick Todo Workflow

### Step 5.1: Design Quick Todo Experience
- [ ] Determine trigger mechanism (button, template, shortcut)
- [ ] Design minimal input format
- [ ] Define what fields AI should extract
- [ ] Plan fallback for unparseable todos

**Quick Todo Format:**
```
Input: "send proposal to ClickUp client urgent by Friday"
AI extracts:
- Title: "Send proposal to ClickUp client"
- Project: ClickUp
- Priority: High (from "urgent")
- Due: [Next Friday's date]
- Status: Backlog
```

---

### Step 5.2: Build Quick Todo Parser
- [ ] Add `parseQuickTodo()` to openai_client.js
- [ ] Create prompt for OpenAI to extract fields
- [ ] Return structured JSON with task properties
- [ ] Handle incomplete info gracefully

**OpenAI Prompt:**
```
Extract task properties from this text: "{todo_text}"

Return JSON with:
{
  "title": "cleaned task description",
  "project": "detected project name or null",
  "priority": "High/Medium/Low based on keywords",
  "due": "YYYY-MM-DD or null",
  "context": "any additional notes"
}

Priority keywords:
- High: urgent, asap, critical, important
- Low: nice to have, optional, when you can
- Default: Medium

Date keywords: tomorrow, Friday, next week, etc.
```

---

### Step 5.3: Create Quick Todo Entry Point
- [ ] Create `scripts/quick_todo.js` for CLI testing
- [ ] OR: Create todo template in Tasks DB with AI integration
- [ ] Test parsing various input formats
- [ ] Validate AI accuracy
- [ ] Integrate with automation service

**Decision needed:** CLI script or Notion template?

---

## PHASE 6: Migration Workflow

### Step 6.1: Document Migration Process
- [ ] List old workspace project pages to migrate
- [ ] Create step-by-step migration checklist
- [ ] Define what info to capture from each page
- [ ] Use migration as real-world test of new system

**Migration Steps per Project:**
1. Open old project page
2. Identify: credentials, contacts, links, decisions
3. Create formatted list
4. Create "Migration" meeting in Notion
5. Paste formatted info as "Project Information"
6. Run automation
7. Verify info routed correctly
8. Adjust and repeat

---

### Step 6.2: Create Migration Template
- [ ] Create "Project Migration" meeting template
- [ ] Pre-formatted sections for easy paste
- [ ] Instructions for capturing old data
- [ ] Test with one project first

---

### Step 6.3: Execute Migration
- [ ] Migrate project 1: [Project name]
  - [ ] Credentials captured
  - [ ] Contacts captured
  - [ ] Links captured
  - [ ] Decisions/context captured
  - [ ] Verified in new project page
- [ ] Migrate project 2: [Project name]
  - [ ] Credentials captured
  - [ ] Contacts captured
  - [ ] Links captured
  - [ ] Decisions/context captured
  - [ ] Verified in new project page
- [ ] Repeat for all active projects

---

## PHASE 7: Documentation & Polish

### Step 7.1: Update Documentation
- [ ] Update README.md with new workflows
- [ ] Document OpenAI integration
- [ ] Document quick todo usage
- [ ] Document project page structure
- [ ] Add troubleshooting section

---

### Step 7.2: Create Quick Reference Guide
- [ ] One-page guide for daily use
- [ ] Meeting workflow (with screenshots)
- [ ] Quick todo workflow
- [ ] Project page navigation
- [ ] Common tasks and shortcuts

---

### Step 7.3: Cleanup & Optimization
- [ ] Remove unused code
- [ ] Add code comments
- [ ] Optimize OpenAI token usage
- [ ] Add rate limiting if needed
- [ ] Review and refactor

---

## 📝 Notes & Decisions

### OpenAI Model Selection
- **Model:** GPT-4o-mini (cost-effective, fast)
- **Fallback:** GPT-4o (if accuracy issues)
- **Cost estimate:** ~$2-3/month for 100 meetings

### Project Info Categories
1. **Credentials** - API keys, passwords, access tokens
2. **Contacts** - Names, emails, roles, phone numbers
3. **Links** - URLs, documentation, repositories, drives
4. **Decisions** - Commitments, approvals, strategic decisions

### Data Routing Logic
- Credentials → "🔑 Credentials & Access" section
- Contacts → "👥 Key Contacts" section
- Links → "🔗 Important Links" section
- Decisions → "💡 Project Context & Decisions" (dated log)

---

## 🚀 Getting Started

To begin implementation:
1. Start with Phase 1, Step 1.1
2. Check off each item as completed
3. Test thoroughly at each phase
4. Use real meetings as test cases
5. Iterate based on findings

---

## 📊 Progress Tracker

**Overall Progress:** 36/68 steps completed (53%)

**Phase 1:** 8/8 steps ✅ COMPLETE
**Phase 2:** 8/8 steps ✅ COMPLETE  
**Phase 3:** 15/15 steps ✅ COMPLETE (project pages created)
**Phase 4:** 10/10 steps ✅ COMPLETE (ready to test)
**Phase 5:** 0/8 steps (Quick Todo - optional for now)
**Phase 6:** 0/15 steps (Migration - optional for now)
**Phase 7:** 0/8 steps (Documentation - final polish)

---

## 🔄 Iteration Notes

As you work through this plan, add notes here about:
- What worked well
- What needed adjustment
- Lessons learned
- Ideas for future improvements

---

**Last Updated:** October 24, 2025

