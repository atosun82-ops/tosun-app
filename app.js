import { seedIfEmpty, listEmployees, addEmployee, updateEmployee, deleteEmployee,
  listEntriesForEmployeeInMonth, listEntriesForEmployeeInYear, upsertEntry } from "./db.js";

function euro(n){const x=Number(n||0);return x.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";}
function monthName(m){return new Date(2026,m-1,1).toLocaleString("de-DE",{month:"long"});}
function iso(d){const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,"0");const da=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${da}`;}
function parseHash(){const h=location.hash||"#/dashboard";const [path,qs]=h.slice(1).split("?");return {path,params:new URLSearchParams(qs||"")};}
function setHash(path, params={}){const qs=new URLSearchParams(params).toString();location.hash="#"+path+(qs?"?"+qs:"");}
function getSelectedYM(){const now=new Date();const y=Number(localStorage.getItem("sel_year")||now.getFullYear());const m=Number(localStorage.getItem("sel_month")||(now.getMonth()+1));return {y,m};}
function setSelectedYM(y,m){localStorage.setItem("sel_year",String(y));localStorage.setItem("sel_month",String(m));}
function header(title, subtitle, right=""){return `<div class="header"><div class="hrow"><div><div class="title">${title}</div>${subtitle?`<div class="subtitle">${subtitle}</div>`:""}</div><div style="display:flex;gap:10px;align-items:center;">${right}</div></div></div>`;}
function navbar(html){return `<div class="navbar">${html}</div>`;}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));}
function parseMoney(v){if(v===null||v===undefined)return 0;const s=String(v).trim().replace(/\./g,"").replace(",",".");const n=Number(s);return Number.isFinite(n)?Math.max(0,n):0;}

async function render(){
  await seedIfEmpty();
  const {path,params}=parseHash();
  if(path==="/dashboard") return renderDashboard();
  if(path==="/employee") return renderEmployee(Number(params.get("id")));
  if(path==="/year") return renderYear();
  return renderDashboard();
}

async function renderDashboard(){
  const app=document.querySelector("#app");
  const {y,m}=getSelectedYM();
  const emps=await listEmployees();

  const rows=[];
  for(const e of emps){
    const entries=await listEntriesForEmployeeInMonth(e.id,y,m);
    const days=entries.filter(x=>x.present).length;
    const due=Number(e.rate||0)*days;
    const paid=entries.reduce((s,x)=>s+Number(x.payment||0),0);
    const open=due-paid;
    rows.push({e,days,due,paid,open});
  }

  app.innerHTML =
    header(`${monthName(m)} ${y}`, "Monatsübersicht – lokal gespeichert", `<button class="btn" id="btnYear">Jahr</button><button class="btn primary" id="btnPick">Monat</button>`) +
    `<div class="container"><div class="list" id="list"></div></div>` +
    navbar(`<button class="btn" id="btnAdd">+ Mitarbeiter</button><button class="btn" id="btnInfo">Info</button>`);

  const list=document.querySelector("#list");
  list.innerHTML = rows.map(r=>{
    const bad=r.open>0.001;
    return `<div class="card" data-id="${r.e.id}">
      <div class="row">
        <div><div class="name">${esc(r.e.name)}</div><div class="small">${euro(r.e.rate)} / Tag</div></div>
        <div style="text-align:right"><div class="small">Offen</div><div style="font-size:18px;font-weight:800;color:${bad?"var(--warn)":"var(--ok)"}">${euro(r.open)}</div></div>
      </div>
      <div class="chips"><div class="chip">${r.days} Tage</div><div class="chip">Soll: ${euro(r.due)}</div><div class="chip">Gezahlt: ${euro(r.paid)}</div></div>
    </div>`;
  }).join("");

  list.querySelectorAll(".card").forEach(c=>c.onclick=()=>setHash("/employee",{id:c.dataset.id}));

  document.querySelector("#btnYear").onclick=()=>setHash("/year");
  document.querySelector("#btnPick").onclick=()=>openMonthPicker(y,m);
  document.querySelector("#btnAdd").onclick=()=>openAddEmployee();
  document.querySelector("#btnInfo").onclick=()=>alert("Daten werden lokal auf deinem iPhone/iPad gespeichert (IndexedDB).");
}

async function renderEmployee(id){
  const app=document.querySelector("#app");
  const {y,m}=getSelectedYM();
  const emps=await listEmployees();
  const emp=emps.find(e=>e.id===id);
  if(!emp){setHash("/dashboard");return;}

  const dim=new Date(y,m,0).getDate();
  const entries=await listEntriesForEmployeeInMonth(id,y,m);
  const map=new Map(entries.map(x=>[x.date,x]));

  let days=0, paid=0;
  for(const e of entries){ if(e.present) days++; paid+=Number(e.payment||0); }
  const due=Number(emp.rate||0)*days;
  const open=due-paid;

  app.innerHTML =
    header(emp.name, `${monthName(m)} ${y} • Tagessatz: ${euro(emp.rate)}`, `<button class="btn" id="btnBack">Zurück</button>`) +
    `<div class="container">
      <div class="card"><div class="chips">
        <div class="chip">${days} Tage</div>
        <div class="chip">Soll: ${euro(due)}</div>
        <div class="chip">Gezahlt: ${euro(paid)}</div>
        <div class="chip ${open>0.001?"bad":"ok"}">Offen: ${euro(open)}</div>
      </div></div>

      <div class="card">
        <div class="row" style="margin-bottom:10px;">
          <div><div class="name">Tage</div><div class="small">Häkchen + Zahlung pro Tag</div></div>
          <button class="btn" id="btnEdit">Mitarbeiter</button>
        </div>
        <div class="list" id="days"></div>
      </div>
    </div>` +
    navbar(`<button class="btn" id="btnMonth">Monat</button><button class="btn primary">Auto-Save</button>`);

  document.querySelector("#btnBack").onclick=()=>setHash("/dashboard");
  document.querySelector("#btnMonth").onclick=()=>openMonthPicker(y,m);
  document.querySelector("#btnEdit").onclick=()=>openEditEmployee(emp);

  const daysEl=document.querySelector("#days");
  const rows=[];
  for(let d=1; d<=dim; d++){
    const dt=new Date(y,m-1,d);
    const dateIso=iso(dt);
    const ex=map.get(dateIso)||{present:false,payment:0};
    const wd=dt.toLocaleString("de-DE",{weekday:"short"});
    rows.push(`<div class="day" data-date="${dateIso}">
      <div class="dayleft">
        <div style="font-weight:700">${String(d).padStart(2,"0")}. ${monthName(m)} • ${wd}</div>
        <div class="small">${dateIso}</div>
      </div>
      <div class="toggle">
        <label class="small">Anw.</label>
        <input type="checkbox" class="present" ${ex.present?"checked":""}/>
        <input class="input money payment" inputmode="decimal" placeholder="€" value="${ex.payment||0}"/>
      </div>
    </div>`);
  }
  daysEl.innerHTML=rows.join("");

  daysEl.querySelectorAll(".day").forEach(row=>{
    const dateIso=row.dataset.date;
    const presentEl=row.querySelector(".present");
    const payEl=row.querySelector(".payment");
    const save=async()=>{
      const present=presentEl.checked;
      const payment=parseMoney(payEl.value);
      await upsertEntry(id,dateIso,present,payment);
      renderEmployee(id);
    };
    presentEl.addEventListener("change", save);
    payEl.addEventListener("change", save);
    payEl.addEventListener("blur", save);
  });
}

async function renderYear(){
  const app=document.querySelector("#app");
  const {y,m}=getSelectedYM();
  const emps=await listEmployees();

  const rows=[];
  for(const e of emps){
    const entries=await listEntriesForEmployeeInYear(e.id,y);
    const days=entries.filter(x=>x.present).length;
    const due=Number(e.rate||0)*days;
    const paid=entries.reduce((s,x)=>s+Number(x.payment||0),0);
    const open=due-paid;
    rows.push({e,days,due,paid,open});
  }

  app.innerHTML =
    header(`Jahresübersicht ${y}`, "Gesamt pro Mitarbeiter (insgesamt)", `<button class="btn" id="btnBack">Zurück</button><button class="btn primary" id="btnPickYear">Jahr</button>`) +
    `<div class="container">
      <div class="card"><div class="grid12" id="months"></div></div>
      <div class="card"><div class="name">Mitarbeiter (Jahr)</div><div class="small" style="margin-top:6px;">Tage • Soll • Gezahlt • Offen</div><div class="list" id="list"></div></div>
    </div>`;

  document.querySelector("#btnBack").onclick=()=>setHash("/dashboard");
  document.querySelector("#btnPickYear").onclick=()=>openYearPicker(y);

  const months=document.querySelector("#months");
  months.innerHTML = Array.from({length:12},(_,i)=>{
    const mm=i+1; const active=mm===m;
    return `<button class="monthbtn" data-m="${mm}" style="${active?"border-color: rgba(255,106,0,0.55);":""}">${monthName(mm)}</button>`;
  }).join("");
  months.querySelectorAll(".monthbtn").forEach(b=>b.onclick=()=>{const mm=Number(b.dataset.m);setSelectedYM(y,mm);setHash("/dashboard");});

  const list=document.querySelector("#list");
  list.innerHTML = rows.map(r=>{
    const bad=r.open>0.001;
    return `<div class="card" style="margin-bottom:10px;" data-id="${r.e.id}">
      <div class="row">
        <div><div class="name">${esc(r.e.name)}</div><div class="small">${euro(r.e.rate)} / Tag</div></div>
        <div style="text-align:right"><div class="small">Offen</div><div style="font-size:18px;font-weight:800;color:${bad?"var(--warn)":"var(--ok)"}">${euro(r.open)}</div></div>
      </div>
      <div class="chips"><div class="chip">${r.days} Tage</div><div class="chip">Soll: ${euro(r.due)}</div><div class="chip">Gezahlt: ${euro(r.paid)}</div></div>
    </div>`;
  }).join("");
  list.querySelectorAll(".card").forEach(c=>c.onclick=()=>setHash("/employee",{id:c.dataset.id}));
}

function openMonthPicker(year,month){
  const y=prompt("Jahr (z.B. 2026):", String(year)); if(!y) return;
  const m=prompt("Monat (1-12):", String(month)); if(!m) return;
  const yy=Number(y), mm=Number(m);
  if(!Number.isFinite(yy)||!Number.isFinite(mm)||mm<1||mm>12) return;
  setSelectedYM(yy,mm); render();
}
function openYearPicker(year){
  const y=prompt("Jahr (z.B. 2026):", String(year)); if(!y) return;
  const yy=Number(y); if(!Number.isFinite(yy)) return;
  setSelectedYM(yy, getSelectedYM().m); render();
}
async function openAddEmployee(){
  const name=prompt("Name des Mitarbeiters:"); if(!name) return;
  const rateStr=prompt("Tagessatz (€):","120"); const rate=parseMoney(rateStr);
  await addEmployee(name, rate); render();
}
async function openEditEmployee(emp){
  const name=prompt("Name:", emp.name); if(name===null) return;
  const rateStr=prompt("Tagessatz (€):", String(emp.rate||0)); if(rateStr===null) return;
  const rate=parseMoney(rateStr);
  if(confirm("Mitarbeiter löschen? (OK = löschen)")){
    await deleteEmployee(emp.id); setHash("/dashboard"); render(); return;
  }
  emp.name=(name.trim()||emp.name); emp.rate=rate;
  await updateEmployee(emp); render();
}

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
window.addEventListener("hashchange", render);
render();
