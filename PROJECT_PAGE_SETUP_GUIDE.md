# Project Page Setup Guide

**Time Required:** ~15 minutes  
**When:** Do this before testing the full automation

---

## What You Need To Do

Create project pages in your **Projects Database** with a specific template structure so the automation can append information to the right sections.

---

## Project Page Template Structure

Each project page should have these sections (exact headings matter!):

```markdown
# [Project Name]

**Status:** Active
**Owner:** [Your name]

---

## 📋 Quick Reference

### 🔑 Credentials & Access
[Automation will add credentials here]

### 👥 Key Contacts
[Automation will add contacts here]

### 🔗 Important Links
[Automation will add links here]

---

## 💡 Project Context & Decisions

[Automation will add dated decision logs here]

---

## 📊 Active Tasks
[Add embedded Tasks DB view - filtered to this project, Status != Done]

---

## 💬 Related Meetings  
[Add embedded Meetings DB view - filtered to this project, last 90 days]

---

## 📝 Ongoing Notes
[Free-form section for manual notes]
```

---

## Step-by-Step Instructions

### 1. Open Your Projects Database
URL from your config: https://www.notion.so/2967a873fa3181d6b9d4fa785e3d064c

### 2. Create Pages for These Projects

Create a new page for each project (click "+ New"):

**Required projects:**
1. ClickUp
2. HubSpot
3. Docebo
4. AI Sales
5. Insider Knowledge
6. PD OTN
7. Podcast
8. Quarterly Economic Review
9. Support/Other

### 3. For Each Page:

**A. Set the title** (must match exactly):
- Page title = Project name (e.g., "ClickUp", "HubSpot")

**B. Add the section headings** (copy/paste):
```
## 📋 Quick Reference

### 🔑 Credentials & Access

### 👥 Key Contacts

### 🔗 Important Links

---

## 💡 Project Context & Decisions

---

## 📊 Active Tasks

[Type /linked → Select Tasks database → Filter by this project name]

---

## 💬 Related Meetings

[Type /linked → Select Meetings database → Filter by this project name]

---

## 📝 Ongoing Notes

[Add any manual notes here]
```

**C. Add embedded database views:**

For **📊 Active Tasks:**
- Type `/linked`
- Select "Create linked database"
- Choose **Tasks** database
- Filter: `Project = [This Project Name]` AND `Status != Done`

For **💬 Related Meetings:**
- Type `/linked`
- Select "Create linked database"
- Choose **Meetings** database
- Filter: `Project = [This Project Name]`
- Sort: `Created descending`

---

## Quick Method (Copy Template)

**Faster approach:**
1. Create the first project page (ClickUp) with full structure
2. Duplicate it 9 times
3. Just change the title and filters for each

---

## Testing After Setup

Once you've created the pages, test if automation can find them:

```bash
node service/project_page_updater.js find ClickUp
node service/project_page_updater.js find HubSpot
```

Should output the page ID and URL.

---

## What Automation Will Do

When a meeting has a "Project Information" section, automation will:

1. Extract and categorize the info (using GPT-5 Nano)
2. Find the relevant project page
3. Append to the correct sections:
   - Credentials → 🔑 Credentials & Access
   - Contacts → 👥 Key Contacts
   - Links → 🔗 Important Links
   - Decisions → 💡 Project Context & Decisions (dated log)

---

## Ready to Create Pages?

Let me know when you've created them and we'll test the full workflow!

