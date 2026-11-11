const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let token=localStorage.getItem('cp_token'),user=JSON.parse(localStorage.getItem('cp_user')||'null'),view=null,B={},authMode='login';
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NAV={patient:[['home','bi-house','Home'],['book','bi-calendar-plus','Book'],['appts','bi-calendar-check','Visits'],['records','bi-folder2-open','Records'],['rx','bi-capsule','Medicines']],
 doctor:[['appts','bi-calendar-check','Schedule'],['records','bi-folder2-open','Records'],['rx','bi-capsule','Prescriptions']],
 admin:[['reports','bi-bar-chart','Reports'],['appts','bi-calendar-check','Appointments']]};

async function api(url,method='GET',body){
  const r=await fetch('/api'+url,{method,headers:{'Content-Type':'application/json',...(token&&{Authorization:'Bearer '+token})},body:body&&JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(r.status===401&&token&&!url.startsWith('/auth')){logout();}
  if(!r.ok)throw new Error(d.error||'Something went wrong');return d;}
function toast(m,bad){const t=$('#toast');t.textContent=m;t.className='toast-pill show'+(bad?' bad':'');clearTimeout(t._t);t._t=setTimeout(()=>t.className='toast-pill',3200);}
const run=async f=>{try{await f()}catch(e){toast(e.message,true)}};
function logout(){localStorage.clear();token=user=null;B={};render();}

function render(){user?shell():authScreen();}

/* ---------- Auth ---------- */
function authScreen(){
  const s=authMode==='signup';
  $('#app').innerHTML=`<div class="auth"><section class="auth-hero"><div class="pulse"><i class="bi bi-heart-pulse-fill"></i>CarePoint</div>
   <div><h1>See the right doctor, sooner.</h1><p class="mt-3">Book visits, keep your medical history and manage prescriptions from one place.</p></div><small style="color:#8fb3b9">Demo: patient@demo.com / patient123</small></section>
   <section class="auth-form"><div class="auth-card"><h3>${s?'Create your account':'Welcome back'}</h3>
   <div class="seg"><button class="${s?'':'on'}" onclick="authMode='login';render()">Log in</button><button class="${s?'on':''}" onclick="authMode='signup';render()">Sign up</button></div>
   <form id="af" class="d-grid gap-3">${s?'<input class="form-control" name="name" placeholder="Full name" required><input class="form-control" name="phone" placeholder="Phone number">':''}
   <input class="form-control" type="email" name="email" placeholder="Email" required><input class="form-control" type="password" name="password" placeholder="Password${s?' (6+ characters)':''}" required>
   <button class="btn btn-coral">${s?'Create account':'Log in'}</button></form></div></section></div>`;
  $('#af').onsubmit=e=>{e.preventDefault();run(async()=>{
    const d=await api('/auth/'+(s?'signup':'login'),'POST',Object.fromEntries(new FormData(e.target)));
    token=d.token;user=d.user;localStorage.setItem('cp_token',token);localStorage.setItem('cp_user',JSON.stringify(user));view=NAV[user.role][0][0];render();});};}

/* ---------- Shell ---------- */
function shell(){
  view=view||NAV[user.role][0][0];const nav=NAV[user.role];
  $('#app').innerHTML=`<div class="shell"><aside class="side"><div class="pulse"><i class="bi bi-heart-pulse-fill"></i>CarePoint</div>
   ${nav.map(n=>`<button class="nav-i ${view===n[0]?'on':''}" onclick="go('${n[0]}')"><i class="bi ${n[1]}"></i>${n[2]}</button>`).join('')}
   <div class="me"><div class="av">${esc(user.name[0])}</div><div class="grow" style="min-width:0"><b class="d-block text-truncate">${esc(user.name)}</b><small style="color:#9fc0c5">${user.role}</small></div><button class="btn btn-sm text-white" title="Log out" onclick="logout()"><i class="bi bi-box-arrow-right"></i></button></div></aside>
   <main id="main"></main></div>
   <nav class="tabs">${nav.map(n=>`<button class="${view===n[0]?'on':''}" onclick="go('${n[0]}')"><i class="bi ${n[1]}"></i>${n[2]}</button>`).join('')}<button onclick="logout()"><i class="bi bi-box-arrow-right"></i>Log out</button></nav>`;
  run(async()=>{$('#main').innerHTML=await VIEWS[view]();});}
function go(v){view=v;shell();}
const head=(t,sub,btn='')=>`<div class="top"><div><h2>${t}</h2><small>${sub}</small></div>${btn}</div>`;
const empty=(i,t)=>`<div class="empty card-x"><i class="bi ${i}"></i>${t}</div>`;
const fdate=d=>{const[y,m,dd]=d.slice(0,10).split('-');return`${+dd} ${MON[m-1]} ${y}`};

/* ---------- Shared lists ---------- */
function apptCard(a){
  const[,m,d]=a.date.split('-'),r=user.role;
  const act=[];
  if(r==='doctor'||r==='admin'){if(a.status==='pending'&&r==='doctor')act.push(['confirmed','Confirm','btn-soft']);if(['pending','confirmed'].includes(a.status)&&r==='doctor')act.push(['completed','Complete','btn-soft']);}
  if(['pending','confirmed'].includes(a.status))act.push(['cancelled','Cancel','btn-outline-danger']);
  return`<div class="item"><div class="date"><b>${+d}</b><span>${MON[m-1]}</span></div>
   <div class="grow"><b>${r==='patient'?esc(a.doctor):esc(a.patient)}${r==='admin'?` <small>with ${esc(a.doctor)}</small>`:''}</b><small>${r==='patient'?esc(a.specialty)+' · ':''}${esc(a.hospital)} · ${a.time}${a.reason?' · '+esc(a.reason):''}</small></div>
   <span class="st st-${a.status}">${a.status}</span>${act.map(x=>`<button class="btn btn-sm ${x[2]}" onclick="setStatus(${a.id},'${x[0]}')">${x[1]}</button>`).join('')}</div>`;}
const setStatus=(id,s)=>run(async()=>{await api('/appointments/'+id,'PATCH',{status:s});toast('Appointment '+s);go(view);});

/* ---------- Views ---------- */
const VIEWS={
async home(){
  const[a,r,x]=await Promise.all([api('/appointments'),api('/records'),api('/prescriptions')]);
  const up=a.filter(i=>['pending','confirmed'].includes(i.status)&&i.date>=new Date().toISOString().slice(0,10)).reverse();
  const st=(i,n,l)=>`<div class="col-6 col-md-4"><div class="card-x stat"><div class="ic"><i class="bi ${i}"></i></div><div><b>${n}</b><span>${l}</span></div></div></div>`;
  return head('Hi, '+esc(user.name.split(' ')[0]),'Here is your health at a glance','<button class="btn btn-coral" onclick="go(\'book\')"><i class="bi bi-plus-lg"></i> Book appointment</button>')+
   `<div class="row g-3 mb-4">${st('bi-calendar-event',up.length,'Upcoming visits')}${st('bi-folder2-open',r.length,'Medical records')}${st('bi-capsule',x.filter(i=>i.status==='active').length,'Active medicines')}</div>
   <h5 class="mb-3">Next visits</h5>${up.length?up.map(apptCard).join(''):empty('bi-calendar-plus','No upcoming visits. Book one in under a minute.')}`;},

async book(){
  const[hs,ds]=await Promise.all([api('/hospitals'),api('/doctors'+(B.h?'?hospital_id='+B.h:''))]);
  const taken=B.d&&B.date?await api(`/doctors/${B.d}/slots?date=${B.date}`):[];
  const times=[];for(let h=9;h<17;h++)['00','30'].forEach(m=>times.push(String(h).padStart(2,'0')+':'+m));
  const today=new Date().toISOString().slice(0,10);
  return head('Book appointment','Pick a hospital, a doctor and a time')+
  `<h6>1. Hospital</h6><div class="d-flex gap-2 flex-wrap mb-4"><button class="chip ${!B.h?'on':''}" onclick="pick('h',0)">All hospitals</button>${hs.map(h=>`<button class="chip ${B.h==h.id?'on':''}" onclick="pick('h',${h.id})">${esc(h.name)}, ${esc(h.city)}</button>`).join('')}</div>
   <h6>2. Doctor</h6><div class="row g-3 mb-4">${ds.map(d=>`<div class="col-md-6"><div class="card-x doc ${B.d==d.id?'on':''}" onclick="pick('d',${d.id})"><div class="av">${esc(d.name.split(' ')[1][0])}</div><div class="grow"><b>${esc(d.name)}</b><small>${esc(d.specialty)} · ${esc(d.hospital)}</small></div><b>₹${d.fee}</b></div></div>`).join('')}</div>
   ${B.d?`<h6>3. Date & time</h6><input type="date" class="form-control mb-3" style="max-width:220px" min="${today}" value="${B.date||''}" onchange="pick('date',this.value)">
   ${B.date?`<div class="slots mb-4">${times.map(t=>`<button class="slot ${B.t===t?'on':''}" ${taken.includes(t)?'disabled':''} onclick="pick('t','${t}')">${t}</button>`).join('')}</div>`:''}
   <h6>4. Reason for visit</h6><input id="reason" class="form-control mb-3" placeholder="e.g. Chest pain, regular check-up" value="${esc(B.reason||'')}" oninput="B.reason=this.value">
   <button class="btn btn-coral" ${B.t?'':'disabled'} onclick="confirmBooking()">Confirm appointment</button>`:''}`;},

async appts(){const a=await api('/appointments');
  return head(user.role==='patient'?'My visits':user.role==='doctor'?'My schedule':'All appointments',a.length+' total')+(a.length?a.map(apptCard).join(''):empty('bi-calendar-x','No appointments yet.'));},

async records(){const r=await api('/records');
  return head('Medical records','Diagnoses and doctor notes',user.role==='doctor'?'<button class="btn btn-coral" onclick="addForm(\'records\')"><i class="bi bi-plus-lg"></i> New record</button>':'')+
  (r.length?r.map(i=>`<div class="item"><div class="av"><i class="bi bi-file-medical"></i></div><div class="grow"><b>${esc(i.diagnosis)}</b><small>${user.role==='patient'?esc(i.doctor)+' · '+esc(i.specialty):esc(i.patient)} · ${fdate(i.created_at)}</small>${i.notes?`<div class="mt-1">${esc(i.notes)}</div>`:''}</div></div>`).join(''):empty('bi-folder2-open','No records yet. They appear here after your doctor adds them.'));},

async rx(){const x=await api('/prescriptions');
  return head('Prescriptions','Medicines prescribed by your doctors',user.role==='doctor'?'<button class="btn btn-coral" onclick="addForm(\'rx\')"><i class="bi bi-plus-lg"></i> New prescription</button>':'')+
  (x.length?x.map(i=>`<div class="item"><div class="av"><i class="bi bi-capsule"></i></div><div class="grow"><b>${esc(i.medicine)}</b><small>${[i.dosage,i.duration,i.instructions].filter(Boolean).map(esc).join(' · ')}<br>${user.role==='patient'?esc(i.doctor):esc(i.patient)} · ${fdate(i.created_at)}</small></div>
   <span class="st st-${i.status}">${i.status}</span>${user.role==='doctor'?`<button class="btn btn-sm btn-soft" onclick="rxStatus(${i.id},'${i.status==='active'?'completed':'active'}')">${i.status==='active'?'Mark completed':'Reactivate'}</button>`:''}</div>`).join(''):empty('bi-capsule','No prescriptions yet.'));},

async reports(){const r=await api('/reports'),t=r.totals;
  const st=(i,n,l)=>`<div class="col-6 col-md-4"><div class="card-x stat"><div class="ic"><i class="bi ${i}"></i></div><div><b>${n}</b><span>${l}</span></div></div></div>`;
  const bars=(title,rows)=>{const mx=Math.max(1,...rows.map(x=>x.n));return`<div class="col-md-4"><div class="card-x h-100"><h6 class="mb-3">${title}</h6>${rows.map(x=>`<div class="mb-3"><div class="d-flex justify-content-between small"><span>${esc(x.label)}</span><b>${x.n}</b></div><div class="bar"><i style="width:${x.n/mx*100}%"></i></div></div>`).join('')||'<small>No data</small>'}</div></div>`};
  return head('Hospital report','Live summary of activity','<button class="btn btn-soft" onclick="exportCsv()"><i class="bi bi-download"></i> Export appointments CSV</button>')+
  `<div class="row g-3 mb-3">${st('bi-people',t.patients,'Patients')}${st('bi-person-badge',t.doctors,'Doctors')}${st('bi-calendar-check',t.appointments,'Appointments')}${st('bi-folder2-open',t.records,'Records')}${st('bi-capsule',t.prescriptions,'Prescriptions')}${st('bi-currency-rupee','₹'+t.revenue,'Revenue (completed)')}</div>
  <div class="row g-3">${bars('Appointments by status',r.byStatus)}${bars('By hospital',r.byHospital)}${bars('Busiest doctors',r.topDoctors)}</div>`;}
};

/* ---------- Actions ---------- */
function pick(k,v){if(k==='h'){B={h:v||0};}else if(k==='d'){B={h:B.h,d:v};}else if(k==='date'){B.date=v;B.t=null;}else B.t=v;go('book');}
const confirmBooking=()=>run(async()=>{await api('/appointments','POST',{doctor_id:B.d,date:B.date,time:B.t,reason:B.reason});B={};toast('Appointment booked');go('appts');});
const rxStatus=(id,s)=>run(async()=>{await api('/prescriptions/'+id,'PATCH',{status:s});go('rx');});
async function addForm(type){
  const ps=await api('/patients');
  if(!ps.length)return toast('You can add this once a patient has booked with you',true);
  const rec=type==='records';
  $('#modalHost').innerHTML=`<div class="modal fade" id="m" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><form class="modal-content" style="border-radius:20px" id="mf">
   <div class="modal-header border-0"><h5 class="modal-title">${rec?'New medical record':'New prescription'}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
   <div class="modal-body d-grid gap-3"><select class="form-select" name="patient_id" required><option value="">Select patient</option>${ps.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
   ${rec?`<input class="form-control" name="diagnosis" placeholder="Diagnosis" required><textarea class="form-control" name="notes" rows="4" placeholder="Notes and treatment plan"></textarea>`
   :`<input class="form-control" name="medicine" placeholder="Medicine (e.g. Amoxicillin 500mg)" required><input class="form-control" name="dosage" placeholder="Dosage (e.g. 1 tablet, twice daily)"><input class="form-control" name="duration" placeholder="Duration (e.g. 7 days)"><input class="form-control" name="instructions" placeholder="Instructions (e.g. after meals)">`}</div>
   <div class="modal-footer border-0"><button class="btn btn-coral w-100">Save ${rec?'record':'prescription'}</button></div></form></div></div>`;
  const m=new bootstrap.Modal('#m');m.show();
  $('#mf').onsubmit=e=>{e.preventDefault();run(async()=>{await api('/'+(rec?'records':'prescriptions'),'POST',Object.fromEntries(new FormData(e.target)));m.hide();toast('Saved');go(type);});};}
async function exportCsv(){
  const a=await api('/appointments');const rows=[['ID','Date','Time','Patient','Doctor','Hospital','Status','Reason'],...a.map(x=>[x.id,x.date,x.time,x.patient,x.doctor,x.hospital,x.status,x.reason])];
  const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));l.download='appointments-report.csv';l.click();}

render();
