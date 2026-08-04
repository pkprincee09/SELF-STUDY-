/* ============ CONSTANTS & STATE ============ */
const LS_KEY = 'sslms_data_v6';
let DB = { students: [], seats: [], attendance: [], payments: [], admins: [], settings: {}, notifications: [] };
let currentReport = 'student';
let currentReceiptPaymentId = null;
let currentLoggedInStudentId = null;
let pendingAttendanceStatus = null;

/* ============ UTIL ============ */
function uid(){ return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2,7); }
function todayStr(){ const d = new Date(); return d.toISOString().slice(0,10); }
function showToast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3500); }
function fmtDate(s){ if(!s) return '—'; const d = new Date(s); if(isNaN(d)) return s; return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function money(n){ return '₹' + (Number(n)||0).toLocaleString('en-IN'); }
function genStudentId(){ const n = DB.students.length + 1; return 'STU-' + String(n).padStart(4, '0'); }
function getStudent(id){ return DB.students.find(s=>s.id===id); }
function getSeat(num){ return DB.seats.find(s=>s.number===Number(num)); }
function getMonthlyFee(){ return Number(DB.settings.monthlyFee) || 1000; }
function monthLabelNow(){ return new Date().toLocaleString('en-IN',{month:'short',year:'numeric'}); }
function addMonths(date, months){ const d = new Date(date); d.setMonth(d.getMonth() + months); return d; }
function getNextDueDate(joiningDate, months){ return addMonths(new Date(joiningDate), months).toISOString().slice(0,10); }
function getMonthLabel(dateStr){
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN',{month:'short',year:'numeric'});
}
function generateAttendanceCode(){ 
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for(let i=0; i<7; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function getStudentPaymentStatus(studentId){
  const today = new Date();
  const student = getStudent(studentId);
  if(!student) return { status: 'No Records', balance: 0 };
  
  const payments = DB.payments.filter(p => p.studentId === studentId);
  const joiningDate = new Date(student.joiningDate);
  
  const monthsSinceJoining = (today.getFullYear() - joiningDate.getFullYear()) * 12 + (today.getMonth() - joiningDate.getMonth());
  const totalMonths = Math.max(0, monthsSinceJoining + 1);
  
  const monthlyFee = getMonthlyFee();
  let totalExpected = 0;
  let totalPaid = 0;
  
  payments.forEach(p => {
    if(p.type === 'Monthly' && p.month) {
      const monthDate = new Date(p.month + ' 1, 2026');
      if(!isNaN(monthDate)) {
        const monthsDiff = (today.getFullYear() - monthDate.getFullYear()) * 12 + (today.getMonth() - monthDate.getMonth());
        if(monthsDiff >= 0 && monthsDiff < 12) {
          totalExpected += Number(p.amount) || 0;
          totalPaid += Number(p.paidAmount) || 0;
        }
      }
    }
  });
  
  const expectedMonths = [];
  for(let i = 0; i < totalMonths; i++) {
    const dueDate = getNextDueDate(student.joiningDate, i + 1);
    const monthLabel = getMonthLabel(dueDate);
    if(new Date(dueDate) <= today) {
      expectedMonths.push(monthLabel);
    }
  }
  
  const paidMonths = payments.filter(p => p.type === 'Monthly' && (p.status === 'Paid' || p.status === 'Partial')).map(p => p.month);
  const unpaidMonths = expectedMonths.filter(m => !paidMonths.includes(m));
  
  const totalExpectedAll = expectedMonths.length * monthlyFee;
  const totalPaidAll = payments.filter(p => p.type === 'Monthly').reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
  const balance = totalExpectedAll - totalPaidAll;
  
  let status = 'Paid';
  if(balance > 0 && balance < monthlyFee) status = 'Partial';
  else if(balance > 0) status = 'Pending';
  if(unpaidMonths.length > 0 && totalPaidAll === 0) status = 'Pending';
  
  return { status, balance, totalExpected: totalExpectedAll, totalPaid: totalPaidAll, unpaidMonths, paidMonths };
}

function getPaymentBalance(payment){
  const total = Number(payment.amount) || 0;
  const paid = Number(payment.paidAmount) || 0;
  const discount = Number(payment.discount) || 0;
  const fine = Number(payment.fine) || 0;
  const advance = Number(payment.advance) || 0;
  return total - paid - discount + fine - advance;
}

/* ============ ATTENDANCE CODE FUNCTIONS ============ */
function getAttendanceCode(){
  return DB.settings.attendanceCode || null;
}

function setAttendanceCode(code){
  DB.settings.attendanceCode = code;
  saveData();
  updateCodeDisplay();
}

function updateCodeDisplay(){
  const code = getAttendanceCode();
  const display = document.getElementById('currentCodeDisplay');
  if(code){
    display.textContent = code;
    display.style.opacity = '1';
  } else {
    display.textContent = 'Not Set';
    display.style.opacity = '0.6';
  }
}

function toggleCodeVisibility(){
  const display = document.getElementById('currentCodeDisplay');
  if(display.textContent === 'Not Set') return;
  if(display.style.filter === 'blur(6px)'){
    display.style.filter = 'none';
  } else {
    display.style.filter = 'blur(6px)';
  }
}

function copyCode(){
  const code = getAttendanceCode();
  if(!code){ showToast('No code set'); return; }
  navigator.clipboard.writeText(code).then(() => showToast('Code copied!')).catch(() => showToast('Failed to copy'));
}

function generateNewCode(){
  const code = generateAttendanceCode();
  setAttendanceCode(code);
  showToast('New code generated: ' + code);
  document.getElementById('currentCodeDisplay').style.filter = 'none';
}

function regenerateCode(){
  const code = generateAttendanceCode();
  setAttendanceCode(code);
  showToast('Code regenerated: ' + code);
  document.getElementById('currentCodeDisplay').style.filter = 'none';
}

function deleteCode(){
  if(!getAttendanceCode()){ showToast('No code to delete'); return; }
  showConfirm('Delete the current attendance code? Attendance marking will be disabled.', () => {
    DB.settings.attendanceCode = null;
    saveData();
    updateCodeDisplay();
    showToast('Code deleted');
  });
}

function setManualCode(){
  const code = document.getElementById('manualCodeInput').value.trim();
  if(!code || code.length < 4){ showToast('Please enter a valid code (min 4 chars)'); return; }
  setAttendanceCode(code);
  document.getElementById('manualCodeInput').value = '';
  showToast('Code set: ' + code);
  document.getElementById('currentCodeDisplay').style.filter = 'none';
}

/* ============ STUDENT LOGIN SYSTEM ============ */
function switchLoginRole(role) {
  document.querySelectorAll('.login-option').forEach(b => b.classList.toggle('active', b.dataset.role === role));
  if (role === 'admin') {
    document.getElementById('adminLoginFields').style.display = 'block';
    document.getElementById('studentLoginFields').style.display = 'none';
    document.getElementById('loginHint').textContent = 'Demo: admin / 12345';
  } else {
    document.getElementById('adminLoginFields').style.display = 'none';
    document.getElementById('studentLoginFields').style.display = 'block';
    document.getElementById('loginHint').textContent = 'Demo: STU-0001 / STU-0001 (or any student ID)';
  }
}

function handleLogin() {
  const activeRole = document.querySelector('.login-option.active').dataset.role;
  if (activeRole === 'admin') {
    doLogin();
  } else {
    doStudentLogin();
  }
}

function doStudentLogin() {
  const loginId = document.getElementById('studentLoginId').value.trim();
  const password = document.getElementById('studentLoginPwd').value.trim();
  
  let student = DB.students.find(s => s.studentId === loginId || s.mobile === loginId);
  
  if (!student) {
    document.getElementById('loginErr').textContent = '❌ Student not found';
    document.getElementById('loginErr').style.display = 'block';
    setTimeout(()=>document.getElementById('loginErr').style.display='none', 3000);
    return;
  }
  
  const defaultPwd = student.studentId;
  if (password !== (student.password || defaultPwd)) {
    document.getElementById('loginErr').textContent = '❌ Invalid password';
    document.getElementById('loginErr').style.display = 'block';
    setTimeout(()=>document.getElementById('loginErr').style.display='none', 3000);
    return;
  }
  
  currentLoggedInStudentId = student.id;
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('dashPage').style.display = 'flex';
  document.getElementById('navSubtitle').textContent = '👨‍🎓 STUDENT PANEL';
  document.getElementById('adminNav').style.display = 'none';
  document.getElementById('studentNav').style.display = 'block';
  applyBranding();
  startClock();
  showPage('student-dashboard');
}

function doLogin(){
  const u = document.getElementById('loginId').value.trim();
  const p = document.getElementById('loginPwd').value;
  const ok = DB.admins.some(a => a.username === u && a.password === p);
  if(ok){
    document.getElementById('loginPage').style.display='none';
    document.getElementById('dashPage').style.display='flex';
    document.getElementById('navSubtitle').textContent = 'SMART READING SPACE · ADMIN PANEL';
    document.getElementById('adminNav').style.display = 'block';
    document.getElementById('studentNav').style.display = 'none';
    currentLoggedInStudentId = null;
    applyBranding();
    startClock();
    autoGenerateMonthlyFees();
    showPage('dashboard');
  } else {
    document.getElementById('loginErr').textContent = '⚠ Invalid Admin ID or Password';
    document.getElementById('loginErr').style.display='block';
    setTimeout(()=>document.getElementById('loginErr').style.display='none', 3000);
  }
}

function doLogout(){ 
  currentLoggedInStudentId = null;
  pendingAttendanceStatus = null;
  document.getElementById('dashPage').style.display='none'; 
  document.getElementById('loginPage').style.display='flex'; 
  document.getElementById('loginErr').style.display='none';
  document.getElementById('studentLoginPwd').value = '';
  document.getElementById('studentLoginId').value = '';
}
function startClock(){ 
  function tick(){ 
    const now=new Date(); 
    const timeStr = now.toLocaleTimeString('en-IN',{hour12:false}) + ' IST';
    document.getElementById('navTime').textContent = timeStr;
    document.getElementById('footerTime').textContent = timeStr;
  } 
  tick(); 
  setInterval(tick,1000);
  document.getElementById('footerStatus').textContent = '🟢 System Online';
}
function applyBranding(){
  document.getElementById('navLibName').textContent = DB.settings.libraryName || 'SELF STUDY LIBRARY';
  document.getElementById('navEmblem').textContent = DB.settings.logo || '📚';
  document.getElementById('footerLibName').textContent = DB.settings.libraryName || 'SELF STUDY LIBRARY';
  if(DB.settings.darkMode) document.body.classList.add('light-mode'); else document.body.classList.remove('light-mode');
}
function toggleDarkMode(){ DB.settings.darkMode = !DB.settings.darkMode; saveData(); applyBranding(); }

/* ============ SIDEBAR ============ */
function toggleSidebar(){
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('active');
}
function closeSidebar(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); }

/* ============ PAGE NAV ============ */
function showPage(name){
  closeSidebar();
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const page = document.getElementById('page-'+name);
  if(page) page.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const item = document.querySelector('.nav-item[data-page="'+name+'"]');
  if(item) item.classList.add('active');
  
  const renderers = { 
    dashboard:renderDashboard, students:renderStudents, seats:renderSeats, 
    attendance:renderAttendancePage, payments:renderPayments, reports:renderReportPage, 
    notifications:renderNotifications, settings:renderSettingsPage,
    'student-dashboard':renderStudentDashboard,
    'student-attendance':renderStudentAttendance,
    'student-fees':renderStudentFees,
    'student-seat':renderStudentSeat,
    'student-profile':renderStudentProfile,
    'student-notifications':renderStudentNotifications,
    'student-receipts':renderStudentReceipts
  };
  if(renderers[name]) renderers[name]();
  document.getElementById('mainWrap').scrollTop = 0;
}

/* ============ LOAD / SAVE ============ */
function loadData(){
  const saved = localStorage.getItem(LS_KEY);
  if(saved){ DB = JSON.parse(saved); }
  else seedDemoData();
  if(!DB.settings) DB.settings = {};
  if(!DB.settings.libraryName) DB.settings.libraryName = 'SELF STUDY LIBRARY';
  if(!DB.settings.logo) DB.settings.logo = '📚';
  if(!DB.settings.monthlyFee) DB.settings.monthlyFee = 1000;
  if(!DB.admins || !DB.admins.length) DB.admins = [{id:uid(), username:'admin', password:'12345'}];
  if(!DB.notifications) DB.notifications = [];
  if(!DB.settings.attendanceCode) DB.settings.attendanceCode = generateAttendanceCode();
  DB.students.forEach(s => { if(!s.password) s.password = s.studentId; });
  saveData();
  autoGenerateMonthlyFees();
}
function saveData(){ localStorage.setItem(LS_KEY, JSON.stringify(DB)); }

function autoGenerateMonthlyFees(){
  const today = new Date();
  DB.students.forEach(student => {
    if(student.status !== 'Active') return;
    const joiningDate = new Date(student.joiningDate);
    const monthsSinceJoining = (today.getFullYear() - joiningDate.getFullYear()) * 12 + (today.getMonth() - joiningDate.getMonth());
    const monthlyFee = getMonthlyFee();
    
    for(let i = 1; i <= monthsSinceJoining + 1; i++) {
      const dueDate = getNextDueDate(student.joiningDate, i);
      const monthLabel = getMonthLabel(dueDate);
      
      const existing = DB.payments.find(p => p.studentId === student.id && p.month === monthLabel && p.type === 'Monthly');
      if(!existing) {
        DB.payments.push({
          id: uid(),
          studentId: student.id,
          type: 'Monthly',
          month: monthLabel,
          amount: monthlyFee,
          paidAmount: 0,
          dueDate: dueDate,
          paidDate: '',
          status: 'Pending',
          discount: 0,
          fine: 0,
          advance: 0,
          receiptNo: ''
        });
      }
    }
  });
  saveData();
}

function seedDemoData(){
  const seats = [];
  for(let i=1;i<=40;i++) seats.push({ number:i, status:'Available', studentId:null, history:[] });
  const mkStudent = (name, father, mobile, seatNum, joinDaysAgo) => {
    const id = uid();
    const jd = new Date(); jd.setDate(jd.getDate()-joinDaysAgo);
    const studentId = genStudentId();
    return { id, studentId, photo:'', fullName:name, fatherName:father, mobile, whatsapp:mobile, email:'',
      address:'Varanasi, UP', aadhaar:'', dob:'2003-05-10', joiningDate: jd.toISOString().slice(0,10),
      seatNumber: seatNum, status:'Active', password: studentId };
  };
  const s1 = mkStudent('Aarav Sharma','Rakesh Sharma','9876543210',1,20);
  const s2 = mkStudent('Ishita Verma','Suresh Verma','9812345678',2,10);
  const s3 = mkStudent('Rohan Gupta','Manoj Gupta','9901234567',3,5);
  DB.students = [s1,s2,s3].map((s,idx)=>({...s, studentId: 'STU-' + String(idx+1).padStart(4,'0'), password: 'STU-' + String(idx+1).padStart(4,'0')}));
  DB.students.forEach(s=>{ const seat = seats.find(x=>x.number===s.seatNumber); if(seat){ seat.status='Occupied'; seat.studentId=s.id; seat.history.push({date:s.joiningDate,type:'Assigned',detail:s.fullName}); } });
  DB.seats = seats;
  const monthLabel = monthLabelNow();
  const monthlyFee = 1000;
  DB.payments = [];
  DB.students.forEach((s,idx)=>{
    const joinDate = new Date(s.joiningDate);
    DB.payments.push({ id:uid(), studentId:s.id, type:'Admission', amount:500, paidAmount:500, month:'', dueDate:s.joiningDate, paidDate:s.joiningDate, status:'Paid', discount:0, fine:0, advance:0, receiptNo:'RCPT'+(1000+idx*2) });
    
    for(let i=1; i<=2; i++) {
      const dueDate = getNextDueDate(s.joiningDate, i);
      const mLbl = getMonthLabel(dueDate);
      const isPaid = idx !== 2 || i !== 2;
      DB.payments.push({ 
        id:uid(), 
        studentId:s.id, 
        type:'Monthly', 
        amount:monthlyFee, 
        paidAmount: isPaid ? monthlyFee : 0,
        month:mLbl, 
        dueDate:dueDate, 
        paidDate: isPaid ? todayStr() : '', 
        status: isPaid ? 'Paid' : 'Pending', 
        discount:0, 
        fine:0, 
        advance:0, 
        receiptNo: isPaid ? 'RCPT'+(1001+idx*2+i) : '' 
      });
    }
  });
  DB.attendance = [ { id:uid(), studentId:s1.id, date:todayStr(), checkIn:'Present', checkOut:'' }, { id:uid(), studentId:s2.id, date:todayStr(), checkIn:'Present', checkOut:'' } ];
  DB.admins = [{ id:uid(), username:'admin', password:'12345' }];
  DB.settings = { libraryName:'SELF STUDY LIBRARY', logo:'📚', openTime:'06:00', closeTime:'22:00', monthlyFee:1000, rules:'1. Maintain complete silence.\n2. Mobile phones on silent mode.\n3. No outside food or drinks.\n4. Keep your seat clean and tidy.\n5. Return books to their designated shelves.', attendanceCode: generateAttendanceCode() };
  DB.notifications = [];
  saveData();
}

/* ===== STUDENT DASHBOARD RENDERERS ===== */
function getStudentSession() {
  return currentLoggedInStudentId ? getStudent(currentLoggedInStudentId) : null;
}

function renderStudentDashboard() {
  const s = getStudentSession();
  if (!s) { showToast('Session expired'); doLogout(); return; }
  document.getElementById('sDashName').textContent = s.fullName;
  document.getElementById('sDashName2').textContent = s.fullName;
  document.getElementById('sDashAvatar').innerHTML = s.photo ? `<img src="${s.photo}">` : '🧑';
  document.getElementById('sDashId').textContent = s.studentId;
  document.getElementById('sDashMobile').textContent = s.mobile || '—';
  document.getElementById('sDashSeat').textContent = s.seatNumber ? '#'+s.seatNumber : 'Not assigned';
  document.getElementById('sDashJoin').textContent = fmtDate(s.joiningDate);
  
  const ps = getStudentPaymentStatus(s.id);
  const att = DB.attendance.filter(a => a.studentId === s.id);
  const present = att.filter(a => a.checkIn === 'Present').length;
  const total = att.length;
  const pendingFees = ps.balance || 0;
  
  document.getElementById('sDashStats').innerHTML = [
    ['📅', 'Total Days', total],
    ['✅', 'Present', present],
    ['💰', 'Fee Balance', money(pendingFees)],
    ['🪑', 'Seat', s.seatNumber ? '#'+s.seatNumber : '—'],
  ].map(([ic,label,val])=>`<div class="stat-card"><div class="stat-icon">${ic}</div><div class="stat-label">${label}</div><div class="stat-value">${val}</div></div>`).join('');
}

function renderStudentAttendance() {
  const s = getStudentSession();
  if (!s) return;
  const att = DB.attendance.filter(a => a.studentId === s.id).sort((a,b) => new Date(b.date) - new Date(a.date));
  const present = att.filter(a => a.checkIn === 'Present').length;
  const total = att.length;
  document.getElementById('sAttStats').innerHTML = [
    ['✅', 'Present', present],
    ['📅', 'Total', total],
  ].map(([ic,label,val])=>`<div class="stat-card"><div class="stat-icon">${ic}</div><div class="stat-label">${label}</div><div class="stat-value">${val}</div></div>`).join('');
  
  const todayRec = DB.attendance.find(a => a.studentId === s.id && a.date === todayStr());
  document.getElementById('studentTodayAtt').innerHTML = todayRec ? 
    `<div style="padding:8px 12px; border-radius:8px; background:${todayRec.checkIn === 'Present' ? 'rgba(39,174,96,0.15)' : 'rgba(192,57,43,0.15)'}; border:1px solid ${todayRec.checkIn === 'Present' ? '#27ae60' : '#c0392b'};">
      Today's Status: <b>${todayRec.checkIn === 'Present' ? '✅ Present' : '❌ Absent'}</b>
     </div>` : 
    `<div style="padding:8px 12px; border-radius:8px; background:rgba(201,162,39,0.08); border:1px solid var(--gold-dim);">
      Today's Status: <b>Not marked yet</b>
     </div>`;
  
  document.getElementById('sAttTbody').innerHTML = att.length ? att.map(a => 
    `<tr><td>${fmtDate(a.date)}</td><td>${a.checkIn === 'Present' ? '✅ Present' : '❌ Absent'}</td></tr>`
  ).join('') : '<tr><td colspan="2" style="text-align:center;padding:18px;">No attendance records</td></tr>';
}

function renderStudentFees() {
  const s = getStudentSession();
  if (!s) return;
  const ps = getStudentPaymentStatus(s.id);
  document.getElementById('sFeeMonthly').textContent = money(getMonthlyFee());
  document.getElementById('sFeePaid').textContent = money(ps.totalPaid || 0);
  document.getElementById('sFeePending').textContent = money(ps.balance || 0);
  
  const payments = DB.payments.filter(p => p.studentId === s.id).sort((a,b) => new Date(b.dueDate) - new Date(a.dueDate));
  const latest = payments.find(p => p.status === 'Pending' || p.status === 'Partial');
  document.getElementById('sFeeDue').textContent = latest ? fmtDate(latest.dueDate) : '—';
  const badge = document.getElementById('sFeeStatusBadge');
  badge.textContent = ps.status;
  badge.className = 'badge ' + (ps.status === 'Paid' ? 'badge-paid' : ps.status === 'Partial' ? 'badge-partial' : 'badge-pending');
  
  document.getElementById('sFeeTbody').innerHTML = payments.length ? payments.map(p => {
    const balance = getPaymentBalance(p);
    return `<tr>
      <td>${p.type}</td>
      <td>${p.month || '—'}</td>
      <td>${money(p.amount)}</td>
      <td>${money(p.paidAmount || 0)}</td>
      <td>${money(balance)}</td>
      <td><span class="badge ${p.status === 'Paid' ? 'badge-paid' : p.status === 'Partial' ? 'badge-partial' : 'badge-pending'}">${p.status}</span></td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" style="text-align:center;padding:18px;">No fee records</td></tr>';
}

function renderStudentSeat() {
  const s = getStudentSession();
  if (!s) return;
  document.getElementById('sSeatNumber').textContent = s.seatNumber ? '#'+s.seatNumber : 'Not assigned';
  const seat = s.seatNumber ? getSeat(s.seatNumber) : null;
  const statusEl = document.getElementById('sSeatStatus');
  if (seat) {
    statusEl.textContent = seat.status;
    statusEl.className = 'badge ' + (seat.status === 'Available' ? 'badge-avail' : seat.status === 'Occupied' ? 'badge-occ' : 'badge-res');
    const alloc = seat.history.find(h => h.type === 'Assigned' && h.detail === s.fullName);
    document.getElementById('sSeatAllocDate').textContent = alloc ? fmtDate(alloc.date) : '—';
  } else {
    statusEl.textContent = 'Not Allocated';
    statusEl.className = 'badge badge-inactive';
    document.getElementById('sSeatAllocDate').textContent = '—';
  }
}

function renderStudentProfile() {
  const s = getStudentSession();
  if (!s) return;
  document.getElementById('sProfAvatar').innerHTML = s.photo ? `<img src="${s.photo}">` : '🧑';
  document.getElementById('sProfName').textContent = s.fullName;
  document.getElementById('sProfId').textContent = s.studentId;
  document.getElementById('sProfMobile').textContent = s.mobile || '—';
  document.getElementById('sProfFather').textContent = s.fatherName || '—';
  document.getElementById('sProfDob').textContent = fmtDate(s.dob);
  document.getElementById('sProfEmail').textContent = s.email || '—';
  document.getElementById('sProfAadhaar').textContent = s.aadhaar || '—';
  document.getElementById('sProfAddress').textContent = s.address || '—';
}

function changeStudentPassword() {
  const s = getStudentSession();
  if (!s) return;
  const newPwd = document.getElementById('sNewPwd').value.trim();
  if (newPwd.length < 4) { showToast('Password must be at least 4 characters'); return; }
  s.password = newPwd;
  saveData();
  showToast('Password updated successfully!');
  document.getElementById('sNewPwd').value = '';
}

function renderStudentNotifications() {
  const s = getStudentSession();
  if (!s) return;
  const notifs = DB.notifications ? DB.notifications.filter(n => n.studentId === s.id || n.studentId === 'all') : [];
  document.getElementById('sNotifList').innerHTML = notifs.length ? notifs.sort((a,b)=> new Date(b.date) - new Date(a.date)).map(n =>
    `<div class="panel" style="border-left:4px solid var(--gold);">
      <div style="font-size:12px; color:var(--text-secondary);">${fmtDate(n.date)}</div>
      <div>${n.message}</div>
    </div>`
  ).join('') : '<div class="panel"><div class="empty-state"><div class="icon">📭</div>No notifications</div></div>';
}

function renderStudentReceipts() {
  const s = getStudentSession();
  if (!s) return;
  const receipts = DB.payments.filter(p => p.studentId === s.id && p.status === 'Paid' && p.receiptNo);
  document.getElementById('sReceiptList').innerHTML = receipts.length ? receipts.map(p => {
    const balance = getPaymentBalance(p);
    return `<div class="panel" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
      <div><b>${p.receiptNo}</b> — ${p.type}${p.month ? ' ('+p.month+')' : ''} — ${money(p.paidAmount)}</div>
      <div class="action-group">
        <button class="action-btn btn-pay" onclick="viewStudentReceipt('${p.id}')">🧾 View</button>
        <button class="action-btn btn-wa" onclick="sendStudentReceipt('${p.id}')">📱 WA</button>
      </div>
    </div>`;
  }).join('') : '<div class="panel"><div class="empty-state"><div class="icon">🧾</div>No receipts available</div></div>';
}

function viewStudentReceipt(id) {
  const p = DB.payments.find(x=>x.id===id); if(!p) return;
  const s = getStudentSession();
  const balance = getPaymentBalance(p);
  document.getElementById('receiptBody').innerHTML = `
    <div style="text-align:center; margin-bottom:12px;"><b style="font-size:18px;">${DB.settings.libraryName}</b><br><span style="font-size:11px; color:var(--text-secondary);">Payment Receipt</span></div>
    <div>Receipt No: <b>${p.receiptNo||'—'}</b></div>
    <div>Date: <b>${fmtDate(p.paidDate||p.dueDate)}</b></div>
    <div>Student: <b>${s?s.fullName:''} (${s?s.studentId:''})</b></div>
    <div>Type: <b>${p.type}${p.month?' · '+p.month:''}</b></div>
    <div>Due Date: <b>${fmtDate(p.dueDate)}</b></div>
    <hr style="border-color:#c9a22740; margin:6px 0;">
    <div>Total Amount: <b>${money(p.amount)}</b></div>
    <div>Paid Amount: <b>${money(p.paidAmount||0)}</b></div>
    <div>Balance: <b>${money(balance)}</b></div>
    <hr style="border-color:#c9a22740; margin:6px 0;">
    <div style="font-size:11px; margin-top:6px;">Status: <span class="badge badge-paid">Paid</span></div>
  `;
  document.getElementById('receiptModal').classList.add('active');
}

function sendStudentReceipt(id) {
  const p = DB.payments.find(x=>x.id===id); if(!p) return;
  const s = getStudentSession(); if(!s) return;
  const balance = getPaymentBalance(p);
  const msg = `📄 ${DB.settings.libraryName} - Payment Receipt\n\nStudent: ${s.fullName} (${s.studentId})\n${p.type}${p.month?' ('+p.month+')':''}\nAmount: ${money(p.amount)}\nPaid: ${money(p.paidAmount||0)}\nBalance: ${money(balance)}\nReceipt: ${p.receiptNo||'—'}\n\nThank you! 📚`;
  const phone = s.whatsapp || s.mobile;
  if(phone) { window.open(`https://wa.me/91${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank'); showToast('Sending receipt via WhatsApp'); }
  else showToast('No WhatsApp number');
}

/* ===== ATTENDANCE VERIFICATION ===== */
function markStudentAttendance(status) {
  const s = getStudentSession();
  if (!s) { showToast('Session expired'); return; }
  
  const existing = DB.attendance.find(a => a.studentId === s.id && a.date === todayStr());
  if (existing) {
    showToast('Attendance already marked for today');
    renderStudentAttendance();
    return;
  }
  
  const code = getAttendanceCode();
  if (!code) {
    showToast('Attendance system is disabled. Contact admin.');
    return;
  }
  
  pendingAttendanceStatus = status;
  document.getElementById('attVerifyCode').value = '';
  document.getElementById('attendanceVerifyModal').classList.add('active');
}

function submitAttendanceVerify() {
  const enteredCode = document.getElementById('attVerifyCode').value.trim();
  const actualCode = getAttendanceCode();
  
  if (!actualCode) {
    showToast('Attendance system is disabled');
    closeModal('attendanceVerifyModal');
    return;
  }
  
  if (enteredCode === actualCode) {
    const s = getStudentSession();
    if (s && pendingAttendanceStatus) {
      DB.attendance.push({
        id: uid(),
        studentId: s.id,
        date: todayStr(),
        checkIn: pendingAttendanceStatus,
        checkOut: ''
      });
      saveData();
      showToast(`✅ Attendance marked as ${pendingAttendanceStatus}`);
      closeModal('attendanceVerifyModal');
      pendingAttendanceStatus = null;
      renderStudentAttendance();
    }
  } else {
    showToast('❌ Invalid Attendance Code');
    document.getElementById('attVerifyCode').value = '';
    document.getElementById('attVerifyCode').focus();
  }
}

/* ===== ADMIN FUNCTIONS ===== */
function renderDashboard() {
  const totalStudents = DB.students.length;
  const totalSeats = DB.seats.length;
  const occupied = DB.seats.filter(s=>s.status==='Occupied').length;
  const available = DB.seats.filter(s=>s.status==='Available').length;
  const pendingFees = DB.students.filter(s=>{
    const ps = getStudentPaymentStatus(s.id);
    return ps.status === 'Pending' || ps.status === 'Partial';
  }).length;
  const mLabel = monthLabelNow();
  const monthlyCollection = DB.payments.filter(p=>p.status==='Paid' && p.month===mLabel).reduce((sum,p)=>sum + (Number(p.paidAmount)||0),0);
  const newAdmissions = DB.students.filter(s=> s.joiningDate && s.joiningDate.slice(0,7)===todayStr().slice(0,7)).length;
  const todaysAttendance = DB.attendance.filter(a=>a.date===todayStr() && a.checkIn==='Present').length;
  const stats = [
    ['🎓','Total Students', totalStudents],
    ['🪑','Total Seats', totalSeats],
    ['🔴','Occupied', occupied],
    ['🟢','Available', available],
    ['⚠️','Pending Fees', pendingFees],
    ['💰','Monthly Collection', money(monthlyCollection)],
    ['🆕','New Admissions', newAdmissions],
    ['✅',"Today's Attend.", todaysAttendance],
  ];
  document.getElementById('dashStats').innerHTML = stats.map(([ic,label,val])=>`<div class="stat-card"><div class="stat-icon">${ic}</div><div class="stat-label">${label}</div><div class="stat-value">${val}</div></div>`).join('');
  const pct = totalSeats ? Math.round(occupied/totalSeats*100) : 0;
  document.getElementById('occBar').style.width = pct + '%';
  document.getElementById('occBar').textContent = pct + '%';
  document.getElementById('occText').textContent = `${occupied} of ${totalSeats} seats occupied, ${available} available.`;
  const recent = [...DB.students].sort((a,b)=> new Date(b.joiningDate) - new Date(a.joiningDate)).slice(0,6);
  document.getElementById('recentAdmissions').innerHTML = recent.length ? recent.map(s=>`<li><span>${s.fullName}</span><span style="color:var(--text-secondary);">${fmtDate(s.joiningDate)}</span></li>`).join('') : '<li style="color:var(--text-secondary);">No students yet.</li>';
}

function renderStudents() {
  const q = (document.getElementById('stuSearch').value||'').toLowerCase();
  const statusF = document.getElementById('stuStatusFilter').value;
  const feeF = document.getElementById('stuFeeFilter').value;
  let list = DB.students.filter(s => {
    const match = s.fullName.toLowerCase().includes(q) || (s.mobile||'').includes(q) || s.studentId.toLowerCase().includes(q) || (s.seatNumber && String(s.seatNumber).includes(q));
    if(!match) return false;
    if(statusF && s.status!==statusF) return false;
    const ps = getStudentPaymentStatus(s.id);
    if(feeF) {
      if(feeF === 'Paid' && ps.status !== 'Paid') return false;
      if(feeF === 'Pending' && ps.status !== 'Pending' && ps.status !== 'Partial') return false;
    }
    return true;
  });
  const tbody = document.getElementById('studentsTbody');
  if(!list.length){ tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;"><div class="empty-state"><div class="icon">📭</div>No students found</div></td></tr>'; return; }
  tbody.innerHTML = list.map(s=>{
    const ps = getStudentPaymentStatus(s.id);
    const avatar = s.photo ? `<img src="${s.photo}">` : '🧑';
    return `<tr>
      <td><span class="avatar">${avatar}</span><span class="row-link" onclick="openProfile('${s.id}')">${s.fullName}</span><br><span style="font-size:10px; color:var(--text-secondary); margin-left:42px;">${s.studentId}</span></td>
      <td>${s.mobile||'—'}</td>
      <td>${s.seatNumber ? '#'+s.seatNumber : '—'}</td>
      <td><span class="badge ${s.status==='Active'?'badge-active':'badge-inactive'}">${s.status}</span></td>
      <td><span class="badge ${ps.status==='Paid'?'badge-paid':ps.status==='Partial'?'badge-partial':'badge-pending'}">${ps.status}${ps.balance > 0 ? ' (₹'+ps.balance+')' : ''}</span></td>
      <td><div class="action-group">
        <button class="action-btn btn-wa" onclick="waStudent('${s.id}')">📱</button>
        <button class="action-btn btn-edit" onclick="openEditStudent('${s.id}')">✏</button>
        <button class="action-btn btn-del" onclick="deleteStudent('${s.id}')">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

function fillSeatOptions(selectEl, keepCurrent){
  const free = DB.seats.filter(s=>s.status!=='Occupied' || s.number===keepCurrent);
  selectEl.innerHTML = '<option value="">-- No Seat --</option>' + free.map(s=>`<option value="${s.number}">Seat #${s.number} (${s.number===keepCurrent?'Current':s.status})</option>`).join('');
}

function openAddStudent(){
  document.getElementById('studentModalTitle').textContent = 'ADD STUDENT';
  document.getElementById('editId').value = '';
  ['fFullName','fFatherName','fMobile','fWhatsapp','fEmail','fAadhaar','fDob','fJoiningDate','fAddress'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fJoiningDate').value = todayStr();
  document.getElementById('fStatus').value = 'Active';
  document.getElementById('photoPreview').innerHTML = '🧑';
  window._newPhoto = '';
  fillSeatOptions(document.getElementById('fSeatNumber'), null);
  document.getElementById('studentModal').classList.add('active');
}
function openEditStudent(id){
  const s = getStudent(id); if(!s) return;
  document.getElementById('studentModalTitle').textContent = 'EDIT STUDENT';
  document.getElementById('editId').value = s.id;
  document.getElementById('fFullName').value = s.fullName;
  document.getElementById('fFatherName').value = s.fatherName||'';
  document.getElementById('fMobile').value = s.mobile||'';
  document.getElementById('fWhatsapp').value = s.whatsapp||'';
  document.getElementById('fEmail').value = s.email||'';
  document.getElementById('fAadhaar').value = s.aadhaar||'';
  document.getElementById('fDob').value = s.dob||'';
  document.getElementById('fJoiningDate').value = s.joiningDate||'';
  document.getElementById('fAddress').value = s.address||'';
  document.getElementById('fStatus').value = s.status||'Active';
  document.getElementById('photoPreview').innerHTML = s.photo ? `<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover;">` : '🧑';
  window._newPhoto = s.photo || '';
  fillSeatOptions(document.getElementById('fSeatNumber'), s.seatNumber);
  document.getElementById('fSeatNumber').value = s.seatNumber || '';
  document.getElementById('studentModal').classList.add('active');
}
function handlePhotoUpload(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{ window._newPhoto = reader.result; document.getElementById('photoPreview').innerHTML = `<img src="${reader.result}" style="width:100%;height:100%;object-fit:cover;">`; };
  reader.readAsDataURL(file);
}
function saveStudent(){
  const fullName = document.getElementById('fFullName').value.trim();
  const mobile = document.getElementById('fMobile').value.trim();
  if(!fullName){ showToast('Full name is required'); return; }
  if(!mobile){ showToast('Mobile number is required'); return; }
  const editId = document.getElementById('editId').value;
  const newSeatNumber = document.getElementById('fSeatNumber').value ? Number(document.getElementById('fSeatNumber').value) : null;
  const data = {
    fullName, fatherName: document.getElementById('fFatherName').value,
    mobile, whatsapp: document.getElementById('fWhatsapp').value,
    email: document.getElementById('fEmail').value, aadhaar: document.getElementById('fAadhaar').value,
    dob: document.getElementById('fDob').value, joiningDate: document.getElementById('fJoiningDate').value,
    address: document.getElementById('fAddress').value, status: document.getElementById('fStatus').value,
    photo: window._newPhoto || ''
  };
  if(editId){
    const s = getStudent(editId);
    const oldSeat = s.seatNumber;
    if(oldSeat !== newSeatNumber){
      if(oldSeat){ const os = getSeat(oldSeat); if(os){ os.status='Available'; os.studentId=null; os.history.push({date:todayStr(),type:'Vacated',detail:s.fullName}); } }
      if(newSeatNumber){ const ns = getSeat(newSeatNumber); if(ns){ ns.status='Occupied'; ns.studentId=s.id; ns.history.push({date:todayStr(),type:'Assigned',detail:fullName}); } }
    }
    Object.assign(s, data, {seatNumber:newSeatNumber});
    showToast('Student updated');
  } else {
    const id = uid();
    const studentId = genStudentId();
    const newStudent = { id, studentId, seatNumber:newSeatNumber, ...data, password: studentId };
    DB.students.push(newStudent);
    if(newSeatNumber){ const ns = getSeat(newSeatNumber); if(ns){ ns.status='Occupied'; ns.studentId=id; ns.history.push({date:todayStr(),type:'Assigned',detail:fullName}); } }
    const joiningDate = data.joiningDate || todayStr();
    const dueDate = getNextDueDate(joiningDate, 1);
    const monthLabel = getMonthLabel(dueDate);
    DB.payments.push({
      id: uid(),
      studentId: id,
      type: 'Monthly',
      month: monthLabel,
      amount: getMonthlyFee(),
      paidAmount: 0,
      dueDate: dueDate,
      paidDate: '',
      status: 'Pending',
      discount: 0,
      fine: 0,
      advance: 0,
      receiptNo: ''
    });
    showToast('Student added with default password: ' + studentId);
  }
  saveData(); renderStudents(); closeModal('studentModal');
}
function deleteStudent(id){
  showConfirm('Delete this student permanently?', ()=>{
    const s = getStudent(id);
    if(s && s.seatNumber){ const seat = getSeat(s.seatNumber); if(seat){ seat.status='Available'; seat.studentId=null; seat.history.push({date:todayStr(),type:'Vacated',detail:s.fullName}); } }
    DB.students = DB.students.filter(x=>x.id!==id);
    DB.payments = DB.payments.filter(p=>p.studentId!==id);
    DB.attendance = DB.attendance.filter(a=>a.studentId!==id);
    saveData(); renderStudents(); showToast('Student deleted');
  });
}
function waStudent(id){
  const s = getStudent(id); if(!s) return;
  const ps = getStudentPaymentStatus(id);
  const msg = `📚 ${DB.settings.libraryName}\n\nStudent: ${s.fullName}\nID: ${s.studentId}\nSeat: ${s.seatNumber||'Not assigned'}\nFee Status: ${ps.status}\nBalance: ${money(ps.balance)}\n\nThank you for being part of our library.`;
  const phone = s.whatsapp || s.mobile;
  if(phone) window.open(`https://wa.me/91${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank');
  else showToast('No WhatsApp number on file');
}
function openProfile(id){
  const s = getStudent(id); if(!s) return;
  document.getElementById('profAvatar').innerHTML = s.photo ? `<img src="${s.photo}">` : '🧑';
  document.getElementById('profName').textContent = s.fullName;
  document.getElementById('profMeta').textContent = `${s.studentId} · ${s.status}`;
  document.getElementById('profStudentId').textContent = s.studentId;
  document.getElementById('profStatus').innerHTML = `<span class="badge ${s.status==='Active'?'badge-active':'badge-inactive'}">${s.status}</span>`;
  document.getElementById('profFather').textContent = s.fatherName || '—';
  document.getElementById('profDob').textContent = fmtDate(s.dob);
  document.getElementById('profMobile').textContent = s.mobile || '—';
  document.getElementById('profWhatsapp').textContent = s.whatsapp || '—';
  document.getElementById('profEmail').textContent = s.email || '—';
  document.getElementById('profAadhaar').textContent = s.aadhaar || '—';
  document.getElementById('profJoin').textContent = fmtDate(s.joiningDate);
  document.getElementById('profSeat').textContent = s.seatNumber ? '#'+s.seatNumber : '—';
  document.getElementById('profAddress').textContent = s.address || '—';
  const fees = DB.payments.filter(p=>p.studentId===id);
  document.getElementById('profFeeList').innerHTML = fees.length ? fees.map(p=>{
    const balance = getPaymentBalance(p);
    return `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #c9a2271a; font-size:12px;">
      <span>${p.type}${p.month?' · '+p.month:''}</span>
      <span>${money(p.amount)} | Paid: ${money(p.paidAmount||0)} | Balance: ${money(balance)} <span class="badge ${p.status==='Paid'?'badge-paid':p.status==='Partial'?'badge-partial':'badge-pending'}">${p.status}</span></span>
    </div>`;
  }).join('') : '<div style="color:var(--text-secondary);">No fee records.</div>';
  const att = DB.attendance.filter(a=>a.studentId===id).sort((a,b)=> new Date(b.date)-new Date(a.date)).slice(0,10);
  document.getElementById('profAttList').innerHTML = att.length ? att.map(a=>`<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12px;"><span>${fmtDate(a.date)}</span><span>Status: ${a.checkIn||'—'}</span></div>`).join('') : '<div style="color:var(--text-secondary);">No attendance yet.</div>';
  document.getElementById('profileModal').classList.add('active');
}

function renderSeats(){
  const filter = document.getElementById('seatStatusFilter').value;
  const list = DB.seats.filter(s=> !filter || s.status===filter).sort((a,b)=>a.number-b.number);
  document.getElementById('seatGrid').innerHTML = list.map(s=>{
    const cls = s.status.toLowerCase();
    const student = s.studentId ? getStudent(s.studentId) : null;
    return `<div class="seat-cell ${cls}" onclick="openSeatModal(${s.number})" title="${student?student.fullName:s.status}"><div>${s.number}</div><div style="font-size:8px; opacity:.6;">${student ? student.fullName.split(' ')[0] : s.status}</div></div>`;
  }).join('');
}
function openSeatModal(num){
  const seat = getSeat(num); if(!seat) return;
  document.getElementById('seatModalTitle').textContent = 'Seat #' + num;
  document.getElementById('seatModalNumber').value = num;
  document.getElementById('seatModalStatus').textContent = seat.studentId ? `👤 Assigned to ${getStudent(seat.studentId)?.fullName || 'Unknown'}` : '✅ Vacant';
  const sel = document.getElementById('seatAssignStudent');
  const unassigned = DB.students.filter(s=> !s.seatNumber || s.seatNumber===num);
  sel.innerHTML = '<option value="">-- Vacant --</option>' + unassigned.map(s=>`<option value="${s.id}" ${s.id===seat.studentId?'selected':''}>${s.fullName} (${s.studentId})</option>`).join('');
  document.getElementById('seatStatusSelect').value = seat.status;
  document.getElementById('seatHistoryList').innerHTML = seat.history.length ? [...seat.history].reverse().map(h=>`<div style="padding:4px 0; border-bottom:1px solid #c9a2271a;">${fmtDate(h.date)} — <b>${h.type}</b> ${h.detail?('· '+h.detail):''}</div>`).join('') : '<div style="color:var(--text-secondary);">No history.</div>';
  document.getElementById('seatModal').classList.add('active');
}
function saveSeat(){
  const num = Number(document.getElementById('seatModalNumber').value);
  const seat = getSeat(num);
  const newStudentId = document.getElementById('seatAssignStudent').value || null;
  const newStatus = document.getElementById('seatStatusSelect').value;
  const oldStudentId = seat.studentId;
  if(oldStudentId && oldStudentId !== newStudentId){
    const oldS = getStudent(oldStudentId); if(oldS){ oldS.seatNumber = null; }
    seat.history.push({date:todayStr(), type:'Vacated', detail: oldS?oldS.fullName:''});
  }
  if(newStudentId && newStudentId !== oldStudentId){
    const ns = getStudent(newStudentId);
    if(ns.seatNumber){ const prevSeat = getSeat(ns.seatNumber); if(prevSeat){ prevSeat.status='Available'; prevSeat.studentId=null; prevSeat.history.push({date:todayStr(),type:'Transferred out',detail:ns.fullName}); } }
    ns.seatNumber = num;
    seat.history.push({date:todayStr(), type:'Assigned', detail: ns.fullName});
  }
  seat.studentId = newStudentId;
  seat.status = newStudentId ? 'Occupied' : newStatus;
  saveData(); renderSeats(); closeModal('seatModal'); showToast('Seat updated');
}
function openSeatCountModal(){
  document.getElementById('currentSeatCount').textContent = DB.seats.length;
  document.getElementById('newSeatTotal').value = DB.seats.length;
  document.getElementById('seatCountModal').classList.add('active');
}
function applySeatCount(){
  const total = parseInt(document.getElementById('newSeatTotal').value,10);
  if(!total || total < 1){ showToast('Enter a valid seat count'); return; }
  if(total > DB.seats.length){
    for(let i=DB.seats.length+1;i<=total;i++) DB.seats.push({number:i, status:'Available', studentId:null, history:[]});
  } else if(total < DB.seats.length){
    const removable = DB.seats.filter(s=>s.number>total);
    if(removable.some(s=>s.status==='Occupied')){ showToast('Cannot remove occupied seats'); return; }
    DB.seats = DB.seats.filter(s=>s.number<=total);
  }
  saveData(); renderSeats(); closeModal('seatCountModal'); showToast('Seat count updated');
}

function renderAttendancePage(){
  document.getElementById('attHistDate').value = '';
  renderAttendanceStats();
  renderAttendanceQuick();
  renderAttendanceHistory();
}
function todayRecord(studentId){ return DB.attendance.find(a=>a.studentId===studentId && a.date===todayStr()); }
function renderAttendanceStats(){
  const present = DB.attendance.filter(a=>a.date===todayStr() && a.checkIn==='Present').length;
  const totalToday = DB.attendance.filter(a=>a.date===todayStr()).length;
  document.getElementById('attStats').innerHTML = [
    ['✅','Present Today', present],
    ['❌','Absent Today', totalToday - present],
  ].map(([ic,label,val])=>`<div class="stat-card"><div class="stat-icon">${ic}</div><div class="stat-label">${label}</div><div class="stat-value">${val}</div></div>`).join('');
}
function renderAttendanceQuick(){
  const q = (document.getElementById('attSearch').value||'').toLowerCase();
  const list = DB.students.filter(s=>s.status==='Active' && (s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || (s.mobile||'').includes(q) || (s.seatNumber && String(s.seatNumber).includes(q))));
  document.getElementById('attQuickTbody').innerHTML = list.length ? list.map(s=>{
    const rec = todayRecord(s.id);
    const status = rec ? (rec.checkIn==='Present' ? '✅ Present' : '❌ Absent') : 'Not marked';
    const actionBtn = !rec ? `<button class="action-btn btn-in" onclick="markPresent('${s.id}')">Present</button><button class="action-btn btn-out" onclick="markAbsent('${s.id}')">Absent</button>` : 
      (rec.checkIn==='Present' ? `<button class="action-btn btn-out" onclick="markAbsent('${s.id}')">Absent</button>` : `<button class="action-btn btn-in" onclick="markPresent('${s.id}')">Present</button>`);
    return `<tr><td>${s.fullName}<br><span style="font-size:10px;color:var(--text-secondary);">${s.studentId}</span></td><td>${s.seatNumber?'#'+s.seatNumber:'—'}</td><td>${status}</td><td>${actionBtn}</td></tr>`;
  }).join('') : '<tr><td colspan="4" style="text-align:center; padding:18px;"><div class="empty-state"><div class="icon">🔍</div>No active students match</div></td></tr>';
}
function markPresent(studentId){
  const rec = todayRecord(studentId);
  if(rec){ rec.checkIn = 'Present'; }
  else { DB.attendance.push({ id:uid(), studentId, date: todayStr(), checkIn: 'Present', checkOut: '' }); }
  saveData(); renderAttendanceQuick(); renderAttendanceStats(); renderAttendanceHistory(); showToast('Marked Present');
}
function markAbsent(studentId){
  const rec = todayRecord(studentId);
  if(rec){ rec.checkIn = 'Absent'; }
  else { DB.attendance.push({ id:uid(), studentId, date: todayStr(), checkIn: 'Absent', checkOut: '' }); }
  saveData(); renderAttendanceQuick(); renderAttendanceStats(); renderAttendanceHistory(); showToast('Marked Absent');
}
function renderAttendanceHistory(){
  const dateF = document.getElementById('attHistDate').value;
  let list = [...DB.attendance].sort((a,b)=> new Date(b.date)-new Date(a.date));
  if(dateF) list = list.filter(a=>a.date===dateF);
  document.getElementById('attHistTbody').innerHTML = list.length ? list.map(a=>{
    const s = getStudent(a.studentId);
    return `<tr><td>${fmtDate(a.date)}</td><td>${s?s.fullName+' ('+s.studentId+')':'Unknown'}</td><td>${a.checkIn||'—'}</td></tr>`;
  }).join('') : '<tr><td colspan="3" style="text-align:center; padding:18px;"><div class="empty-state"><div class="icon">📅</div>No attendance records</div></td></tr>';
}

function renderPayments(){
  const mLabel = monthLabelNow();
  const collection = DB.payments.filter(p=>p.status==='Paid' && p.month===mLabel).reduce((sum,p)=>sum + (Number(p.paidAmount)||0),0);
  const pendingCount = DB.payments.filter(p=>p.status==='Pending' || p.status==='Partial').length;
  document.getElementById('payStats').innerHTML = [
    ['💰','Monthly Collection', money(collection)],
    ['⚠️','Pending Records', pendingCount],
  ].map(([ic,label,val])=>`<div class="stat-card"><div class="stat-icon">${ic}</div><div class="stat-label">${label}</div><div class="stat-value">${val}</div></div>`).join('');

  const monthSet = new Set();
  DB.payments.forEach(p => { if(p.month) monthSet.add(p.month); });
  const monthFilter = document.getElementById('payMonthFilter');
  const currentVal = monthFilter.value;
  monthFilter.innerHTML = '<option value="">All Months</option>' + [...monthSet].sort().map(m => `<option value="${m}">${m}</option>`).join('');
  monthFilter.value = currentVal;

  const q = (document.getElementById('paySearch').value||'').toLowerCase();
  const statusF = document.getElementById('payStatusFilter').value;
  const monthF = document.getElementById('payMonthFilter').value;
  let list = DB.payments.filter(p=>{
    const s = getStudent(p.studentId);
    if(!s) return false;
    const match = s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || (s.mobile||'').includes(q);
    if(!match) return false;
    if(statusF && p.status!==statusF) return false;
    if(monthF && p.month!==monthF) return false;
    return true;
  });
  list.sort((a,b) => new Date(b.dueDate) - new Date(a.dueDate));
  
  document.getElementById('paymentsTbody').innerHTML = list.length ? list.map(p=>{
    const s = getStudent(p.studentId);
    const balance = getPaymentBalance(p);
    return `<tr>
      <td>${s?s.fullName:''}<br><span style="font-size:10px; color:var(--text-secondary);">${s?s.studentId:''}</span></td>
      <td>${p.type}</td>
      <td>${p.month || '—'}</td>
      <td>${fmtDate(p.dueDate)}</td>
      <td>${money(p.amount)}</td>
      <td>${money(p.paidAmount||0)}</td>
      <td>${money(balance)}</td>
      <td><span class="badge ${p.status==='Paid'?'badge-paid':p.status==='Partial'?'badge-partial':'badge-pending'}">${p.status}</span></td>
      <td><div class="action-group" style="flex-wrap: nowrap; gap: 4px;">
        ${p.status==='Paid' ? `<button class="action-btn btn-pay" onclick="showReceipt('${p.id}')">🧾</button>` : 
          `<button class="action-btn btn-in" onclick="markPaymentPaid('${p.id}')">✅</button>`}
        <button class="action-btn btn-wa" onclick="sendPaymentReceipt('${p.id}')">📱</button>
        <button class="action-btn btn-edit" onclick="openEditPayment('${p.id}')">✏</button>
        <button class="action-btn btn-del" onclick="deletePayment('${p.id}')">🗑</button>
        <button class="action-btn btn-notify" onclick="sendPaymentNotification('${p.id}')">🔔</button>
      </div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="9" style="text-align:center; padding:18px;"><div class="empty-state"><div class="icon">💳</div>No fee records found</div></td></tr>';
}

function openAddPayment(){
  document.getElementById('paymentModalTitle').textContent = 'Add Fee Record';
  document.getElementById('editPaymentId').value = '';
  const sel = document.getElementById('pStudent');
  sel.innerHTML = DB.students.map(s=>`<option value="${s.id}">${s.fullName} (${s.studentId})</option>`).join('');
  document.getElementById('pType').value='Monthly';
  document.getElementById('pMonth').value= monthLabelNow();
  document.getElementById('pAmount').value= getMonthlyFee();
  document.getElementById('pPaidAmount').value= '';
  document.getElementById('pDueDate').value= todayStr();
  document.getElementById('pAdvance').value='';
  document.getElementById('pDiscount').value='';
  document.getElementById('pFine').value='';
  document.getElementById('pStatus').value='Pending';
  document.getElementById('paymentModal').classList.add('active');
}
function openEditPayment(id){
  const p = DB.payments.find(x=>x.id===id); if(!p) return;
  document.getElementById('paymentModalTitle').textContent = 'Edit Fee Record';
  document.getElementById('editPaymentId').value = id;
  const sel = document.getElementById('pStudent');
  sel.innerHTML = DB.students.map(s=>`<option value="${s.id}">${s.fullName} (${s.studentId})</option>`).join('');
  sel.value = p.studentId;
  document.getElementById('pType').value = p.type;
  document.getElementById('pMonth').value = p.month || '';
  document.getElementById('pAmount').value = p.amount;
  document.getElementById('pPaidAmount').value = p.paidAmount || 0;
  document.getElementById('pDueDate').value = p.dueDate || '';
  document.getElementById('pAdvance').value = p.advance || '';
  document.getElementById('pDiscount').value = p.discount || '';
  document.getElementById('pFine').value = p.fine || '';
  document.getElementById('pStatus').value = p.status;
  document.getElementById('paymentModal').classList.add('active');
}
function savePayment(){
  const editId = document.getElementById('editPaymentId').value;
  const amount = Number(document.getElementById('pAmount').value)||0;
  const paidAmount = Number(document.getElementById('pPaidAmount').value)||0;
  const status = document.getElementById('pStatus').value;
  
  let finalStatus = status;
  if(paidAmount === 0) finalStatus = 'Pending';
  else if(paidAmount >= amount) finalStatus = 'Paid';
  else if(paidAmount > 0 && paidAmount < amount) finalStatus = 'Partial';
  
  const data = {
    studentId: document.getElementById('pStudent').value,
    type: document.getElementById('pType').value,
    month: document.getElementById('pMonth').value,
    amount: amount,
    paidAmount: paidAmount,
    dueDate: document.getElementById('pDueDate').value,
    advance: Number(document.getElementById('pAdvance').value)||0,
    discount: Number(document.getElementById('pDiscount').value)||0,
    fine: Number(document.getElementById('pFine').value)||0,
    status: finalStatus,
  };
  if(!data.studentId){ showToast('Please select a student'); return; }
  if(!data.amount || data.amount <= 0){ showToast('Please enter a valid amount'); return; }
  if(editId){
    const p = DB.payments.find(x=>x.id===editId);
    Object.assign(p, data);
    if(p.status==='Paid' && !p.paidDate) p.paidDate = todayStr();
    if(p.status==='Paid' && !p.receiptNo) p.receiptNo = 'RCPT' + Math.floor(1000+Math.random()*9000);
    showToast('Fee record updated');
  } else {
    const rec = { id:uid(), ...data, paidDate: data.status==='Paid'?todayStr():'', receiptNo: data.status==='Paid' ? ('RCPT'+Math.floor(1000+Math.random()*9000)) : '' };
    DB.payments.push(rec);
    showToast('Fee record added');
  }
  saveData(); renderPayments(); closeModal('paymentModal');
}
function markPaymentPaid(id){
  const p = DB.payments.find(x=>x.id===id); if(!p) return;
  const balance = getPaymentBalance(p);
  if(balance <= 0){
    p.status='Paid'; 
    p.paidAmount = p.amount;
  } else {
    p.status='Partial';
    p.paidAmount = (p.paidAmount || 0) + balance;
  }
  p.paidDate = todayStr(); 
  p.receiptNo = p.receiptNo || ('RCPT'+Math.floor(1000+Math.random()*9000));
  saveData(); renderPayments(); showToast('Payment updated');
}
function deletePayment(id){
  showConfirm('Delete this fee record?', ()=>{ DB.payments = DB.payments.filter(p=>p.id!==id); saveData(); renderPayments(); showToast('Fee record deleted'); });
}

function sendPaymentNotification(id){
  const p = DB.payments.find(x=>x.id===id); if(!p) return;
  const s = getStudent(p.studentId); if(!s) return;
  const balance = getPaymentBalance(p);
  const msg = `📢 Fee Update for ${s.fullName} (${s.studentId})\n${p.type}${p.month ? ' ('+p.month+')' : ''}\nAmount: ${money(p.amount)}\nPaid: ${money(p.paidAmount||0)}\nBalance: ${money(balance)}\nStatus: ${p.status}\nDue: ${fmtDate(p.dueDate)}`;
  if (!DB.notifications) DB.notifications = [];
  DB.notifications.push({ id: uid(), studentId: s.id, message: msg, date: todayStr() });
  saveData();
  showToast('Notification sent to student');
  renderNotifications();
}

function sendAdminNotification(){
  const msg = document.getElementById('adminNotifMsg').value.trim();
  if (!msg) { showToast('Please enter a notification message'); return; }
  if (!DB.notifications) DB.notifications = [];
  DB.students.forEach(s => {
    DB.notifications.push({ id: uid(), studentId: s.id, message: '📢 ' + msg, date: todayStr() });
  });
  saveData();
  document.getElementById('adminNotifMsg').value = '';
  showToast('Notification sent to all students');
  renderNotifications();
}

function showReceipt(id){
  currentReceiptPaymentId = id;
  const p = DB.payments.find(x=>x.id===id); if(!p) return;
  const s = getStudent(p.studentId);
  const balance = getPaymentBalance(p);
  document.getElementById('receiptBody').innerHTML = `
    <div style="text-align:center; margin-bottom:12px;"><b style="font-size:18px;">${DB.settings.libraryName}</b><br><span style="font-size:11px; color:var(--text-secondary);">Payment Receipt</span></div>
    <div>Receipt No: <b>${p.receiptNo||'—'}</b></div>
    <div>Date: <b>${fmtDate(p.paidDate||p.dueDate)}</b></div>
    <div>Student: <b>${s?s.fullName:''} (${s?s.studentId:''})</b></div>
    <div>Type: <b>${p.type}${p.month?' · '+p.month:''}</b></div>
    <div>Due Date: <b>${fmtDate(p.dueDate)}</b></div>
    <hr style="border-color:#c9a22740; margin:6px 0;">
    <div>Total Amount: <b>${money(p.amount)}</b></div>
    <div>Paid Amount: <b>${money(p.paidAmount||0)}</b></div>
    <div>Discount: <b>${money(p.discount||0)}</b></div>
    <div>Fine: <b>${money(p.fine||0)}</b></div>
    <div>Advance: <b>${money(p.advance||0)}</b></div>
    <div>Balance: <b>${money(balance)}</b></div>
    <hr style="border-color:#c9a22740; margin:6px 0;">
    <div style="font-size:11px; margin-top:6px;">Status: <span class="badge ${p.status==='Paid'?'badge-paid':p.status==='Partial'?'badge-partial':'badge-pending'}">${p.status}</span></div>
  `;
  document.getElementById('receiptModal').classList.add('active');
}

function sendPaymentReceipt(id){
  const p = DB.payments.find(x=>x.id===id); if(!p) return;
  const s = getStudent(p.studentId); if(!s) return;
  const balance = getPaymentBalance(p);
  const msg = `📄 ${DB.settings.libraryName} - Payment Receipt\n\nStudent: ${s.fullName} (${s.studentId})\n${p.type}${p.month?' ('+p.month+')':''}\nAmount: ${money(p.amount)}\nPaid: ${money(p.paidAmount||0)}\nBalance: ${money(balance)}\nStatus: ${p.status}\nDue Date: ${fmtDate(p.dueDate)}\nReceipt: ${p.receiptNo||'—'}\n\nThank you for your payment! 📚`;
  const phone = s.whatsapp || s.mobile;
  if(phone) {
    window.open(`https://wa.me/91${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank');
    showToast('Sending receipt via WhatsApp');
  } else {
    showToast('No WhatsApp number on file');
  }
}

function sendReceiptWhatsApp(){
  if(currentReceiptPaymentId) {
    sendPaymentReceipt(currentReceiptPaymentId);
  } else {
    showToast('No receipt selected');
  }
}

function setReport(type){
  currentReport = type;
  document.querySelectorAll('#reportTabs .pill-tab').forEach(t=>t.classList.toggle('active', t.dataset.r===type));
  renderReportPage();
}
function renderReportPage(){
  const heading = {student:'Student Report', seat:'Seat Report', attendance:'Attendance Report', payment:'Payment Report', daily:'Daily Report', monthly:'Monthly Report', yearly:'Yearly Report'};
  document.getElementById('reportHeading').textContent = heading[currentReport] || 'Report';
  const {head, rows} = buildReportData();
  document.getElementById('reportThead').innerHTML = '<tr>' + head.map(h=>`<th>${h}</th>`).join('') + '</tr>';
  document.getElementById('reportTbody').innerHTML = rows.length ? rows.map(r=>'<tr>'+r.map(c=>`<td>${c}</td>`).join('')+'</tr>').join('') : `<tr><td colspan="${head.length}" style="text-align:center; padding:18px;"><div class="empty-state"><div class="icon">📋</div>No data available</div></td></tr>`;
}
function buildReportData(){
  if(currentReport==='student'){
    return { head:['Student ID','Name','Mobile','Seat','Status','Fee Status','Balance'], rows: DB.students.map(s=>{
      const ps = getStudentPaymentStatus(s.id);
      return [s.studentId,s.fullName,s.mobile,s.seatNumber?'#'+s.seatNumber:'—',s.status,ps.status,money(ps.balance)];
    }) };
  }
  if(currentReport==='seat'){
    return { head:['Seat No','Status','Student'], rows: DB.seats.map(s=>[s.number,s.status, s.studentId? (getStudent(s.studentId)?.fullName||'—'):'—']) };
  }
  if(currentReport==='attendance'){
    return { head:['Date','Student','Status'], rows: [...DB.attendance].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(a=>[fmtDate(a.date), getStudent(a.studentId)?.fullName||'Unknown', a.checkIn||'—']) };
  }
  if(currentReport==='payment'){
    return { head:['Student','Type','Month','Due Date','Amount','Paid','Balance','Status'], rows: DB.payments.map(p=>{
      const balance = getPaymentBalance(p);
      return [getStudent(p.studentId)?.fullName||'Unknown', p.type, p.month||'—', fmtDate(p.dueDate), money(p.amount), money(p.paidAmount||0), money(balance), p.status];
    }) };
  }
  if(currentReport==='daily'){
    const t = todayStr();
    const att = DB.attendance.filter(a=>a.date===t);
    return { head:['Student','Status'], rows: att.map(a=>[getStudent(a.studentId)?.fullName||'Unknown', a.checkIn||'—']) };
  }
  if(currentReport==='monthly'){
    const m = monthLabelNow();
    const pays = DB.payments.filter(p=>p.month===m);
    return { head:['Student','Type','Amount','Paid','Balance','Status'], rows: pays.map(p=>{
      const balance = getPaymentBalance(p);
      return [getStudent(p.studentId)?.fullName||'Unknown', p.type, money(p.amount), money(p.paidAmount||0), money(balance), p.status];
    }) };
  }
  if(currentReport==='yearly'){
    const y = new Date().getFullYear();
    const pays = DB.payments.filter(p=> (p.dueDate||'').slice(0,4)===String(y) );
    return { head:['Student','Type','Month','Amount','Paid','Balance','Status'], rows: pays.map(p=>{
      const balance = getPaymentBalance(p);
      return [getStudent(p.studentId)?.fullName||'Unknown', p.type, p.month||'—', money(p.amount), money(p.paidAmount||0), money(balance), p.status];
    }) };
  }
  return {head:[], rows:[]};
}
function exportReportCSV(){
  const {head, rows} = buildReportData();
  const csv = [head.join(','), ...rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
  downloadBlob(csv, 'text/csv', currentReport+'_report.csv');
  showToast('CSV exported');
}
function exportReportExcel(){
  const {head, rows} = buildReportData();
  const html = '<table><tr>'+head.map(h=>`<th>${h}</th>`).join('')+'</tr>'+rows.map(r=>'<tr>'+r.map(c=>`<td>${c}</td>`).join('')+'</tr>').join('')+'</table>';
  downloadBlob(html, 'application/vnd.ms-excel', currentReport+'_report.xls');
  showToast('Excel exported');
}
function printReport(){ window.print(); }
function downloadBlob(content, type, filename){
  const blob = new Blob([content], {type});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}
function exportStudentsCSV(){
  const head = ['Student ID','Full Name',"Father's Name",'Mobile','WhatsApp','Email','Address','Aadhaar','DOB','Joining Date','Seat','Status','Fee Status','Balance'];
  const rows = DB.students.map(s=>{
    const ps = getStudentPaymentStatus(s.id);
    return [s.studentId,s.fullName,s.fatherName,s.mobile,s.whatsapp,s.email,s.address,s.aadhaar,s.dob,s.joiningDate,s.seatNumber||'',s.status,ps.status,money(ps.balance)];
  });
  const csv = [head.join(','), ...rows.map(r=>r.map(c=>`"${String(c||'').replace(/"/g,'""')}"`).join(','))].join('\n');
  downloadBlob(csv,'text/csv','students.csv'); showToast('CSV exported');
}

function renderNotifications(){
  const pendingPays = DB.payments.filter(p=>p.status==='Pending' || p.status==='Partial');
  const list = pendingPays.map(p=>{
    const s = getStudent(p.studentId);
    return {p, s};
  }).filter(x=>x.s);
  document.getElementById('notifList').innerHTML = list.length ? list.map(({p,s})=>{
    const balance = getPaymentBalance(p);
    return `<div class="notif-card" style="border-left-color: var(--gold);">
      <div><b>${s.fullName}</b> (${s.studentId}) · ${p.type}${p.month?' ('+p.month+')':''} — Balance: ${money(balance)} due ${fmtDate(p.dueDate)}</div>
      <div class="action-group">
        <button class="action-btn" style="background:#4a3a1a; border:1px solid #f39c12; color:#f1c40f;" onclick="sendReminder('${s.id}','${p.id}','due')">⏰ Due</button>
        <button class="action-btn btn-wa" onclick="sendReminder('${s.id}','${p.id}','wa')">📱 WA</button>
        <button class="action-btn btn-pay" onclick="sendReminder('${s.id}','${p.id}','email')">📧 Email</button>
        <button class="action-btn btn-in" onclick="markPaymentPaid('${p.id}')">✅ Pay</button>
      </div>
    </div>`;
  }).join('') : '<div class="panel"><div class="empty-state"><div class="icon">✅</div>All clear! No pending fee reminders.</div></div>';
  
  const allNotifs = DB.notifications ? [...DB.notifications].sort((a,b)=> new Date(b.date) - new Date(a.date)).slice(0,50) : [];
  document.getElementById('adminNotifLog').innerHTML = allNotifs.length ? allNotifs.map(n => {
    const s = n.studentId === 'all' ? 'All Students' : (getStudent(n.studentId)?.fullName || 'Unknown');
    return `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #c9a2271a; font-size:12px; flex-wrap:wrap; gap:4px;">
      <span><b>${s}</b>: ${n.message}</span>
      <span style="color:var(--text-secondary);">${fmtDate(n.date)}</span>
    </div>`;
  }).join('') : '<div style="color:var(--text-secondary);">No notifications sent yet.</div>';
}

function sendReminder(studentId, paymentId, mode){
  const s = getStudent(studentId); const p = DB.payments.find(x=>x.id===paymentId);
  if(!s || !p) return;
  const balance = getPaymentBalance(p);
  const msg = `🔔 ${DB.settings.libraryName} Fee Reminder\nStudent: ${s.fullName} (${s.studentId})\n${p.type}${p.month?' ('+p.month+')':''}\nAmount: ${money(p.amount)}\nPaid: ${money(p.paidAmount||0)}\nBalance Due: ${money(balance)}\nDue Date: ${fmtDate(p.dueDate)}\nKindly clear your dues at the earliest.`;
  if(mode==='email'){
    if(s.email) window.open(`mailto:${s.email}?subject=Fee Reminder&body=${encodeURIComponent(msg)}`,'_blank');
    else showToast('No email on file');
  } else {
    const phone = s.whatsapp || s.mobile;
    if(phone) window.open(`https://wa.me/91${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank');
    else showToast('No WhatsApp number on file');
  }
}

function renderSettingsPage(){
  document.getElementById('setLibName').value = DB.settings.libraryName || '';
  document.getElementById('setLibLogo').value = DB.settings.logo || '📚';
  document.getElementById('setOpenTime').value = DB.settings.openTime || '06:00';
  document.getElementById('setCloseTime').value = DB.settings.closeTime || '22:00';
  document.getElementById('setMonthlyFee').value = DB.settings.monthlyFee || 1000;
  document.getElementById('setRules').value = DB.settings.rules || '';
  document.getElementById('adminList').innerHTML = DB.admins.map(a=>`<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #c9a2271a;"><span>👤 ${a.username}</span>${DB.admins.length>1?`<button class="action-btn btn-del" onclick="removeAdmin('${a.id}')">Remove</button>`:''}</div>`).join('');
  updateCodeDisplay();
}
function saveSettings(){
  DB.settings.libraryName = document.getElementById('setLibName').value || 'SELF STUDY LIBRARY';
  DB.settings.logo = document.getElementById('setLibLogo').value || '📚';
  DB.settings.openTime = document.getElementById('setOpenTime').value;
  DB.settings.closeTime = document.getElementById('setCloseTime').value;
  DB.settings.monthlyFee = Number(document.getElementById('setMonthlyFee').value) || 1000;
  DB.settings.rules = document.getElementById('setRules').value;
  saveData(); applyBranding(); showToast('Settings saved');
  autoGenerateMonthlyFees();
  renderPayments();
}
function addAdmin(){
  const u = document.getElementById('newAdminUser').value.trim();
  const p = document.getElementById('newAdminPass').value.trim();
  if(!u || !p){ showToast('Enter admin ID and password'); return; }
  if(DB.admins.some(a=>a.username===u)){ showToast('Admin ID already exists'); return; }
  DB.admins.push({id:uid(), username:u, password:p});
  saveData(); renderSettingsPage(); showToast('Admin added');
  document.getElementById('newAdminUser').value=''; document.getElementById('newAdminPass').value='';
}
function removeAdmin(id){ DB.admins = DB.admins.filter(a=>a.id!==id); saveData(); renderSettingsPage(); showToast('Admin removed'); }
function backupDatabase(){
  downloadBlob(JSON.stringify(DB, null, 2), 'application/json', 'library_backup_'+todayStr()+'.json');
  showToast('Backup downloaded');
}
function restoreDatabase(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{ const data = JSON.parse(reader.result); DB = data; saveData(); showToast('Database restored'); showPage('dashboard'); }
    catch(err){ showToast('Invalid backup file'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function closeModal(id){ document.getElementById(id).classList.remove('active'); }
let confirmCallback = null;
function showConfirm(msg, cb){ document.getElementById('confirmMsg').textContent = msg; confirmCallback = cb; document.getElementById('confirmOverlay').classList.add('active'); }
function closeConfirm(){ document.getElementById('confirmOverlay').classList.remove('active'); confirmCallback = null; }
document.getElementById('confirmYesBtn').addEventListener('click', ()=>{ if(confirmCallback) confirmCallback(); closeConfirm(); });
['studentModal','profileModal','seatModal','seatCountModal','paymentModal','receiptModal','attendanceVerifyModal'].forEach(id=>{
  document.getElementById(id).addEventListener('click', e=>{ if(e.target.id===id) closeModal(id); });
});

// Enter key support for login
document.getElementById('loginId').addEventListener('keydown', e => { if(e.key==='Enter') handleLogin(); });
document.getElementById('loginPwd').addEventListener('keydown', e => { if(e.key==='Enter') handleLogin(); });
document.getElementById('studentLoginId').addEventListener('keydown', e => { if(e.key==='Enter') handleLogin(); });
document.getElementById('studentLoginPwd').addEventListener('keydown', e => { if(e.key==='Enter') handleLogin(); });
document.getElementById('attVerifyCode').addEventListener('keydown', e => { if(e.key==='Enter') submitAttendanceVerify(); });

loadData();
