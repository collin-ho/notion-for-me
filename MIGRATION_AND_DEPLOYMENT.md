# Migration & Deployment Guide

**Date:** October 24, 2025  
**Status:** Ready to migrate and deploy

---

## 🎯 Phase 1: Migrate Old Data (Manual)

### What to Migrate:

**Priority 1: Active Projects**
- [ ] Review each old project page
- [ ] Copy important context/notes to new project pages
- [ ] Copy API keys, credentials → paste in new project page

**Priority 2: Active Meetings (Last 30 days)**
- [ ] Identify recent meetings with actionable items
- [ ] Copy meeting notes to new Meetings DB
- [ ] Run AI prompt to extract tasks
- [ ] Automation will process them

**Priority 3: Active Tasks**
- [ ] Review old task list
- [ ] Manually create critical tasks in new Tasks DB
- [ ] OR copy old meeting notes and let automation extract

**Skip:**
- Old completed meetings (archive for reference)
- Old completed tasks (not worth migrating)
- Historical data without action items

---

## ⚙️ Phase 2: Process Everything

### Step 1: Initial Run
```bash
npm run automate
```

This will:
- Process all new meetings you migrated
- Extract tasks from checkboxes
- Route project info to project pages
- Process any quick todos

**Expected:** Lots of tasks created (that's OK!)

---

### Step 2: Cleanup Old/Completed Items

**In Tasks DB:**

1. **Filter for old dates** (if you have any heuristic)
2. **Bulk select completed tasks:**
   - Status = Done (if you marked them)
   - OR manually review and bulk-update Status to "Done"
3. **Archive or keep** (your choice)

**Quick Bulk Update:**
- Select multiple tasks
- Right-click → Edit property
- Set Status = Done
- They'll disappear from Active Sprint/This Week views

---

## 🚀 Phase 3: Deploy to VPS

### Requirements on VPS:
- Node.js 18+ installed
- Git installed
- PM2 (process manager) for keeping it running

### Deployment Steps:

#### 1. Prepare Your Repo
```bash
# On your Mac, commit everything
git init
git add .
git commit -m "CA-v2 automation system ready for deployment"

# Create .gitignore if not exists
cat > .gitignore << 'EOF'
node_modules/
.env
*.log
.DS_Store
EOF

# Push to your repo (GitHub, GitLab, etc.)
git remote add origin <your-repo-url>
git push -u origin main
```

#### 2. SSH to VPS
```bash
ssh your-user@your-vps-ip
```

#### 3. Install Dependencies on VPS
```bash
# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

#### 4. Clone and Setup
```bash
# Clone your repo
cd ~
git clone <your-repo-url> notion-automation
cd notion-automation

# Install dependencies
npm install

# Create .env file
nano .env
```

**Add to .env:**
```
NOTION_TOKEN=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
OPENAI_API_KEY=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
OPENAI_MODEL=gpt-5-nano
```

Save and exit (Ctrl+X, Y, Enter)

#### 5. Test It Works
```bash
npm run automate
```

Should run without errors!

#### 6. Start with PM2 (Runs Forever)
```bash
# Start the automation in watch mode (checks every minute)
pm2 start npm --name "notion-automation" -- run automate:watch

# Save PM2 config
pm2 save

# Make PM2 start on boot
pm2 startup
# Follow the command it gives you (sudo ...)

# Check status
pm2 status

# View logs
pm2 logs notion-automation

# Stop if needed
pm2 stop notion-automation

# Restart if needed
pm2 restart notion-automation
```

---

## 📊 Phase 4: Monitor & Maintain

### Check Logs
```bash
# Live logs
pm2 logs notion-automation

# Last 100 lines
pm2 logs notion-automation --lines 100

# Clear logs
pm2 flush
```

### Update Code (When Needed)
```bash
cd ~/notion-automation
git pull
npm install
pm2 restart notion-automation
```

### Monitor Costs
- Check OpenAI usage: https://platform.openai.com/usage
- GPT-5 Nano is super cheap (~$1-2/month expected)

### Notion Rate Limits
- Current: Checks every 1 minute
- Notion allows: 3 requests/second
- We're well under limits (1-3 requests per check)

---

## 🛠️ Troubleshooting

**Automation not processing:**
- Check PM2 logs: `pm2 logs notion-automation`
- Check Notion integration has database access
- Verify .env variables are set

**Out of memory on VPS:**
- Check: `pm2 status`
- Increase VPS RAM or optimize interval
- Current memory usage: ~50-100MB

**Want to change check interval:**
Edit package.json:
```json
"automate:watch": "node service/automation.js loop 120000"
```
(120000 = 2 minutes instead of 1)

Then: `pm2 restart notion-automation`

---

## 📝 Migration Checklist

### Pre-Migration
- [x] All databases created and configured
- [x] Project pages created with structure
- [x] Meeting template updated with AI prompt
- [x] Project fields synced across databases
- [x] Automation tested locally

### Migration Tasks
- [ ] Copy project info from old workspace → new project pages
- [ ] Copy recent meeting notes → new Meetings DB
- [ ] Run automation to process everything
- [ ] Bulk update completed tasks to Status = Done
- [ ] Review and clean up task list
- [ ] Test a new meeting end-to-end
- [ ] Test a quick todo end-to-end

### Deployment Tasks
- [ ] Commit code to git repo
- [ ] SSH to VPS
- [ ] Install Node.js and PM2
- [ ] Clone repo and install dependencies
- [ ] Create .env file with API keys
- [ ] Test automation runs
- [ ] Start with PM2
- [ ] Configure PM2 startup
- [ ] Verify logs look good
- [ ] Test by creating meeting in Notion, wait 1 min, check tasks

### Post-Deployment
- [ ] Monitor for 24 hours
- [ ] Check costs on OpenAI dashboard
- [ ] Adjust as needed
- [ ] Document any issues
- [ ] Celebrate! 🎉

---

## 🎉 You're Done!

Your automation will now:
- Check every minute for new meetings and quick todos
- Process them automatically
- Route project info to project pages
- Keep running forever via PM2

**No more manual task creation!** 🚀

---

## Quick Reference

```bash
# Local testing
npm run automate                # Run once
npm run automate:watch          # Run continuously (every 1 min)

# On VPS
pm2 status                      # Check if running
pm2 logs notion-automation      # View logs
pm2 restart notion-automation   # Restart
pm2 stop notion-automation      # Stop
pm2 start notion-automation     # Start
```

---

**Last Updated:** October 24, 2025


