# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Requirement

All communication MUST be in Chinese (Simplified). This includes:
- All explanations and documentation
- Code comments
- Commit messages
- Variable names can remain in English as they are part of the code structure

## Project Overview

**问当地 (WenDangDi)** is a WeChat Mini Program built on Tencent CloudBase (TCB). It's a location-based instant mutual help platform connecting seekers (求助者) who need real-time information from specific locations with helpers (帮助者) who can provide that information.

- **Frontend**: Native WeChat Mini Program (WXML, WXSS, JavaScript)
- **Backend**: Node.js cloud functions (25 functions)
- **Database**: MongoDB (12 collections)
- **Platform**: Tencent CloudBase serverless

## Development Commands

### Prerequisites
```bash
# Install CloudBase CLI globally
npm install -g @cloudbase/cli

# Login to Tencent Cloud
tcb login
```

### Database Initialization
```bash
# Initialize database collections and indexes
node scripts/init-db.js
```

### Cloud Function Deployment
```bash
# Deploy all cloud functions (Unix/Linux/macOS/Git Bash)
./scripts/deploy.sh

# Deploy individual functions via WeChat Developer Tools
# Right-click on cloudfunction → "Create and Deploy: Cloud Install Dependencies"
```

### Development Workflow
1. Use **WeChat Developer Tools** (微信开发者工具) to open the `miniprogram` directory
2. AppID: `wx37902a802fff342d`
3. Enable cloud development (云开发) in the IDE
4. Modify `cloudfunctions/config/index.js` to set the admin OpenID

## Architecture

### Cloud Functions Organization

Located in `/cloudfunctions/`:

| Service | Functions | Description |
|---------|-----------|-------------|
| `config/` | Global config | Points rules, business rules |
| `user/` | login, getUserInfo, completeProfile, updateSettings | User management |
| `points/` | signIn, getBalance, checkSignIn, getRecords, getInviteRecords | Points system |
| `need/` | createNeed, getNeedList, getNeedDetail, cancelNeed, appendPoints, modifyNeed | Request management |
| `match/` | findHelpers, acceptTask, rejectTask, getTaskList | Matching engine |
| `chat/` | sendMessage, getMessages, markRead | Messaging |
| `settlement/` | completeNeed, autoSettlement | Payment settlement |
| Others | admin, feedback, review, support | Management functions |

### Database Collections

Key collections with indexes:
- **users** - User profiles with geospatial indexing on `helperInfo.locations`
- **needs** - Help requests with geospatial indexing on `location`
- **matches** - Match records between seekers and helpers
- **messages** - Chat messages
- **points_records** - Points transaction history
- **sign_in_records** - Check-in records
- **login_logs** - Login history (30-day TTL)
- **login_attempts** - Failed login tracking (10-min TTL)

### Frontend Structure

Located in `/miniprogram/`:
- **pages/** - 17 pages organized by role (seeker/, helper/, points/, mine/)
- **services/** - API service layer (user.js, points.js, need.js, match.js, chat.js, location.js)
- **utils/** - Utilities (request.js, storage.js, location.js, util.js)

### Key Configuration

`/cloudfunctions/config/index.js`:
- Environment ID: `wdd-2grpiy1r6f9f4cf2`
- Points rules (NEW_USER: 100, COMPLETE_PROFILE: 30, etc.)
- Business rules (AUTO_SETTLEMENT_HOURS: 24, etc.)

### Points System

- New users: 100 points
- Complete profile: 30 points
- Daily check-in: 5→10→20 (streak rewards)
- Invite friends: 50 points each
- Task completion: Full bounty + 5% bonus for good ratings

### Security & Anti-Spam

- Device-based registration limit: 1 per day
- IP-based publishing limit: 3 per hour
- Monthly invite limit: 20 per month
- Message rate limiting: 30 per minute
- Login attempt limiting: 5 per 10 minutes

## Important Notes

- **No formal testing framework** - testing is manual via WeChat Developer Tools simulator
- Cloud functions use `wx-server-sdk` for CloudBase integration
- Frontend uses `wx.cloud.callFunction()` to invoke cloud functions
- Geospatial queries use MongoDB's `2dsphere` indexes
- Points transactions use atomic updates with balance verification
