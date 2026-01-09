(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const STORAGE_KEY = "sm_console_v3";
  const now = () => Date.now();
  const minutes = (m) => m*60*1000;

  const enums = {
    roles: ["SMT","DEPT","SUP","ADMIN"],
    channels: ["Facebook","Instagram","X","LinkedIn","Email"],
    caseType: ["Complaint","Query","Compliment","Feedback"],
    category: ["Refunds","Baggage","Bookings","Flight Experience","IROP","Ticketing","Care","Sales"],
    priority: ["Low","Medium","High","Critical"],
    dept: ["Refunds","Baggage","Ticketing","Care","Sales"],
    status: ["New – Unclassified","In-Progress","Assigned to Department","Returned to SMT","Escalated","Closed"],
    users: ["Amit (Demo User)","Neha Sharma","Rahul Verma","Sana Khan","Dept Agent 1","Dept Agent 2"],
    templates: [
      "Hi {name}, thanks for reaching out. We’re checking and will update shortly.",
      "Hi {name}, please share your PNR in DM so we can assist.",
      "Hi {name}, we’ve forwarded this to the concerned team. We’ll revert soon.",
      "Hi {name}, sorry for the inconvenience. We’re looking into it urgently."
    ]
  };

  function seedData(){
    const baseTime = now() - minutes(180);
    const mk = (i, channel) => {
      const created = baseTime + minutes(i*8);
      const pri = ["Low","Medium","High","Critical"][i%4];
      const slaMinSM = pri==="Critical" ? 10 : pri==="High" ? 15 : pri==="Medium" ? 30 : 60;
      const slaMinDept = pri==="Critical" ? 15 : pri==="High" ? 30 : pri==="Medium" ? 60 : 120;

      const subject = [
        "Rescheduled flight, no update",
        "Refund not received",
        "Baggage delayed",
        "Seat selection issue",
        "Need cancellation policy",
        "Overbooking complaint",
        "IROP assistance required"
      ][i%7];

      const message = [
        "My flight got rescheduled and I didn’t get any update. Please help.",
        "I was promised a refund but it's still pending.",
        "My bag hasn’t arrived after landing. What to do?",
        "I can’t select seats, app shows error.",
        "What is the cancellation policy for last-minute changes?",
        "We were overbooked and stranded. Need urgent help.",
        "Flight disrupted due to weather. Need rebooking."
      ][i%7];

      const postId = "POST-" + (100000 + i);
      const url = `https://social.example/${channel.toLowerCase()}/${postId}`;

      return {
        id: "00012" + String(900+i),
        channel,
        handle: ["@user_handle","@flyer99","@traveler_in","@foodie","@complaints","@pnr_help"][i%6],
        customerName: ["Ravi","Priya","John","Meera","Sara","Mohit"][i%6],
        subject,
        message,
        originalPostUrl: url,
        originalPostId: postId,
        capturedAt: created,          // ingestion timestamp
        createdAt: created,           // case created timestamp
        lastActivityAt: created,      // used for sorting logic
        lastCustomerActivityAt: created,
        lastSmActivityAt: null,
        lastDeptActivityAt: null,
        firstOpenedAt: null,

        slaStartedAtSM: null,
        slaMinutesSM: slaMinSM,
        slaStartedAtDept: null,
        slaMinutesDept: slaMinDept,

        state: "BROWN",
        status: "New – Unclassified",
        lane: "SM", // SM or FORWARDED

        ownerQueue: `${channel} Queue`,
        assignedTo: null,

        type: null,
        category: null,
        priority: null,
        department: null,

        escalation: false,
        closureCode: null,
        resolutionNotes: null,

        thread: [{who:"Customer", kind:"customer", text: message, at: created}]
      };
    };

    const cases = [];
    for(let i=0;i<16;i++){
      cases.push(mk(i, enums.channels[i%enums.channels.length]));
    }

    // Seed "attended" SM case (BLUE), then customer reply (YELLOW)
    const c1 = cases[2];
    c1.type="Query"; c1.category="Bookings"; c1.priority="Medium";
    c1.state="BLUE"; c1.status="In-Progress"; c1.firstOpenedAt = c1.createdAt + minutes(4);
    c1.slaStartedAtSM = c1.firstOpenedAt;
    c1.lastSmActivityAt = c1.firstOpenedAt;
    c1.thread.push({who:"SMT", kind:"sm", text:"We’re checking. Please share your PNR in DM.", at: c1.firstOpenedAt});
    c1.lastActivityAt = c1.firstOpenedAt;

    const tCust = c1.createdAt + minutes(36);
    c1.state="YELLOW";
    c1.thread.push({who:"Customer", kind:"customer", text:"PNR: AB12CD. Please update.", at: tCust});
    c1.lastActivityAt = tCust;
    c1.lastCustomerActivityAt = tCust;

    // Seed forwarded case (VIOLET) then dept update (ORANGE)
    const c2 = cases[5];
    c2.type="Complaint"; c2.category="Refunds"; c2.priority="High"; c2.department="Refunds";
    c2.state="VIOLET"; c2.status="Assigned to Department"; c2.lane="FORWARDED";
    const tFwd = c2.createdAt + minutes(20);
    c2.firstOpenedAt = c2.createdAt + minutes(6);
    c2.slaStartedAtSM = c2.firstOpenedAt;
    c2.lastSmActivityAt = tFwd;
    c2.thread.push({who:"SMT", kind:"sm", text:"Forwarded to Refunds team.", at: tFwd});
    c2.lastActivityAt = tFwd;

    const tDept = c2.createdAt + minutes(70);
    c2.slaStartedAtDept = tDept;
    c2.lastDeptActivityAt = tDept;
    c2.state="ORANGE";
    c2.thread.push({who:"Refunds Team", kind:"dept", text:"Update: refund initiated. ETA 5–7 business days.", at: tDept});
    c2.lastActivityAt = tDept;

    return {
      version: 3,
      user: { role: "SMT", name: "Amit (Demo User)" },
      ui: {
        selectedChannel: "All",
        search: "",
        filterStatus: "All",
        filterPriority: "All",
        filterSla: "All",
        filterCategory: "All",
        deptName: "Refunds",
        notificationsOpen: false,
      },
      pageTabs: { active: "dashboard" },
      recordTabs: { activeId: null, items: [] },
      notifications: [],
      admin: {
        campaigns: [
          {id:"CMP-001", name:"Facebook Mentions", channel:"Facebook", assignedTo:"Amit (Demo User)"},
          {id:"CMP-002", name:"Instagram Comments", channel:"Instagram", assignedTo:null},
          {id:"CMP-003", name:"X/Twitter Mentions", channel:"X", assignedTo:"Neha Sharma"},
          {id:"CMP-004", name:"LinkedIn Tags", channel:"LinkedIn", assignedTo:null},
          {id:"CMP-005", name:"Support Email Ingest", channel:"Email", assignedTo:"Rahul Verma"},
        ]
      },
      cases
    };
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return seedData();
      const data = JSON.parse(raw);
      if(!data || data.version !== 3) return seedData();
      data.notifications ||= [];
      data.admin ||= seedData().admin;
      return data;
    }catch(e){ return seedData(); }
  }
  let store = load();
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  const relTime = (ts) => {
    const diff = now() - ts;
    const m = Math.max(0, Math.round(diff/60000));
    if(m < 60) return `${m}m ago`;
    const h = Math.round(m/60);
    return `${h}h ago`;
  };
  const fmtTime = (ts) => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${hh}:${mm}`;
  };

  function toast(msg, sub=""){
    const wrap = $(".toastWrap") || (() => {
      const w = document.createElement("div");
      w.className = "toastWrap";
      document.body.appendChild(w);
      return w;
    })();
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<strong>${escapeHtml(msg)}</strong><div class="small">${escapeHtml(sub)}</div>`;
    wrap.appendChild(t);
    setTimeout(()=> { t.remove(); if(!wrap.children.length) wrap.remove(); }, 2600);
  }

  function pushNotif(kind, title, details, caseId=null){
    const n = { id: "N"+Math.random().toString(16).slice(2), at: now(), kind, title, details, caseId, read:false };
    store.notifications.unshift(n);
    save();
  }

  function unreadCount(){ return (store.notifications||[]).filter(n=>!n.read).length; }

  function stateBadgeClass(st){
    return st==="BROWN"?"brown":
           st==="BLUE"?"blue":
           st==="YELLOW"?"yellow":
           st==="VIOLET"?"violet":
           st==="ORANGE"?"orange":
           st==="CLOSED"?"closed":"";
  }

  // SLA per doc: starts when case is attended (opened). Manager: brown = SLA not triggered.
  // Interpretation: SLA starts on first open by SMT/DEPT, and at that moment case becomes "attended".
  function startSlaOnOpen(c){
    if(!c.firstOpenedAt) c.firstOpenedAt = now();
    if(!c.slaStartedAtSM && c.lane==="SM"){
      c.slaStartedAtSM = c.firstOpenedAt;
    }
    if(c.state==="BROWN"){
      // "attended" => BLUE
      c.state = "BLUE";
      c.status = "In-Progress";
      c.lastSmActivityAt = c.firstOpenedAt;
      c.lastActivityAt = c.firstOpenedAt;
      pushNotif("case_attended","Case attended", `SMT opened ${c.id}.`, c.id);
    }
  }

  function slaRemainingSM(c){
    if(!c.slaStartedAtSM) return {label:"Not started", state:"NOTSTARTED", ms:null};
    const due = c.slaStartedAtSM + minutes(c.slaMinutesSM);
    const rem = due - now();
    const breached = rem <= 0;
    const minsLeft = Math.ceil(Math.abs(rem)/60000);
    if(breached) return {label:`BREACHED (${minsLeft}m)`, state:"BREACHED", ms:rem};
    if(minsLeft <= 3) return {label:`${minsLeft}m left`, state:"ATRISK", ms:rem};
    return {label:`${minsLeft}m left`, state:"ONTRACK", ms:rem};
  }
  function slaRemainingDept(c){
    if(!c.slaStartedAtDept) return {label:"Not started", state:"NOTSTARTED", ms:null};
    const due = c.slaStartedAtDept + minutes(c.slaMinutesDept);
    const rem = due - now();
    const breached = rem <= 0;
    const minsLeft = Math.ceil(Math.abs(rem)/60000);
    if(breached) return {label:`BREACHED (${minsLeft}m)`, state:"BREACHED", ms:rem};
    if(minsLeft <= 5) return {label:`${minsLeft}m left`, state:"ATRISK", ms:rem};
    return {label:`${minsLeft}m left`, state:"ONTRACK", ms:rem};
  }

  function ownerLabel(c){
    if(c.assignedTo) return c.assignedTo;
    return c.ownerQueue;
  }

  function setActiveRecordTab(id){
    store.recordTabs.activeId = id;
    save(); render();
  }
  function closeRecordTab(id){
    const tab = store.recordTabs.items.find(t=>t.id===id);
    if(!tab) return;
    if(tab.pinned) return toast("Pinned tab", "Unpin before closing.");
    store.recordTabs.items = store.recordTabs.items.filter(t=>t.id!==id);
    if(store.recordTabs.activeId===id){
      store.recordTabs.activeId = store.recordTabs.items[0]?.id || null;
    }
    save(); render();
  }
  function togglePinRecordTab(id){
    const tab = store.recordTabs.items.find(t=>t.id===id);
    if(!tab) return;
    tab.pinned = !tab.pinned;
    save(); render();
  }

  function openCase(caseId){
    const c = store.cases.find(x=>x.id===caseId);
    if(!c) return;

    const existing = store.recordTabs.items.find(t=>t.key===caseId);
    if(existing){ setActiveRecordTab(existing.id); return; }

    const id = "case_" + caseId;
    store.recordTabs.items.push({id, key: caseId, label:`Case ${caseId}`, pinned:false});
    store.recordTabs.activeId = id;

    // SLA + attended behavior
    if(store.user.role==="SMT") startSlaOnOpen(c);
    if(store.user.role==="DEPT" && c.lane==="FORWARDED" && !c.slaStartedAtDept){
      c.slaStartedAtDept = now();
      c.lastDeptActivityAt = c.slaStartedAtDept;
    }

    save(); render();
  }

  function setActivePage(pageKey){
    store.pageTabs.active = pageKey;
    save(); render();
  }

  function applyCampaignOwners(){
    const cmps = store.admin?.campaigns || [];
    const map = new Map();
    cmps.forEach(c => { if(c.assignedTo) map.set(c.channel, c.assignedTo); });
    store.cases.forEach(cs => { cs.assignedTo = map.get(cs.channel) || null; });
  }

  function getFilteredCases(){
    const ui = store.ui;
    let cases = store.cases.slice().filter(c => c.status !== "Closed");

    if(ui.selectedChannel && ui.selectedChannel !== "All"){
      cases = cases.filter(c => c.channel === ui.selectedChannel);
    }
    if(ui.filterStatus && ui.filterStatus !== "All"){
      cases = cases.filter(c => c.status === ui.filterStatus);
    }
    if(ui.filterPriority && ui.filterPriority !== "All"){
      cases = cases.filter(c => (c.priority || "—") === ui.filterPriority);
    }
    if(ui.filterCategory && ui.filterCategory !== "All"){
      cases = cases.filter(c => (c.category || "—") === ui.filterCategory);
    }
    if(ui.filterSla && ui.filterSla !== "All"){
      const match = (c) => {
        const s = c.lane==="FORWARDED" ? slaRemainingDept(c) : slaRemainingSM(c);
        return s.state === ui.filterSla;
      };
      cases = cases.filter(match);
    }

    const q = (ui.search || "").trim().toLowerCase();
    if(q){
      cases = cases.filter(c => (
        c.id.toLowerCase().includes(q) ||
        (c.handle||"").toLowerCase().includes(q) ||
        (c.subject||"").toLowerCase().includes(q) ||
        (c.message||"").toLowerCase().includes(q)
      ));
    }
    return cases;
  }

  function sortSm(cases){
    // Manager rule: unattended stay brown; once SM acts -> BLUE should sink; customer reply -> YELLOW rises.
    const group = (c) => (c.state==="YELLOW") ? 0 : (c.state==="BROWN") ? 1 : 2; // BLUE last
    return cases.slice().sort((a,b)=>{
      const ga=group(a), gb=group(b);
      if(ga!==gb) return ga-gb;
      if(ga===0) return (b.lastCustomerActivityAt||0) - (a.lastCustomerActivityAt||0); // newest customer reply first
      if(ga===1) return (b.createdAt||0) - (a.createdAt||0); // newest unattended first
      // BLUE bottom: oldest last activity first, to "drop down"
      return (a.lastActivityAt||0) - (b.lastActivityAt||0);
    });
  }

  function sortForwarded(cases){
    // ORANGE top (internal dept update), then YELLOW (customer reply while forwarded), then VIOLET bottom.
    const group = (c) => (c.state==="ORANGE") ? 0 : (c.state==="YELLOW") ? 1 : 2; // VIOLET last
    return cases.slice().sort((a,b)=>{
      const ga=group(a), gb=group(b);
      if(ga!==gb) return ga-gb;
      if(ga===0) return (b.lastDeptActivityAt||0) - (a.lastDeptActivityAt||0);
      if(ga===1) return (b.lastCustomerActivityAt||0) - (a.lastCustomerActivityAt||0);
      // VIOLET bottom: oldest forward first
      return (a.lastActivityAt||0) - (b.lastActivityAt||0);
    });
  }

  function filterSelect(label, id, options, value){
    return `
      <div>
        <label class="small">${escapeHtml(label)}</label>
        <select id="${id}">
          ${options.map(o => `<option ${o===value?'selected':''}>${escapeHtml(o)}</option>`).join("")}
        </select>
      </div>
    `;
  }
  function filterText(label, id, value, placeholder){
    return `
      <div>
        <label class="small">${escapeHtml(label)}</label>
        <input type="text" id="${id}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"/>
      </div>
    `;
  }

  function renderCaseCard(c, lane="SM"){
    const sla = lane==="FORWARDED" ? slaRemainingDept(c) : slaRemainingSM(c);
    const slaClass = sla.state==="BREACHED" ? "bad" : (sla.state==="ATRISK" ? "warn" : "");
    const last = lane==="FORWARDED" ? relTime(c.lastActivityAt) : relTime(c.lastActivityAt);
    return `
      <div class="caseCard" data-open-case="${escapeHtml(c.id)}">
        <div class="caseTop">
          <div class="badge ${stateBadgeClass(c.state)}">${escapeHtml(c.state)}</div>
          <div class="slaPill ${slaClass}">${escapeHtml(sla.label)} • ${escapeHtml(last)}</div>
        </div>
        <div class="caseTitle">${escapeHtml(c.handle)} • ${escapeHtml(c.subject)}</div>
        <div class="caseMeta">
          <span>Case: ${escapeHtml(c.id)}</span>
          <span>Channel: ${escapeHtml(c.channel)}</span>
          <span>Status: ${escapeHtml(c.status)}</span>
          <span>Owner: ${escapeHtml(ownerLabel(c))}</span>
          <span>Priority: ${escapeHtml(c.priority || "—")}</span>
        </div>
      </div>
    `;
  }

  function renderDashboard(){
    const ui = store.ui;
    const all = getFilteredCases();

    const smCases = sortSm(all.filter(c => c.lane==="SM" && ["BROWN","BLUE","YELLOW"].includes(c.state)));
    const fwdCases = sortForwarded(all.filter(c => c.lane==="FORWARDED" && ["VIOLET","YELLOW","ORANGE"].includes(c.state)));

    const channels = ["All"].concat(enums.channels);

    return `
      <div class="container">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap">
          <div>
            <div class="h1">Social Media Dashboard</div>
            <div class="muted">Aligned with doc: omnichannel capture → Case → classify → route → close. Sorting/Colors match manager rules.</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" id="newCaseBtn">+ New Dummy Case</button>
            <button class="btn primary" data-open-page="sla">SLA & Escalations</button>
          </div>
        </div>

        <div style="height:12px"></div>

        <div class="card pad">
          <div style="font-weight:950">Filters</div>
          <div class="filters">
            ${filterSelect("Channel","channelSel", channels, ui.selectedChannel || "All")}
            ${filterSelect("Status","statusSel", ["All"].concat(enums.status.filter(s=>s!=="Closed")), ui.filterStatus || "All")}
            ${filterSelect("Priority","prioritySel", ["All"].concat(enums.priority), ui.filterPriority || "All")}
            ${filterSelect("SLA","slaSel", ["All","ONTRACK","ATRISK","BREACHED","NOTSTARTED"], ui.filterSla || "All")}
            ${filterSelect("Category","categorySel", ["All"].concat(enums.category), ui.filterCategory || "All")}
            ${filterText("Search","searchTxt", ui.search || "", "id / handle / subject / text")}
          </div>
        </div>

        <div style="height:12px"></div>

        <div class="grid3">
          <div class="card pad">
            <div style="font-weight:950">Channels</div>
            <div class="list" id="channelList">
              ${channels.map(ch => `
                <div class="listItem ${ (ui.selectedChannel||"All")===ch ? "selected" : "" }" data-channel="${escapeHtml(ch)}">
                  ${escapeHtml(ch)}
                </div>
              `).join("")}
            </div>
            <hr class="sep"/>
            <div class="small">
              Color rules:
              <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap">
                <span class="badge brown">BROWN</span>
                <span class="badge blue">BLUE</span>
                <span class="badge yellow">YELLOW</span>
                <span class="badge violet">VIOLET</span>
                <span class="badge orange">ORANGE</span>
              </div>
              <div class="small muted" style="margin-top:8px">Shortcuts: <span class="kbd">Ctrl</span>+<span class="kbd">K</span> search • <span class="kbd">Ctrl</span>+<span class="kbd">W</span> close tab</div>
            </div>
          </div>

          <div class="card pad">
            <div style="font-weight:950">SM Case List</div>
            <div class="small muted">Order: YELLOW (customer replied) → BROWN (unattended) → BLUE (in-progress, sinks)</div>
            <div style="height:10px"></div>
            <div class="list" id="caseList">
              ${smCases.length ? smCases.slice(0,24).map(c=>renderCaseCard(c,"SM")).join("") : `<div class="small muted">No cases match filters.</div>`}
            </div>
          </div>

          <div class="card pad">
            <div style="font-weight:950">Forwarded / Updated</div>
            <div class="small muted">Order: ORANGE (dept update) → YELLOW (customer during forwarded) → VIOLET (awaiting)</div>
            <div style="height:10px"></div>
            <div class="list" id="rightList">
              ${fwdCases.length ? fwdCases.slice(0,24).map(c=>renderCaseCard(c,"FORWARDED")).join("") : `<div class="small muted">No forwarded/updated cases.</div>`}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderDeptQueue(){
    const dept = store.ui.deptName || "Refunds";
    const all = getFilteredCases();
    const deptCases = sortForwarded(all.filter(c => c.lane==="FORWARDED" && (c.department||"Refunds")===dept));

    return `
      <div class="container">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap">
          <div>
            <div class="h1">Department Queue • ${escapeHtml(dept)}</div>
            <div class="muted">Dept can add investigation update (ORANGE) and close (with notes).</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" data-open-page="dashboard">Back</button>
          </div>
        </div>

        <div style="height:12px"></div>

        <div class="grid2">
          <div class="card pad">
            <div style="font-weight:950">${escapeHtml(dept)} Cases</div>
            <div class="small muted" style="margin-bottom:10px">Click a case to open it.</div>
            <div class="list">
              ${deptCases.length ? deptCases.map(c => `
                <div class="listItem" data-open-case="${c.id}">
                  <strong>${escapeHtml(c.id)}</strong> • ${escapeHtml(c.subject)}
                  <div class="small muted">State ${escapeHtml(c.state)} • ${escapeHtml(relTime(c.lastActivityAt))}</div>
                </div>
              `).join("") : `<div class="small muted">No cases for this department.</div>`}
            </div>
          </div>

          <div class="card pad">
            <div style="font-weight:950">Department rules</div>
            <div class="small">
              <ul>
                <li>Open a VIOLET case → Dept SLA starts.</li>
                <li>Add update → case becomes ORANGE and climbs to top for SMT.</li>
                <li>Customer replies while forwarded → stays forwarded and becomes YELLOW.</li>
                <li>Dept close requires Resolution Notes + Closure Code.</li>
              </ul>
            </div>
            <hr class="sep"/>
            <div class="small muted">Role now: <strong>${escapeHtml(store.user.role)}</strong> (switch top right).</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSla(){
    const active = store.cases.filter(c => c.status !== "Closed");
    const stats = {ONTRACK:0, ATRISK:0, BREACHED:0, NOTSTARTED:0};
    active.forEach(c => {
      const s = c.lane==="FORWARDED" ? slaRemainingDept(c) : slaRemainingSM(c);
      stats[s.state] = (stats[s.state]||0) + 1;
    });

    const rows = active
      .slice()
      .sort((a,b)=>{
        const sa = a.lane==="FORWARDED" ? slaRemainingDept(a).ms : slaRemainingSM(a).ms;
        const sb = b.lane==="FORWARDED" ? slaRemainingDept(b).ms : slaRemainingSM(b).ms;
        return (sa ?? 1e15) - (sb ?? 1e15);
      })
      .slice(0,25);

    return `
      <div class="container">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap">
          <div>
            <div class="h1">SLA & Escalations</div>
            <div class="muted">Visual indicators: ONTRACK / ATRISK / BREACHED. Breach generates notification.</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" data-open-page="dashboard">Back</button>
          </div>
        </div>

        <div style="height:12px"></div>

        <div class="grid2">
          <div class="card pad">
            <div style="font-weight:950">KPIs</div>
            <div class="list" style="margin-top:10px">
              <div class="listItem" style="cursor:default"><strong>On Track</strong> — ${stats.ONTRACK||0}</div>
              <div class="listItem" style="cursor:default"><strong>At Risk</strong> — ${stats.ATRISK||0}</div>
              <div class="listItem" style="cursor:default"><strong>Breached</strong> — ${stats.BREACHED||0}</div>
              <div class="listItem" style="cursor:default"><strong>Not Started</strong> — ${stats.NOTSTARTED||0}</div>
            </div>
          </div>

          <div class="card pad">
            <div style="font-weight:950">Worst SLA (Top 25)</div>
            <table style="margin-top:10px">
              <thead><tr><th>Case</th><th>Lane</th><th>State</th><th>SLA</th></tr></thead>
              <tbody>
                ${rows.map(c => {
                  const s = c.lane==="FORWARDED" ? slaRemainingDept(c) : slaRemainingSM(c);
                  return `<tr class="trClick" data-open-case="${escapeHtml(c.id)}">
                    <td>${escapeHtml(c.id)}</td>
                    <td>${escapeHtml(c.lane)}</td>
                    <td>${escapeHtml(c.state)}</td>
                    <td>${escapeHtml(s.label)}</td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderReports(){
    const active = store.cases.filter(c=>c.status!=="Closed");
    const byChannel = {};
    active.forEach(c => byChannel[c.channel] = (byChannel[c.channel]||0) + 1);
    const rows = Object.entries(byChannel).sort((a,b)=>b[1]-a[1]);

    return `
      <div class="container">
        <div class="h1">Reports</div>
        <div class="muted">High-level metrics for management. (Demo data)</div>
        <div style="height:12px"></div>

        <div class="grid2">
          <div class="card pad">
            <div style="font-weight:950">Cases by Channel</div>
            <table style="margin-top:10px">
              <thead><tr><th>Channel</th><th>Active Cases</th></tr></thead>
              <tbody>
                ${rows.map(([ch,count])=> `<tr><td>${escapeHtml(ch)}</td><td>${count}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
          <div class="card pad">
            <div style="font-weight:950">Lifecycle (from doc)</div>
            <div class="small" style="margin-top:8px">
              New – Unclassified → In-Progress → Assigned to Department → Returned to SMT → Escalated → Closed
            </div>
            <div class="callout">
              This is a UI prototype. In Salesforce, these would map to Case fields, queues, and permission sets.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAdmin(){
    const campaigns = store.admin.campaigns || [];
    return `
      <div class="container">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap">
          <div>
            <div class="h1">Admin</div>
            <div class="muted">Assign/remove/reassign users for campaigns. Owner label updates across dashboard.</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" id="resetBtn">Reset Demo Data</button>
          </div>
        </div>

        <div style="height:12px"></div>

        <div class="grid2">
          <div class="card pad">
            <div style="font-weight:950">Campaign User Assignment</div>
            <div class="small muted">This implements manager feedback: not always queue owner.</div>

            <table style="margin-top:10px">
              <thead><tr><th>Campaign</th><th>Channel</th><th>Assigned User</th><th>Actions</th></tr></thead>
              <tbody>
                ${campaigns.map(cmp => `
                  <tr>
                    <td><strong>${escapeHtml(cmp.id)}</strong> • ${escapeHtml(cmp.name)}</td>
                    <td>${escapeHtml(cmp.channel)}</td>
                    <td>${escapeHtml(cmp.assignedTo || "—")}</td>
                    <td style="width:360px">
                      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
                        <select data-cmp-sel="${escapeHtml(cmp.id)}" style="width:240px; padding:8px 10px">
                          <option value="">— Unassigned —</option>
                          ${enums.users.map(u => `<option value="${escapeHtml(u)}" ${u===cmp.assignedTo?'selected':''}>${escapeHtml(u)}</option>`).join("")}
                        </select>
                        <button class="btn primary" data-cmp-assign="${escapeHtml(cmp.id)}">Save</button>
                        <button class="btn" data-cmp-remove="${escapeHtml(cmp.id)}">Remove</button>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <hr class="sep"/>
            <div class="small muted">
              Demo mapping: Campaign.channel → Case.channel. In real Salesforce: Custom Metadata / Assignment Rules / Omni-Channel routing.
            </div>
          </div>

          <div class="card pad">
            <div style="font-weight:950">Notifications & SLA</div>
            <div class="small">
              <ul>
                <li>Bell icon shows SLA breaches, dept updates, customer replies.</li>
                <li>Supervisor role can view SLA tab and dashboards.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderCaseRecord(caseId){
    const c = store.cases.find(x=>x.id===caseId);
    if(!c) return `<div class="container"><div class="card pad"><div class="h1">Case not found</div></div></div>`;

    const role = store.user.role;
    const isSMT = role==="SMT";
    const isDept = role==="DEPT";

    const sla = c.lane==="FORWARDED" ? slaRemainingDept(c) : slaRemainingSM(c);
    const slaClass = sla.state==="BREACHED" ? "bad" : (sla.state==="ATRISK" ? "warn" : "");

    const internalBanner = (c.state==="ORANGE") ? `
      <div class="banner">
        <div class="bannerTitle">Internal Department Update Received</div>
        <div class="bannerSub">Per manager rule: case is ORANGE and should climb to top for SMT action.</div>
      </div>` : "";

    return `
      <div class="container">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap">
          <div>
            <div class="h1">Case ${escapeHtml(c.id)} • ${escapeHtml(c.channel)} • ${escapeHtml(c.handle)}</div>
            <div class="hl">
              <div class="hlItem">State: <span class="badge ${stateBadgeClass(c.state)}">${escapeHtml(c.state)}</span></div>
              <div class="hlItem">Status: <strong>${escapeHtml(c.status)}</strong></div>
              <div class="hlItem">Lane: <strong>${escapeHtml(c.lane)}</strong></div>
              <div class="hlItem">Owner: <strong>${escapeHtml(ownerLabel(c))}</strong></div>
              <div class="hlItem">Captured: <strong>${escapeHtml(relTime(c.capturedAt))}</strong></div>
              <div class="hlItem"><span class="slaPill ${slaClass}" style="display:inline-block">SLA: <strong>${escapeHtml(sla.label)}</strong></span></div>
            </div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" id="simCustomerBtn">Simulate Customer Reply</button>
            <button class="btn" id="copyBtn">Copy Case ID</button>
            <button class="btn" id="backDashBtn">Back</button>
          </div>
        </div>

        <div style="height:12px"></div>
        ${internalBanner}

        <div class="grid2">
          <div class="card pad">
            <div style="font-weight:950">Original Post / Capture Metadata</div>
            <div class="small muted" style="margin-top:6px">Link is a placeholder to demonstrate the requirement: “link to original post”.</div>
            <div class="small" style="margin-top:8px">
              <div><strong>Post ID:</strong> ${escapeHtml(c.originalPostId)}</div>
              <div><strong>URL:</strong> <a href="${escapeHtml(c.originalPostUrl)}" target="_blank" rel="noopener">${escapeHtml(c.originalPostUrl)}</a></div>
              <div><strong>Handle:</strong> ${escapeHtml(c.handle)} • <strong>Name:</strong> ${escapeHtml(c.customerName)}</div>
            </div>
            <hr class="sep"/>

            <div style="font-weight:950">Conversation</div>
            <hr class="sep"/>

            ${c.thread.map(item => `
              <div class="threadItem">
                <div class="who">${escapeHtml(item.who)} ${item.kind==="dept" ? "• Internal" : ""}</div>
                <div style="margin-top:6px">${escapeHtml(item.text)}</div>
                <div class="when">${escapeHtml(fmtTime(item.at))} • ${escapeHtml(relTime(item.at))}</div>
              </div>
            `).join("")}

            <hr class="sep"/>
            <div style="font-weight:950">Compose</div>

            ${isSMT ? `
              <label class="small" style="display:block; margin:10px 0 6px">Reply Template</label>
              <select id="tplSel">
                <option value="">— Select template —</option>
                ${enums.templates.map((t,i)=>`<option value="${i}">${escapeHtml(t.replace("{name}", c.customerName))}</option>`).join("")}
              </select>
            ` : ``}

            <textarea id="msgTxt" placeholder="${isSMT ? "SMT reply to customer…" : isDept ? "Dept internal update…" : "View only"}" ${(!isSMT && !isDept) ? "disabled" : ""}></textarea>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px">
              <button class="btn primary" id="sendBtn" ${(!isSMT && !isDept) ? "disabled" : ""}>${isSMT ? "Send Reply" : "Add Internal Update"}</button>
              <button class="btn" id="noteBtn" ${(!isSMT && !isDept) ? "disabled" : ""}>Add Internal Note</button>
            </div>
          </div>

          <div class="card pad">
            <div style="font-weight:950">Classification</div>

            <label class="small" style="display:block; margin:10px 0 6px">Case Type</label>
            <select id="typeSel">
              <option value="">—</option>
              ${enums.caseType.map(o => `<option value="${escapeHtml(o)}" ${o===(c.type||"")?'selected':''}>${escapeHtml(o)}</option>`).join("")}
            </select>

            <label class="small" style="display:block; margin:10px 0 6px">Category</label>
            <select id="catSel">
              <option value="">—</option>
              ${enums.category.map(o => `<option value="${escapeHtml(o)}" ${o===(c.category||"")?'selected':''}>${escapeHtml(o)}</option>`).join("")}
            </select>

            <label class="small" style="display:block; margin:10px 0 6px">Priority</label>
            <select id="priSel">
              <option value="">—</option>
              ${enums.priority.map(o => `<option value="${escapeHtml(o)}" ${o===(c.priority||"")?'selected':''}>${escapeHtml(o)}</option>`).join("")}
            </select>

            <label class="small" style="display:block; margin:10px 0 6px">Department (if forwarding)</label>
            <select id="deptSel">
              <option value="">—</option>
              ${enums.dept.map(o => `<option value="${escapeHtml(o)}" ${o===(c.department||"")?'selected':''}>${escapeHtml(o)}</option>`).join("")}
            </select>

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px">
              <button class="btn" id="saveClassBtn">Save</button>
              <button class="btn primary" id="routeBtn" ${(!isSMT) ? "disabled" : ""}>Forward to Dept</button>
              <button class="btn" id="escalateBtn" ${(!isSMT) ? "disabled" : ""}>Escalate</button>
              <button class="btn danger" id="closeBtn" ${((!isSMT && !isDept)) ? "disabled" : ""}>Close</button>
            </div>

            <hr class="sep"/>
            <div style="font-weight:950">Close (Dept requires notes)</div>
            <label class="small" style="display:block; margin:10px 0 6px">Resolution Notes ${isDept ? "*" : ""}</label>
            <textarea id="resNotes" ${isDept ? "" : "disabled"} placeholder="Required for Dept close…">${escapeHtml(c.resolutionNotes || "")}</textarea>

            <label class="small" style="display:block; margin:10px 0 6px">Closure Code</label>
            <select id="closureSel">
              ${["—","Resolved","No Response","Duplicate","Invalid"].map(o => `<option ${o===(c.closureCode||"—")?'selected':''}>${escapeHtml(o)}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  function renderTopTabs(){
    const tabs = [
      {key:"dashboard", label:"Dashboard", icon:"D"},
      {key:"deptQueue", label:"Dept Queue", icon:"Q"},
      {key:"sla", label:"SLA", icon:"S"},
      {key:"reports", label:"Reports", icon:"R"},
      {key:"admin", label:"Admin", icon:"A"}
    ];
    return `
      <ul class="slds-tabs_scoped__nav" role="tablist" aria-label="Tabs">
        ${tabs.map(t => `
          <li class="slds-tabs_scoped__item ${store.pageTabs.active===t.key?'slds-is-active':''}" role="presentation" data-page="${t.key}">
            <a class="slds-tabs_scoped__link" role="tab" href="javascript:void(0)" aria-selected="${store.pageTabs.active===t.key?'true':'false'}">
              <span class="tabIcon">${escapeHtml(t.icon)}</span>
              ${escapeHtml(t.label)}
            </a>
          </li>
        `).join("")}
      </ul>
    `;
  }

  function renderRecordTabs(){
    const items = store.recordTabs.items || [];
    const activeId = store.recordTabs.activeId;
    if(!items.length){
      return `<div class="recordTabBar"><div class="small">No record tabs open. Open a case from Dashboard/Queues.</div><div style="flex:1"></div></div>`;
    }
    return `
      <div class="recordTabBar">
        <div class="recordStrip">
          ${items.map(t => {
            const c = store.cases.find(x=>x.id===t.key);
            const meta = c ? `${c.channel} • ${c.state}` : "Case";
            const active = t.id===activeId ? "active" : "";
            const pinned = t.pinned ? "pinned" : "";
            const closeBtn = t.pinned ? "" : `<div class="x" data-rt-close="${escapeHtml(t.id)}" title="Close">✕</div>`;
            return `
              <div class="rtab ${active} ${pinned}" data-rt-activate="${escapeHtml(t.id)}">
                <div class="lbl">${escapeHtml(t.label)}</div>
                <div class="meta">${escapeHtml(meta)}</div>
                <div class="pin" data-rt-pin="${escapeHtml(t.id)}" title="${t.pinned?'Unpin':'Pin'}">📌</div>
                ${closeBtn}
              </div>
            `;
          }).join("")}
        </div>
        <button class="btn" id="closeOthersBtn">Close Others</button>
      </div>
    `;
  }

  function renderNotificationsDrawer(){
    const items = store.notifications || [];
    const unread = unreadCount();
    return `
      <div class="drawerOverlay" id="drawerOverlay"></div>
      <div class="drawer" role="dialog" aria-label="Notifications">
        <div class="drawerHead">
          <div>
            <div style="font-weight:950">Notifications</div>
            <div class="small muted">${unread} unread • newest first</div>
          </div>
          <div style="display:flex; gap:8px">
            <button class="btn" id="markAllReadBtn">Mark all read</button>
            <button class="btn" id="closeDrawerBtn">Close</button>
          </div>
        </div>
        <div class="drawerBody">
          ${items.length ? items.map(n => `
            <div class="drawerItem" data-notif="${escapeHtml(n.id)}">
              <strong>${escapeHtml(n.title)} ${n.read ? "" : "•"}</strong>
              <div class="small muted" style="margin-top:4px">${escapeHtml(relTime(n.at))}</div>
              <div style="margin-top:6px">${escapeHtml(n.details)}</div>
              ${n.caseId ? `<div class="small" style="margin-top:6px"><a href="javascript:void(0)" data-open-case="${escapeHtml(n.caseId)}">Open case ${escapeHtml(n.caseId)}</a></div>` : ""}
            </div>
          `).join("") : `<div class="small muted">No notifications yet.</div>`}
        </div>
      </div>
    `;
  }

  function render(){
    applyCampaignOwners();

    const activeRecordId = store.recordTabs.activeId;
    const activeRecordTab = store.recordTabs.items.find(t=>t.id===activeRecordId) || null;

    const unread = unreadCount();

    document.body.innerHTML = `
      <div class="topbar">
        <div class="topbarRow">
          <div class="brand">
            <div class="logo">SF</div>
            <div>
              <div class="brandTitle">Social Media Console</div>
              <div class="brandSub">Prototype v3 • realistic navigation for Salesforce build</div>
            </div>
          </div>

          <div class="actions">
            <div class="pill">User: <strong>${escapeHtml(store.user.name)}</strong></div>
            <div class="pill">Role:
              <select id="roleSel" style="width:auto; padding:6px 10px; margin-left:6px">
                ${enums.roles.map(r => `<option ${r===store.user.role?'selected':''}>${r}</option>`).join("")}
              </select>
            </div>
            <button class="iconBtn" id="bellBtn" title="Notifications">
              🔔
              ${unread ? `<span class="dot"></span>` : ``}
            </button>
            <button class="btn" id="helpBtn">Help</button>
          </div>
        </div>
        ${renderTopTabs()}
      </div>

      ${renderRecordTabs()}

      <div id="content">
        ${activeRecordTab ? renderCaseRecord(activeRecordTab.key) :
          (store.pageTabs.active==="dashboard" ? renderDashboard() :
           store.pageTabs.active==="deptQueue" ? renderDeptQueue() :
           store.pageTabs.active==="sla" ? renderSla() :
           store.pageTabs.active==="reports" ? renderReports() : renderAdmin())}
      </div>

      ${store.ui.notificationsOpen ? renderNotificationsDrawer() : ""}
    `;

    bind(activeRecordTab);
  }

  function bind(activeRecordTab){
    $("#roleSel").addEventListener("change", () => {
      store.user.role = $("#roleSel").value;
      save(); render(); toast("Role changed", store.user.role);
    });

    $("#helpBtn").addEventListener("click", () => {
      alert([
        "How to use this prototype:",
        "1) Dashboard: click any case to open in a record tab.",
        "2) Role switcher: SMT vs DEPT changes available actions.",
        "3) Manager sorting:",
        "   - SM list: YELLOW then BROWN then BLUE (BLUE sinks).",
        "   - Forwarded/Updated: ORANGE then YELLOW then VIOLET.",
        "4) Notifications (bell): SLA breach + dept update + customer reply.",
        "",
        "Shortcuts:",
        "Ctrl+1..9 switch record tabs",
        "Ctrl+W close active record tab (if not pinned)",
        "Ctrl+Shift+P pin/unpin active record tab",
        "Ctrl+K focus search (Dashboard, when no record tab active)"
      ].join("\n"));
    });

    $("#bellBtn").addEventListener("click", () => {
      store.ui.notificationsOpen = true;
      save(); render();
    });

    $$("[data-page]").forEach(li => li.addEventListener("click", () => setActivePage(li.dataset.page)));
    $$("[data-open-page]").forEach(btn => btn.addEventListener("click", () => setActivePage(btn.dataset.openPage)));

    $$("[data-rt-activate]").forEach(el => el.addEventListener("click", (e) => {
      if(e.target.closest("[data-rt-close]") || e.target.closest("[data-rt-pin]")) return;
      setActiveRecordTab(el.dataset.rtActivate);
    }));
    $$("[data-rt-close]").forEach(el => el.addEventListener("click", (e) => { e.stopPropagation(); closeRecordTab(el.dataset.rtClose); }));
    $$("[data-rt-pin]").forEach(el => el.addEventListener("click", (e) => { e.stopPropagation(); togglePinRecordTab(el.dataset.rtPin); }));

    const closeOthersBtn = $("#closeOthersBtn");
    if(closeOthersBtn){
      closeOthersBtn.addEventListener("click", () => {
        const keep = new Set();
        store.recordTabs.items.forEach(t => { if(t.pinned || t.id===store.recordTabs.activeId) keep.add(t.id); });
        store.recordTabs.items = store.recordTabs.items.filter(t => keep.has(t.id));
        save(); render(); toast("Closed other record tabs", "Kept pinned + active.");
      });
    }

    window.onkeydown = (e) => {
      if(e.ctrlKey && !e.shiftKey && /^[1-9]$/.test(e.key)){
        const idx = Number(e.key) - 1;
        const t = store.recordTabs.items[idx];
        if(t){ e.preventDefault(); setActiveRecordTab(t.id); }
      }
      if(e.ctrlKey && e.key.toLowerCase()==="w"){
        if(store.recordTabs.activeId){
          e.preventDefault(); closeRecordTab(store.recordTabs.activeId);
        }
      }
      if(e.ctrlKey && e.shiftKey && e.key.toLowerCase()==="p"){
        if(store.recordTabs.activeId){
          e.preventDefault(); togglePinRecordTab(store.recordTabs.activeId);
        }
      }
      if(e.ctrlKey && e.key.toLowerCase()==="k"){
        if(!store.recordTabs.activeId && store.pageTabs.active==="dashboard"){
          const s = $("#searchTxt");
          if(s){ e.preventDefault(); s.focus(); s.select(); }
        }
      }
      if(e.key==="Escape" && store.ui.notificationsOpen){
        store.ui.notificationsOpen = false;
        save(); render();
      }
    };

    // drawer actions
    if(store.ui.notificationsOpen){
      $("#drawerOverlay").addEventListener("click", () => { store.ui.notificationsOpen=false; save(); render(); });
      $("#closeDrawerBtn").addEventListener("click", () => { store.ui.notificationsOpen=false; save(); render(); });
      $("#markAllReadBtn").addEventListener("click", () => {
        (store.notifications||[]).forEach(n=> n.read=true);
        save(); render(); toast("Marked all read");
      });
      $$("[data-notif]").forEach(el => el.addEventListener("click", () => {
        const id = el.dataset.notif;
        const n = store.notifications.find(x=>x.id===id);
        if(n){ n.read=true; save(); render(); }
      }));
    }

    // common open-case bind (also in notifications drawer)
    $$("[data-open-case]").forEach(el => el.addEventListener("click", () => openCase(el.dataset.openCase)));

    if(!activeRecordTab){
      if(store.pageTabs.active==="dashboard") bindDashboard();
      if(store.pageTabs.active==="admin") bindAdmin();
    }else{
      bindCase(activeRecordTab.key);
    }
  }

  function bindDashboard(){
    const ui = store.ui;
    const wire = (id, cb) => { const el = $("#"+id); if(el) el.addEventListener("input", cb); if(el) el.addEventListener("change", cb); };
    wire("channelSel", () => { ui.selectedChannel = $("#channelSel").value; save(); render(); });
    wire("statusSel", () => { ui.filterStatus = $("#statusSel").value; save(); render(); });
    wire("prioritySel", () => { ui.filterPriority = $("#prioritySel").value; save(); render(); });
    wire("slaSel", () => { ui.filterSla = $("#slaSel").value; save(); render(); });
    wire("categorySel", () => { ui.filterCategory = $("#categorySel").value; save(); render(); });
    wire("searchTxt", () => { ui.search = $("#searchTxt").value; save(); render(); });

    $$("[data-channel]").forEach(el => el.addEventListener("click", () => { ui.selectedChannel = el.dataset.channel; save(); render(); }));

    const newBtn = $("#newCaseBtn");
    if(newBtn) newBtn.addEventListener("click", () => {
      const id = "00013" + String(Math.floor(100 + Math.random()*900));
      const ch = enums.channels[Math.floor(Math.random()*enums.channels.length)];
      const subj = ["Need help ASAP","Complaint about staff","Flight delayed","Refund query","Lost baggage"][Math.floor(Math.random()*5)];
      const msg = "Dummy inbound message: " + subj + ". Please assist.";
      const created = now() - minutes(Math.floor(Math.random()*10));
      const postId = "POST-" + Math.floor(100000 + Math.random()*900000);
      const c = {
        id, channel: ch, handle:"@new_user", customerName:"New User", subject: subj, message: msg,
        originalPostUrl:`https://social.example/${ch.toLowerCase()}/${postId}`, originalPostId: postId,
        capturedAt: created, createdAt: created,
        lastActivityAt: created, lastCustomerActivityAt: created, lastSmActivityAt:null, lastDeptActivityAt:null,
        firstOpenedAt:null,
        slaStartedAtSM:null, slaMinutesSM: 15, slaStartedAtDept:null, slaMinutesDept: 60,
        state:"BROWN", status:"New – Unclassified", lane:"SM",
        ownerQueue: `${ch} Queue`, assignedTo:null,
        type:null, category:null, priority:null, department:null,
        escalation:false, closureCode:null, resolutionNotes:null,
        thread:[{who:"Customer", kind:"customer", text: msg, at: created}]
      };
      store.cases.unshift(c);
      pushNotif("new_case","New case captured", `${id} created from ${ch}.`, id);
      save(); render(); toast("New dummy case added", `Case ${id} in ${ch}.`);
    });
  }

  function bindAdmin(){
    const resetBtn = $("#resetBtn");
    if(resetBtn) resetBtn.addEventListener("click", () => {
      if(!confirm("Reset demo data?")) return;
      store = seedData();
      save(); render(); toast("Reset complete", "Demo data re-seeded.");
    });

    $$("[data-cmp-assign]").forEach(btn => btn.addEventListener("click", () => {
      const id = btn.dataset.cmpAssign;
      const sel = document.querySelector(`[data-cmp-sel="${id}"]`);
      const val = sel ? sel.value : "";
      const cmp = store.admin.campaigns.find(c => c.id===id);
      if(!cmp) return;
      cmp.assignedTo = val || null;
      pushNotif("campaign","Campaign assignment updated", `${cmp.name} → ${cmp.assignedTo || "Unassigned"}`);
      save(); render(); toast("Campaign updated", `${cmp.id} → ${cmp.assignedTo || "Unassigned"}`);
    }));

    $$("[data-cmp-remove]").forEach(btn => btn.addEventListener("click", () => {
      const id = btn.dataset.cmpRemove;
      const cmp = store.admin.campaigns.find(c => c.id===id);
      if(!cmp) return;
      cmp.assignedTo = null;
      pushNotif("campaign","Campaign assignment removed", `${cmp.name} is now Unassigned.`);
      save(); render(); toast("Removed assignment", cmp.id);
    }));
  }

  function applyCustomerReply(c, text){
    const t = now();
    c.thread.push({who:"Customer", kind:"customer", text, at: t});
    c.lastActivityAt = t;
    c.lastCustomerActivityAt = t;

    // If case is in progress anywhere, customer reply makes it YELLOW
    if(c.lane==="SM" && c.state==="BLUE") c.state = "YELLOW";
    if(c.lane==="FORWARDED" && (c.state==="VIOLET" || c.state==="ORANGE")) c.state = "YELLOW";

    pushNotif("customer_reply","Customer replied", `${c.id} received a new customer message.`, c.id);
  }

  function bindCase(caseId){
    const c = store.cases.find(x=>x.id===caseId);
    if(!c) return;

    const role = store.user.role;
    const isSMT = role==="SMT";
    const isDept = role==="DEPT";

    const back = $("#backDashBtn");
    if(back) back.addEventListener("click", () => {
      if(store.recordTabs.activeId){
        const t = store.recordTabs.items.find(x=>x.id===store.recordTabs.activeId);
        if(t && !t.pinned) closeRecordTab(t.id);
        else setActivePage("dashboard");
      } else setActivePage("dashboard");
    });

    const copyBtn = $("#copyBtn");
    if(copyBtn) copyBtn.addEventListener("click", async () => {
      try{ await navigator.clipboard.writeText(c.id); toast("Copied", c.id); }
      catch(e){ toast("Copy failed", "Browser blocked clipboard."); }
    });

    const simCustomerBtn = $("#simCustomerBtn");
    if(simCustomerBtn) simCustomerBtn.addEventListener("click", () => {
      applyCustomerReply(c, "Customer follow-up: Any update?");
      save(); render(); toast("Customer replied", `Case ${c.id} updated.`);
    });

    const tplSel = $("#tplSel");
    if(tplSel) tplSel.addEventListener("change", () => {
      const v = tplSel.value;
      if(v==="") return;
      const txt = enums.templates[Number(v)].replace("{name}", c.customerName);
      $("#msgTxt").value = txt;
    });

    const saveBtn = $("#saveClassBtn");
    if(saveBtn) saveBtn.addEventListener("click", () => {
      c.type = $("#typeSel").value || null;
      c.category = $("#catSel").value || null;
      c.priority = $("#priSel").value || null;
      c.department = $("#deptSel").value || null;

      c.lastActivityAt = now();
      if(isSMT) c.lastSmActivityAt = c.lastActivityAt;
      if(isDept) c.lastDeptActivityAt = c.lastActivityAt;

      save(); render();
      toast("Saved", "Classification updated.");
    });

    const sendBtn = $("#sendBtn");
    if(sendBtn) sendBtn.addEventListener("click", () => {
      const txt = ($("#msgTxt")?.value || "").trim();
      if(!txt) return toast("Nothing to send", "Type a message first.");

      if(isSMT){
        startSlaOnOpen(c); // ensure attended
        const t = now();
        c.thread.push({who:"SMT", kind:"sm", text: txt, at: t});
        c.lastActivityAt = t;
        c.lastSmActivityAt = t;

        // After SMT reply: case should be BLUE and sink to bottom (until customer replies)
        if(c.lane==="SM") c.state = "BLUE";
        if(c.lane==="FORWARDED"){
          // SMT replying while forwarded means it's being handled; keep in forwarded until moved back (demo)
          c.state = "VIOLET";
        }
        c.status = "In-Progress";

        $("#msgTxt").value = "";
        save(); render();
        toast("Sent (demo)", "Case will sink unless customer replies (YELLOW).");
      }else if(isDept){
        const t = now();
        if(!c.slaStartedAtDept) c.slaStartedAtDept = t;
        c.thread.push({who:(c.department || "Dept")+" Team", kind:"dept", text: txt, at: t});
        c.lastDeptActivityAt = t;
        c.lastActivityAt = t;

        c.state = "ORANGE";
        c.status = "Returned to SMT";
        c.lane = "FORWARDED";

        $("#msgTxt").value = "";
        pushNotif("dept_update","Dept updated case", `${c.id} received internal update.`, c.id);
        save(); render();
        toast("Internal update added", "Case turned ORANGE and moves to top.");
      }else{
        toast("Blocked", "Switch role to SMT or DEPT.");
      }
    });

    const noteBtn = $("#noteBtn");
    if(noteBtn) noteBtn.addEventListener("click", () => {
      const txt = ($("#msgTxt")?.value || "").trim();
      if(!txt) return toast("Nothing to add", "Type text first.");
      const t = now();
      c.thread.push({who:"Internal Note", kind:"note", text: txt, at: t});
      c.lastActivityAt = t;
      $("#msgTxt").value = "";
      save(); render();
      toast("Internal note added", `Case ${c.id}`);
    });

    const routeBtn = $("#routeBtn");
    if(routeBtn) routeBtn.addEventListener("click", () => {
      if(!isSMT) return toast("Blocked", "Only SMT can forward.");
      const dept = ($("#deptSel")?.value || "").trim() || "Refunds";
      c.department = dept;

      const t = now();
      startSlaOnOpen(c);
      c.state = "VIOLET";
      c.status = "Assigned to Department";
      c.lane = "FORWARDED";
      c.thread.push({who:"SMT", kind:"sm", text:`Forwarded to ${dept} team.`, at: t});
      c.lastActivityAt = t;
      c.lastSmActivityAt = t;

      pushNotif("forwarded","Case forwarded", `${c.id} forwarded to ${dept}.`, c.id);

      save(); render();
      setActivePage("deptQueue");
      toast("Forwarded", `${dept} Queue (VIOLET).`);
    });

    const escBtn = $("#escalateBtn");
    if(escBtn) escBtn.addEventListener("click", () => {
      if(!isSMT) return toast("Blocked", "Only SMT can escalate.");
      const t = now();
      startSlaOnOpen(c);
      c.escalation = true;
      c.status = "Escalated";
      c.lastActivityAt = t;
      c.lastSmActivityAt = t;
      pushNotif("escalation","Case escalated", `${c.id} escalated due to SLA/priority.`, c.id);
      save(); render();
      toast("Escalated", "Supervisor notified (demo).");
    });

    const closureSel = $("#closureSel");
    if(closureSel) closureSel.addEventListener("change", () => { c.closureCode = closureSel.value || null; save(); });

    const resNotes = $("#resNotes");
    if(resNotes) resNotes.addEventListener("input", () => { c.resolutionNotes = resNotes.value; save(); });

    const closeBtn = $("#closeBtn");
    if(closeBtn) closeBtn.addEventListener("click", () => {
      const closure = $("#closureSel").value;
      const notes = ($("#resNotes")?.value || "").trim();

      if(isDept){
        if(!closure || closure==="—") return toast("Blocked", "Dept must set Closure Code.");
        if(!notes) return toast("Blocked", "Dept must add Resolution Notes.");
      } else if(isSMT){
        if(!closure || closure==="—") return toast("Blocked", "Set Closure Code.");
      } else {
        return toast("Blocked", "Switch role to SMT or DEPT to close.");
      }

      const t = now();
      c.closureCode = closure;
      if(isDept) c.resolutionNotes = notes;
      c.status = "Closed";
      c.state = "CLOSED";
      c.lastActivityAt = t;

      pushNotif("closed","Case closed", `${c.id} closed with code: ${closure}.`, c.id);

      save(); render();
      toast("Closed", `Case ${c.id} closed.`);
      closeRecordTab("case_" + caseId);
    });
  }

  // SLA breach checker (demo)
  setInterval(() => {
    let changed = false;
    store.cases.forEach(c => {
      if(c.status==="Closed") return;
      const s = c.lane==="FORWARDED" ? slaRemainingDept(c) : slaRemainingSM(c);
      if(s.state==="BREACHED" && !c._breachNotified){
        c._breachNotified = true;
        pushNotif("sla_breach","SLA breached", `${c.id} breached SLA (${c.lane}).`, c.id);
        changed = true;
      }
    });
    if(changed) { save(); render(); }
  }, 15000);

  render();
})();
