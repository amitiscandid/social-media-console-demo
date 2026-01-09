# Social Media Console — Clickable HTML Prototype (v3)

This is a **clickable prototype** for the Salesforce “Social Media Console” described in **Social Media-ToBe-SAA.docx**, updated with your **manager’s latest comments**.

It is **static HTML/JS** (no backend). The goal is to communicate **UI behavior + workflows** clearly so a Salesforce developer can implement it using **LWC + Apex + Case objects + Queues + Omni-Channel + SLA + Notifications**.

## How to run locally
1. Unzip
2. Open `index.html` in Chrome/Edge

Data is stored in `localStorage`. Use **Admin → Reset Demo Data** to reset.

## Key behaviors implemented

### Color coding (manager rules)
- **BROWN**: Unattended case (SLA not triggered)
- **BLUE**: SM team attended / in-progress (after open/reply)
- **YELLOW**: Customer replied on an in-progress case (or during forwarded)
- **VIOLET**: Forwarded to internal department
- **ORANGE**: Internal department added a comment/update (needs SM attention)
- **CLOSED**: Closed

### List ordering (manager rules)
**SM Case List (center)**
1. **YELLOW** cases at top (latest customer activity first)
2. **BROWN** next (newest unattended first)
3. **BLUE** last (older activity first → sinks to bottom until customer replies)

**Forwarded / Updated (right)**
1. **ORANGE** at top (latest dept update first)
2. **YELLOW** next (latest customer activity first)
3. **VIOLET** last (older forwarded first)

### SLA behavior (doc + manager reconciliation)
- SLA starts when the case becomes **attended** (first open by SMT).
- Dept SLA starts when **DEPT** opens the forwarded case.
- SLA breach generates a **notification** (bell icon).

## Navigation / how to use (for demo)

### 1) Social Media Team (SMT) workflow
1. Go to **Dashboard**
2. Click a **BROWN** case → it opens in a record tab and becomes **BLUE** (“attended”)
3. Fill classification (optional in prototype, but mandatory in real build)
4. Action options:
   - **Send Reply** → stays **BLUE** and sinks in list
   - **Forward to Dept** → becomes **VIOLET** and moves to Forwarded pane
   - If customer replies on an in-progress case → becomes **YELLOW** and goes to top
5. Use **Close** when resolved

### 2) Internal Department workflow (DEPT)
1. Switch role to **DEPT** (top right)
2. Open a **VIOLET** case from Dashboard or Dept Queue
3. Add internal update → case becomes **ORANGE** (top of Forwarded/Updated)
4. Dept can close (requires **Resolution Notes + Closure Code**)

### 3) Notifications
- Click the **bell 🔔** to open notifications drawer
- Notifications include: new cases, forwarded, dept updates, customer replies, SLA breach
- Click a notification’s “Open case …” link to open the record tab

### 4) Admin: campaign assignment (manager feedback)
- Go to **Admin**
- Assign / remove / reassign user for campaigns
- Owner label updates across dashboard (shows user instead of queue where assigned)

## GitHub Pages free deployment (complete steps)
1. Create a GitHub repo (public)
2. Upload the files: `index.html`, `styles.css`, `app.js`, `README.md`
3. Go to **Settings → Pages**
4. Under “Build and deployment”:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
5. Save. GitHub will provide a live URL like `https://<username>.github.io/<repo>/`

Note: `localStorage` is per browser/device. This is expected for a static prototype.

## What a Salesforce developer should build from this
- Case object + fields:
  - Channel, Handle, Original Post URL, Classification fields, Department, etc.
- Queues per channel (Facebook/Instagram/X/LinkedIn/Email)
- Assignment rules / Omni-Channel routing
- LWC console UI with:
  - Tabbed navigation + record tabs behavior
  - Case lists with the ordering rules above
  - Conversation thread UI + template replies
  - Forwarding to Dept + internal comments
  - Notifications (bell) fed by platform events / custom object
- SLAs via Entitlement / Milestones + escalations

