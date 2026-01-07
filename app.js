(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const STORAGE_KEY = "sm_console_white_tabs_v1";
  const now = () => Date.now();
  const minutes = (m) => m*60*1000;

  const enums = {
    roles: ["SMT","DEPT","SUP","ADMIN"],
    channels: ["Facebook","Instagram","X","LinkedIn","Email"],
    caseType: ["Complaint","Query","Compliment","Feedback"],
    category: ["Refunds","Baggage","Bookings","Flight Experience","IROP","Ticketing","Care","Sales"],
    priority: ["Low","Medium","High","Critical"],
    dept: ["Refunds","Baggage","Ticketing","Care","Sales"],
    status: ["New","In-Progress","Assigned to Department","Returned to SMT","Escalated","Closed"]
  };

  function seedData(){
    const baseTime = now() - minutes(75);
    const mk = (i, channel, state, dept=null) => {
      const created = baseTime + minutes(i*5);
      const pri = ["Low","Medium","High","Critical"][i%4];
      const slaMin = pri==="Critical" ? 10 : pri==="High" ? 15 : pri==="Medium" ? 30 : 60;
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

      const status = state==="BROWN" ? "New" :
                     state==="GREEN" ? "In-Progress" :
                     state==="YELLOW" ? "Assigned to Department" :
                     state==="BLUE" ? "Returned to SMT" : "Closed";

      const owner = state==="YELLOW" ? (dept||"Refunds")+" Queue" : channel+" Queue";

      const c = {
        id: "00012" + String(600+i),
        channel,
        handle: ["@user_handle","@flyer99","@traveler_in","@foodie","@complaints","@pnr_help"][i%6],
        subject,
        message,
        createdAt: created,
        lastActivityAt: created + minutes(2),
        firstOpenedAt: null,
        slaStartMode: "click",
        slaMinutes: slaMin,
        state,
        status,
        owner,
        assignee: null,
        type: state==="BROWN" ? null : enums.caseType[i%enums.caseType.length],
        category: state==="BROWN" ? null : enums.category[i%enums.category.length],
        priority: state==="BROWN" ? null : pri,
        department: dept,
        escalation: state==="BLUE" && i%2===0,
        closureCode: null,
        resolutionNotes: null,
        deptUpdate: null,
        thread: [{who:"Customer", text: message, at: created}]
      };

      if(state==="GREEN"){
        c.thread.push({who:"SMT", text:"We’re checking. Please share your PNR in DM.", at: created+minutes(8)});
      }
      if(state==="YELLOW"){
        c.thread.push({who:"SMT", text:`Forwarded to ${dept||"Refunds"} team.`, at: created+minutes(10)});
      }
      if(state==="BLUE"){
        c.deptUpdate = {dept: dept||"Refunds", summary:"Update: processed; ETA 5–7 days.", at: created+minutes(30)};
        c.thread.push({who:(dept||"Refunds")+" Team", text:"Checked and initiated action. ETA 5–7 days.", at: c.deptUpdate.at});
      }
      return c;
    };

    const cases = [];
    for(let i=0;i<14;i++){
      const ch = enums.channels[i%4];
      const st = (i%7===0) ? "BLUE" : (i%5===0 ? "YELLOW" : (i%3===0 ? "GREEN" : "BROWN"));
      const dept = (st==="YELLOW"||st==="BLUE") ? enums.dept[i%enums.dept.length] : null;
      cases.push(mk(i, ch, st, dept));
    }

    return {
      version: 1,
      user: { role: "SMT", name: "Amit (Demo User)" },
      ui: {
        selectedChannel: "All",
        search: "",
        filterStatus: "All",
        filterPriority: "All",
        filterSla: "All",
        filterCategory: "All",
        dashboardTab: "New",
        rightTab: "Updated",
        deptName: "Refunds",
      },
      pageTabs: { active: "dashboard" },
      recordTabs: { activeId: null, items: [] },
      cases
    };
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return seedData();
      const data = JSON.parse(raw);
      if(!data || data.version !== 1) return seedData();
      if(!data.pageTabs) data.pageTabs = {active:"dashboard"};
      if(!data.recordTabs) data.recordTabs = {activeId:null, items:[]};
      return data;
    }catch(e){
      return seedData();
    }
  }

  let store = load();
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function relTime(ts){
    const diff = now() - ts;
    const m = Math.max(0, Math.round(diff/60000));
    if(m < 60) return `${m}m ago`;
    const h = Math.round(m/60);
    return `${h}h ago`;
  }

  function fmtTime(ts){
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${hh}:${mm}`;
  }

  function slaRemaining(c){
    const start = (c.slaStartMode === "click") ? (c.firstOpenedAt || null) : c.createdAt;
    if(!start) return {label:"Not started", state:"ONTRACK", ms:null};
    const due = start + minutes(c.slaMinutes);
    const rem = due - now();
    const breached = rem <= 0;
    const minsLeft = Math.ceil(Math.abs(rem)/60000);
    if(breached) return {label:`BREACHED (${minsLeft}m)`, state:"BREACHED", ms:rem};
    if(minsLeft <= 3) return {label:`${minsLeft}m left`, state:"ATRISK", ms:rem};
    return {label:`${minsLeft}m left`, state:"ONTRACK", ms:rem};
  }

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

  function stateBadgeClass(st){
    if(st==="BROWN") return "brown";
    if(st==="GREEN") return "green";
    if(st==="YELLOW") return "yellow";
    if(st==="BLUE") return "blue";
    if(st==="CLOSED") return "closed";
    return "";
  }

  function setActiveRecordTab(id){
    store.recordTabs.activeId = id;
    save();
    render();
  }

  function closeRecordTab(id){
    const tab = store.recordTabs.items.find(t=>t.id===id);
    if(!tab) return;
    if(tab.pinned) return toast("Pinned tab", "Unpin before closing.");
    store.recordTabs.items = store.recordTabs.items.filter(t=>t.id !== id);
    if(store.recordTabs.activeId === id){
      store.recordTabs.activeId = store.recordTabs.items[0]?.id || null;
    }
    save();
    render();
  }

  function togglePinRecordTab(id){
    const tab = store.recordTabs.items.find(t=>t.id===id);
    if(!tab) return;
    tab.pinned = !tab.pinned;
    save();
    render();
  }

  function openCase(caseId){
    const c = store.cases.find(x=>x.id===caseId);
    if(!c) return;
    const existing = store.recordTabs.items.find(t=>t.key===caseId);
    if(existing){
      setActiveRecordTab(existing.id);
      return;
    }
    const id = "case_" + caseId;
    store.recordTabs.items.push({id, key: caseId, label:`Case ${caseId}`, pinned:false});
    store.recordTabs.activeId = id;
    save();
    render();

    if(!c.firstOpenedAt){
      c.firstOpenedAt = now();
      c.lastActivityAt = now();
      save();
      toast("SLA started", `Case ${c.id} started on first open.`);
      render();
    }
  }

  function setActivePage(pageKey){
    store.pageTabs.active = pageKey;
    save();
    render();
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
      cases = cases.filter(c => slaRemaining(c).state === ui.filterSla);
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

  function renderCaseCard(c){
    const sla = slaRemaining(c);
    const slaClass = sla.state==="BREACHED" ? "bad" : (sla.state==="ATRISK" ? "warn" : "");
    return `
      <div class="caseCard" data-open-case="${escapeHtml(c.id)}">
        <div class="caseTop">
          <div class="badge ${stateBadgeClass(c.state)}">${escapeHtml(c.state)}</div>
          <div class="slaPill ${slaClass}">${escapeHtml(sla.label)}</div>
        </div>
        <div class="caseTitle">${escapeHtml(c.handle)} • ${escapeHtml(c.subject)}</div>
        <div class="caseMeta">
          <span>Case: ${escapeHtml(c.id)}</span>
          <span>Channel: ${escapeHtml(c.channel)}</span>
          <span>Status: ${escapeHtml(c.status)}</span>
          <span>Priority: ${escapeHtml(c.priority || "—")}</span>
          <span>Dept: ${escapeHtml(c.department || "—")}</span>
        </div>
      </div>
    `;
  }

  function renderCaseCardCompact(c){
    const msg = c.deptUpdate ? c.deptUpdate.summary : c.message;
    return `
      <div class="caseCard" data-open-case="${escapeHtml(c.id)}">
        <div class="caseTop">
          <div class="badge ${stateBadgeClass(c.state)}">${escapeHtml(c.state)}</div>
          <div class="slaPill">${escapeHtml(relTime(c.lastActivityAt))}</div>
        </div>
        <div class="caseTitle">${escapeHtml(c.id)} • ${escapeHtml(c.department || c.channel)}</div>
        <div class="caseMeta"><span>${escapeHtml(msg)}</span></div>
      </div>
    `;
  }

  function renderDashboard(){
    const ui = store.ui;
    const all = getFilteredCases();

    const tab = ui.dashboardTab || "New";
    const smCases = all.filter(c => {
      if(tab==="New") return c.state==="BROWN";
      if(tab==="In-Progress") return c.state==="GREEN";
      if(tab==="Mine") return c.assignee === store.user.name;
      return true;
    });

    const rightTab = ui.rightTab || "Updated";
    const rightCases = all.filter(c => rightTab==="Updated" ? c.state==="BLUE" : c.state==="YELLOW");

    const channels = ["All"].concat(enums.channels);

    return `
      <div class="container">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap">
          <div>
            <div class="h1">Dashboard</div>
            <div class="muted">Click any case to open a record tab (console behavior).</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" id="newCaseBtn">+ New Dummy Case</button>
            <button class="btn primary" data-open-page="sla">Open SLA</button>
          </div>
        </div>

        <div style="height:12px"></div>

        <div class="card pad">
          <div style="font-weight:950">Filters</div>
          <div class="filters">
            ${filterSelect("Channel","channelSel", channels, ui.selectedChannel || "All")}
            ${filterSelect("Status","statusSel", ["All"].concat(enums.status.filter(s=>s!=="Closed")), ui.filterStatus || "All")}
            ${filterSelect("Priority","prioritySel", ["All"].concat(enums.priority), ui.filterPriority || "All")}
            ${filterSelect("SLA","slaSel", ["All","ONTRACK","ATRISK","BREACHED"], ui.filterSla || "All")}
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
            <div class="small">Shortcuts: <span class="kbd">Ctrl</span>+<span class="kbd">K</span> focuses search. Record tabs: <span class="kbd">Ctrl</span>+<span class="kbd">W</span> close.</div>
          </div>

          <div class="card pad">
            <div style="font-weight:950">SM Case List</div>
            <div class="tabs" id="dashTabs">
              ${["New","In-Progress","Mine"].map(t => `<div class="tab ${t===tab?'active':''}" data-tab="${t}">${t}</div>`).join("")}
            </div>
            <div class="list" id="caseList">
              ${smCases.length ? smCases.slice(0,24).map(renderCaseCard).join("") : `<div class="small muted">No cases match filters.</div>`}
            </div>
            ${smCases.length>24 ? `<div class="small muted" style="margin-top:10px">Showing 24 of ${smCases.length} matching cases.</div>` : ``}
          </div>

          <div class="card pad">
            <div style="font-weight:950">Forwarded / Updated</div>
            <div class="tabs" id="rightTabs">
              ${["Updated","Forwarded"].map(t => `<div class="tab ${t===rightTab?'active':''}" data-righttab="${t}">${t}</div>`).join("")}
            </div>
            <div class="list" id="rightList">
              ${rightCases.length ? rightCases.slice(0,24).map(renderCaseCardCompact).join("") : `<div class="small muted">No cases.</div>`}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderDeptQueue(){
    const dept = store.ui.deptName || "Refunds";
    const all = getFilteredCases();
    const deptCases = all.filter(c => c.state==="YELLOW" && (c.department || "Refunds") === dept);

    return `
      <div class="container">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap">
          <div>
            <div class="h1">Department Queue • ${escapeHtml(dept)}</div>
            <div class="muted">Open a forwarded case → it becomes a record tab.</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" data-open-page="dashboard">Back to Dashboard</button>
          </div>
        </div>

        <div style="height:12px"></div>

        <div class="grid2">
          <div class="card pad">
            <div style="font-weight:950">${escapeHtml(dept)} Queue</div>
            <div class="small muted" style="margin-bottom:10px">Forwarded cases (yellow).</div>
            <div class="list">
              ${deptCases.length ? deptCases.map(c => `
                <div class="listItem" data-open-case="${c.id}">
                  <strong>${escapeHtml(c.id)}</strong> • ${escapeHtml(c.subject)}
                  <div class="small muted">From ${escapeHtml(c.channel)} • ${escapeHtml(relTime(c.createdAt))}</div>
                </div>
              `).join("") : `<div class="small muted">No forwarded cases for this dept.</div>`}
            </div>
          </div>

          <div class="card pad">
            <div style="font-weight:950">Quick Guide</div>
            <div class="small">
              <ol>
                <li>Open case → record tab.</li>
                <li>As DEPT role: add update → case turns BLUE.</li>
                <li>Closing as DEPT requires Closure Code + Resolution Notes.</li>
              </ol>
            </div>
            <hr class="sep"/>
            <div class="small muted">Role now: <strong>${escapeHtml(store.user.role)}</strong>. Change role from top right.</div>
          </div>
        </div>
      </div>
    `;
  }

  function averageFirstOpen(cases){
    const opened = cases.filter(c => c.firstOpenedAt);
    if(!opened.length) return "—";
    const avg = opened.reduce((acc,c)=> acc + (c.firstOpenedAt - c.createdAt), 0) / opened.length;
    const mins = Math.max(0, Math.round(avg/60000));
    return `${mins}m`;
  }

  function renderSla(){
    const active = store.cases.filter(c => c.status !== "Closed");
    const stats = {ONTRACK:0, ATRISK:0, BREACHED:0, NOTSTARTED:0};
    active.forEach(c => {
      const s = slaRemaining(c);
      if(s.label==="Not started") stats.NOTSTARTED++;
      else stats[s.state]++;
    });

    const rows = active
      .slice()
      .sort((a,b)=> (slaRemaining(a).ms ?? 1e15) - (slaRemaining(b).ms ?? 1e15))
      .slice(0,25);

    const avgFirst = averageFirstOpen(active);

    return `
      <div class="container">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap">
          <div>
            <div class="h1">SLA & Escalations</div>
            <div class="muted">Rows clickable → open as record tab.</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" data-open-page="dashboard">Back to Dashboard</button>
          </div>
        </div>

        <div style="height:12px"></div>

        <div class="grid2">
          <div class="card pad">
            <div style="font-weight:950">KPIs</div>
            <div class="small muted">Counts across active cases.</div>
            <div style="height:10px"></div>
            <div class="list">
              <div class="listItem" style="cursor:default"><strong>On Track</strong> — ${stats.ONTRACK}</div>
              <div class="listItem" style="cursor:default"><strong>At Risk</strong> — ${stats.ATRISK}</div>
              <div class="listItem" style="cursor:default"><strong>Breached</strong> — ${stats.BREACHED}</div>
              <div class="listItem" style="cursor:default"><strong>Not Started</strong> — ${stats.NOTSTARTED}</div>
              <div class="listItem" style="cursor:default"><strong>Avg First Open</strong> — ${avgFirst}</div>
            </div>
          </div>

          <div class="card pad">
            <div style="font-weight:950">Worst SLA (Top 25)</div>
            <table style="margin-top:10px">
              <thead><tr><th>Case</th><th>Channel</th><th>Status</th><th>SLA</th><th>Opened</th></tr></thead>
              <tbody>
                ${rows.map(c => {
                  const s = slaRemaining(c);
                  const opened = c.firstOpenedAt ? relTime(c.firstOpenedAt) : "—";
                  return `<tr class="trClick" data-open-case="${escapeHtml(c.id)}">
                    <td>${escapeHtml(c.id)}</td>
                    <td>${escapeHtml(c.channel)}</td>
                    <td>${escapeHtml(c.status)}</td>
                    <td>${escapeHtml(s.label)}</td>
                    <td>${escapeHtml(opened)}</td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderAdmin(){
    return `
      <div class="container">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap">
          <div>
            <div class="h1">Admin Config</div>
            <div class="muted">Demo-only. Reset clears localStorage.</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn danger" id="resetBtn">Reset Demo Data</button>
          </div>
        </div>

        <div style="height:12px"></div>

        <div class="grid2">
          <div class="card pad">
            <div style="font-weight:950">Channel → Queue Mapping</div>
            <table style="margin-top:10px">
              <thead><tr><th>Channel</th><th>Queue</th><th>Owner</th></tr></thead>
              <tbody>
                ${enums.channels.map(ch => `<tr><td>${escapeHtml(ch)}</td><td>${escapeHtml(ch)} Queue</td><td>${escapeHtml(ch)} Social Queue</td></tr>`).join("")}
              </tbody>
            </table>
          </div>

          <div class="card pad">
            <div style="font-weight:950">Notes</div>
            <div class="callout">
              <strong>Click-to-start SLA is gameable.</strong><br/>
              In real build, store both: Created SLA and First Open metric.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function selectRow(label, id, options, value){
    const v = value || "";
    return `
      <label class="small" style="display:block; margin:10px 0 6px">${escapeHtml(label)}</label>
      <select id="${id}">
        <option value="">—</option>
        ${options.map(o => `<option value="${escapeHtml(o)}" ${o===v?'selected':''}>${escapeHtml(o)}</option>`).join("")}
      </select>
    `;
  }

  function renderCaseRecord(caseId){
    const c = store.cases.find(x=>x.id===caseId);
    if(!c) return `<div class="container"><div class="card pad"><div class="h1">Case not found</div></div></div>`;

    if(!c.firstOpenedAt){
      c.firstOpenedAt = now();
      c.lastActivityAt = now();
      save();
      toast("SLA started", `Case ${c.id} started on first open.`);
    }

    const role = store.user.role;
    const isSMT = role==="SMT";
    const isDept = role==="DEPT";
    const classificationValid = !!(c.type && c.category && c.priority);

    const sla = slaRemaining(c);
    const slaClass = sla.state==="BREACHED" ? "bad" : (sla.state==="ATRISK" ? "warn" : "");
    const deptBanner = c.deptUpdate ? `
      <div class="banner">
        <div class="bannerTitle">Dept Update • ${escapeHtml(c.deptUpdate.dept)}</div>
        <div class="bannerSub">${escapeHtml(c.deptUpdate.summary)} • ${escapeHtml(relTime(c.deptUpdate.at))}</div>
      </div>` : "";

    return `
      <div class="container">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap">
          <div>
            <div class="h1">Case ${escapeHtml(c.id)} • ${escapeHtml(c.channel)} • ${escapeHtml(c.handle)}</div>
            <div class="hl">
              <div class="hlItem">Status: <strong>${escapeHtml(c.status)}</strong></div>
              <div class="hlItem">Owner: <strong>${escapeHtml(c.owner)}</strong></div>
              <div class="hlItem">Created: <strong>${escapeHtml(relTime(c.createdAt))}</strong></div>
              <div class="hlItem">Opened: <strong>${escapeHtml(c.firstOpenedAt ? relTime(c.firstOpenedAt) : "—")}</strong></div>
              <div class="hlItem">Priority: <strong>${escapeHtml(c.priority || "—")}</strong></div>
              <div class="hlItem">Dept: <strong>${escapeHtml(c.department || "—")}</strong></div>
              <div class="hlItem"><span class="slaPill ${slaClass}" style="display:inline-block">SLA: <strong>${escapeHtml(sla.label)}</strong></span></div>
              <div class="hlItem"><span class="badge ${stateBadgeClass(c.state)}">${escapeHtml(c.state)}</span></div>
            </div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" id="copyBtn">Copy Case ID</button>
            <button class="btn" id="backDashBtn">Back to Dashboard</button>
          </div>
        </div>

        <div style="height:12px"></div>
        ${deptBanner}

        <div class="grid2">
          <div class="card pad">
            <div style="font-weight:950">Social Thread</div>
            <hr class="sep"/>

            ${c.thread.map(item => `
              <div class="threadItem">
                <div class="who">${escapeHtml(item.who)}</div>
                <div style="margin-top:6px">${escapeHtml(item.text)}</div>
                <div class="when">${escapeHtml(fmtTime(item.at))} • ${escapeHtml(relTime(item.at))}</div>
              </div>
            `).join("")}

            <hr class="sep"/>
            <div style="font-weight:950">Compose</div>
            <textarea id="msgTxt" placeholder="${isSMT ? "Type reply to customer…" : isDept ? "Type dept update…" : "View only"}" ${(!isSMT && !isDept) ? "disabled" : ""}></textarea>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px">
              <button class="btn primary" id="sendBtn" ${(!isSMT && !isDept) ? "disabled" : ""}>${isSMT ? "Send Reply" : "Add Update"}</button>
              <button class="btn" id="noteBtn" ${(!isSMT && !isDept) ? "disabled" : ""}>Add Internal Note</button>
            </div>

            ${(!classificationValid && isSMT) ? `<div class="callout"><strong>Blocked:</strong> classify before replying/routing/closing.</div>` : ``}
          </div>

          <div class="card pad">
            <div style="font-weight:950">Classification</div>

            ${selectRow("Case Type*","typeSel", enums.caseType, c.type)}
            ${selectRow("Category*","catSel", enums.category, c.category)}
            ${selectRow("Priority*","priSel", enums.priority, c.priority)}
            ${selectRow("Department","deptSel", ["—"].concat(enums.dept), c.department || "—")}

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px">
              <button class="btn" id="saveClassBtn">Save</button>
              <button class="btn primary" id="routeBtn" ${(!isSMT || !classificationValid) ? "disabled" : ""}>Route to Dept</button>
              <button class="btn" id="escalateBtn" ${(!isSMT) ? "disabled" : ""}>Escalate</button>
              <button class="btn danger" id="closeBtn" ${((isSMT && !classificationValid) || (!isSMT && !isDept)) ? "disabled" : ""}>Close</button>
            </div>

            <hr class="sep"/>
            <div style="font-weight:950">Dept Close Requirements</div>
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
            const meta = c ? c.channel : "Case";
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

  function render(){
    const activeRecordId = store.recordTabs.activeId;
    const activeRecordTab = store.recordTabs.items.find(t=>t.id===activeRecordId) || null;

    document.body.innerHTML = `
      <div class="topbar">
        <div class="topbarRow">
          <div class="brand">
            <div class="logo">SF</div>
            <div>
              <div class="brandTitle">Social Media Console</div>
              <div class="brandSub">White theme + top tabs + record tabs (dummy data)</div>
            </div>
          </div>

          <div class="actions">
            <div class="pill">User: <strong>${escapeHtml(store.user.name)}</strong></div>
            <div class="pill">Role:
              <select id="roleSel" style="width:auto; padding:6px 10px; margin-left:6px">
                ${enums.roles.map(r => `<option ${r===store.user.role?'selected':''}>${r}</option>`).join("")}
              </select>
            </div>
            <button class="btn" id="helpBtn">Shortcuts</button>
          </div>
        </div>
        ${renderTopTabs()}
      </div>

      ${renderRecordTabs()}

      <div id="content">
        ${activeRecordTab ? renderCaseRecord(activeRecordTab.key) : (store.pageTabs.active==="dashboard" ? renderDashboard() : store.pageTabs.active==="deptQueue" ? renderDeptQueue() : store.pageTabs.active==="sla" ? renderSla() : renderAdmin())}
      </div>
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
        "Shortcuts:",
        "Ctrl+1..9: switch record tabs (if open)",
        "Ctrl+W: close active record tab (if not pinned)",
        "Ctrl+Shift+P: pin/unpin active record tab",
        "Ctrl+K: focus search (Dashboard, when no record tab is active)",
        "Tip: close record tabs to go back to page tabs."
      ].join("\n"));
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
    };

    if(!activeRecordTab){
      if(store.pageTabs.active==="dashboard") bindDashboard();
      if(store.pageTabs.active==="admin"){
        const resetBtn = $("#resetBtn");
        if(resetBtn) resetBtn.addEventListener("click", () => {
          if(!confirm("Reset demo data?")) return;
          store = seedData();
          save(); render(); toast("Reset complete", "Demo data re-seeded.");
        });
      }
    }

    $$("[data-open-case]").forEach(el => el.addEventListener("click", () => openCase(el.dataset.openCase)));

    if(activeRecordTab){
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
    $$("[data-tab]").forEach(t => t.addEventListener("click", () => { ui.dashboardTab = t.dataset.tab; save(); render(); }));
    $$("[data-righttab]").forEach(t => t.addEventListener("click", () => { ui.rightTab = t.dataset.righttab; save(); render(); }));

    const newBtn = $("#newCaseBtn");
    if(newBtn) newBtn.addEventListener("click", () => {
      const id = "00013" + String(Math.floor(100 + Math.random()*900));
      const ch = enums.channels[Math.floor(Math.random()*enums.channels.length)];
      const subj = ["Need help ASAP","Complaint about staff","Flight delayed","Refund query","Lost baggage"][Math.floor(Math.random()*5)];
      const msg = "Dummy inbound message: " + subj + ". Please assist.";
      const created = now() - minutes(Math.floor(Math.random()*15));
      const c = {
        id, channel: ch, handle:"@new_user", subject: subj, message: msg,
        createdAt: created, lastActivityAt: created, firstOpenedAt:null,
        slaStartMode:"click", slaMinutes: 15,
        state:"BROWN", status:"New", owner: `${ch} Queue`, assignee:null,
        type:null, category:null, priority:null, department:null,
        escalation:false, closureCode:null, resolutionNotes:null, deptUpdate:null,
        thread:[{who:"Customer", text: msg, at: created}]
      };
      store.cases.unshift(c);
      save(); render(); toast("New dummy case added", `Case ${id} in ${ch} queue.`);
    });
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

    const saveBtn = $("#saveClassBtn");
    if(saveBtn) saveBtn.addEventListener("click", () => {
      c.type = $("#typeSel").value || null;
      c.category = $("#catSel").value || null;
      c.priority = $("#priSel").value || null;
      const deptVal = $("#deptSel").value;
      c.department = (deptVal && deptVal !== "—") ? deptVal : null;

      if(c.state==="BROWN" && c.type && c.category && c.priority){
        c.state = "GREEN";
        c.status = "In-Progress";
        toast("Classified", `Case ${c.id} moved to GREEN.`);
      }
      c.lastActivityAt = now();
      save(); render();
    });

    const sendBtn = $("#sendBtn");
    if(sendBtn) sendBtn.addEventListener("click", () => {
      const txt = ($("#msgTxt")?.value || "").trim();
      if(!txt) return toast("Nothing to send", "Type a message first.");

      const classificationValid = !!(c.type && c.category && c.priority);

      if(isSMT){
        if(!classificationValid) return toast("Blocked", "Classify before replying.");
        c.thread.push({who:"SMT", text: txt, at: now()});
        c.state = "GREEN";
        c.status = "In-Progress";
        c.lastActivityAt = now();
        $("#msgTxt").value = "";
        toast("Reply sent (demo)", "Posted to thread and logged.");
      }else if(isDept){
        c.thread.push({who:(c.department || "Dept")+" Team", text: txt, at: now()});
        c.deptUpdate = {dept: (c.department || "Dept"), summary: txt.slice(0,70) + (txt.length>70?"…":""), at: now()};
        c.state = "BLUE";
        c.status = "Returned to SMT";
        c.owner = `${c.channel} Queue`;
        c.lastActivityAt = now();
        $("#msgTxt").value = "";
        toast("Dept updated SMT", "Case moved to BLUE.");
      }else{
        toast("Blocked", "Switch role to SMT or DEPT.");
      }
      save(); render();
    });

    const noteBtn = $("#noteBtn");
    if(noteBtn) noteBtn.addEventListener("click", () => {
      const txt = ($("#msgTxt")?.value || "").trim();
      if(!txt) return toast("Nothing to add", "Type text first.");
      c.thread.push({who:"Internal Note", text: txt, at: now()});
      c.lastActivityAt = now();
      $("#msgTxt").value = "";
      toast("Internal note added", `Case ${c.id}`);
      save(); render();
    });

    const routeBtn = $("#routeBtn");
    if(routeBtn) routeBtn.addEventListener("click", () => {
      const classificationValid = !!(c.type && c.category && c.priority);
      if(!isSMT) return toast("Blocked", "Only SMT can route.");
      if(!classificationValid) return toast("Blocked", "Classify before routing.");
      const deptVal = $("#deptSel").value;
      const dept = (deptVal && deptVal !== "—") ? deptVal : "Refunds";
      c.department = dept;
      c.state = "YELLOW";
      c.status = "Assigned to Department";
      c.owner = `${dept} Queue`;
      c.thread.push({who:"SMT", text:`Forwarded to ${dept} team.`, at: now()});
      c.lastActivityAt = now();
      save(); toast("Routed", `${dept} Queue`);
      setActivePage("deptQueue");
    });

    const escBtn = $("#escalateBtn");
    if(escBtn) escBtn.addEventListener("click", () => {
      if(!isSMT) return toast("Blocked", "Only SMT can escalate.");
      c.escalation = true;
      c.status = "Escalated";
      c.lastActivityAt = now();
      save(); toast("Escalated", "Supervisor notified (demo)."); render();
    });

    const closureSel = $("#closureSel");
    if(closureSel) closureSel.addEventListener("change", () => { c.closureCode = closureSel.value || null; save(); });

    const resNotes = $("#resNotes");
    if(resNotes) resNotes.addEventListener("input", () => { c.resolutionNotes = resNotes.value; save(); });

    const closeBtn = $("#closeBtn");
    if(closeBtn) closeBtn.addEventListener("click", () => {
      const closure = $("#closureSel").value;
      const notes = ($("#resNotes")?.value || "").trim();
      const classificationValid = !!(c.type && c.category && c.priority);

      if(isDept){
        if(!closure || closure==="—") return toast("Blocked", "Dept must set Closure Code.");
        if(!notes) return toast("Blocked", "Dept must add Resolution Notes.");
      } else if(isSMT){
        if(!classificationValid) return toast("Blocked", "Classify before close.");
        if(!closure || closure==="—") return toast("Blocked", "Set Closure Code.");
      } else {
        return toast("Blocked", "Switch role to SMT or DEPT to close.");
      }

      c.closureCode = closure;
      if(isDept) c.resolutionNotes = notes;
      c.status = "Closed";
      c.state = "CLOSED";
      c.lastActivityAt = now();
      save(); toast("Closed", `Case ${c.id} closed.`);
      closeRecordTab("case_" + caseId);
    });
  }

  setInterval(() => {
    if(!document.hidden){
      if(!store.recordTabs.activeId && (store.pageTabs.active==="dashboard" || store.pageTabs.active==="sla")){
        render();
      }
    }
  }, 30000);

  render();
})();