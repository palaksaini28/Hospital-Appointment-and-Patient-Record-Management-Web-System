require('dotenv').config();
const express=require('express'),mysql=require('mysql2/promise'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),path=require('path');
const app=express(); app.use(express.json()); app.use(express.static(path.join(__dirname,'public')));
const db=mysql.createPool({host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'carepoint',dateStrings:true});
const SECRET=process.env.JWT_SECRET||'dev-secret';
const q=async(sql,p=[])=>(await db.query(sql,p))[0];
const wrap=f=>(req,res)=>f(req,res).catch(e=>{console.error(e);res.status(500).json({error:'Server error'})});
const auth=(...roles)=>(req,res,next)=>{
  try{req.user=jwt.verify((req.headers.authorization||'').slice(7),SECRET)}catch{return res.status(401).json({error:'Please log in again'})}
  if(roles.length&&!roles.includes(req.user.role))return res.status(403).json({error:'You do not have access to this'});next();};
// limits rows by role: patient sees own, doctor sees own patients' data, admin sees all
const scope=(u,col)=>u.role==='patient'?[`${col}.patient_id=?`,[u.id]]:u.role==='doctor'?[`${col}.doctor_id=?`,[u.doctorId]]:['1=1',[]];
const sign=u=>({token:jwt.sign({id:u.id,name:u.name,role:u.role,doctorId:u.doctorId||null},SECRET,{expiresIn:'7d'}),user:{id:u.id,name:u.name,role:u.role}});

// ---------- Auth ----------
app.post('/api/auth/signup',wrap(async(req,res)=>{
  const{name,email,password,phone}=req.body;
  if(!name||!email||!password||password.length<6)return res.status(400).json({error:'Enter your name, email and a password of 6+ characters'});
  if((await q('SELECT id FROM users WHERE email=?',[email])).length)return res.status(409).json({error:'This email already has an account. Try logging in.'});
  const r=await q('INSERT INTO users(name,email,password,phone,role) VALUES(?,?,?,?,"patient")',[name.trim(),email.trim().toLowerCase(),await bcrypt.hash(password,10),phone||'']);
  res.json(sign({id:r.insertId,name:name.trim(),role:'patient'}));}));
app.post('/api/auth/login',wrap(async(req,res)=>{
  const[u]=await q('SELECT * FROM users WHERE email=?',[(req.body.email||'').trim().toLowerCase()]);
  if(!u||!(await bcrypt.compare(req.body.password||'',u.password)))return res.status(401).json({error:'Email or password is incorrect'});
  if(u.role==='doctor')u.doctorId=(await q('SELECT id FROM doctors WHERE user_id=?',[u.id]))[0].id;
  res.json(sign(u));}));

// ---------- Hospitals & doctors ----------
app.get('/api/hospitals',wrap(async(req,res)=>res.json(await q('SELECT * FROM hospitals ORDER BY name'))));
app.get('/api/doctors',wrap(async(req,res)=>{
  const h=req.query.hospital_id;
  res.json(await q(`SELECT d.id,d.name,d.specialty,d.fee,h.name hospital,h.city FROM doctors d JOIN hospitals h ON h.id=d.hospital_id ${h?'WHERE d.hospital_id=?':''} ORDER BY d.name`,h?[h]:[]));}));
app.get('/api/doctors/:id/slots',wrap(async(req,res)=>{
  const rows=await q('SELECT TIME_FORMAT(time,"%H:%i") t FROM appointments WHERE doctor_id=? AND date=? AND status<>"cancelled"',[req.params.id,req.query.date]);
  res.json(rows.map(r=>r.t));}));

// ---------- Appointments ----------
app.get('/api/appointments',auth(),wrap(async(req,res)=>{
  const[w,p]=scope(req.user,'a');
  res.json(await q(`SELECT a.id,a.date,TIME_FORMAT(a.time,'%H:%i') time,a.reason,a.status,u.name patient,d.name doctor,d.specialty,h.name hospital
    FROM appointments a JOIN users u ON u.id=a.patient_id JOIN doctors d ON d.id=a.doctor_id JOIN hospitals h ON h.id=d.hospital_id WHERE ${w} ORDER BY a.date DESC,a.time DESC`,p));}));
app.post('/api/appointments',auth('patient'),wrap(async(req,res)=>{
  const{doctor_id,date,time,reason}=req.body;
  if(!doctor_id||!date||!time)return res.status(400).json({error:'Choose a doctor, date and time'});
  if(date<new Date().toISOString().slice(0,10))return res.status(400).json({error:'Pick today or a future date'});
  if((await q('SELECT id FROM appointments WHERE doctor_id=? AND date=? AND time=? AND status<>"cancelled"',[doctor_id,date,time])).length)return res.status(409).json({error:'That slot was just taken. Pick another time.'});
  await q('INSERT INTO appointments(patient_id,doctor_id,date,time,reason) VALUES(?,?,?,?,?)',[req.user.id,doctor_id,date,time,reason||'']);
  res.json({ok:true});}));
app.patch('/api/appointments/:id',auth(),wrap(async(req,res)=>{
  const s=req.body.status,[w,p]=scope(req.user,'a');
  const allowed=req.user.role==='patient'?['cancelled']:['confirmed','completed','cancelled'];
  if(!allowed.includes(s))return res.status(400).json({error:'Action not allowed'});
  const r=await q(`UPDATE appointments a SET status=? WHERE a.id=? AND ${w}`,[s,req.params.id,...p]);
  res.json({ok:r.affectedRows>0});}));

// ---------- Patients (for doctors/admin) ----------
app.get('/api/patients',auth('doctor','admin'),wrap(async(req,res)=>{
  res.json(req.user.role==='admin'?await q('SELECT id,name FROM users WHERE role="patient" ORDER BY name')
   :await q('SELECT DISTINCT u.id,u.name FROM users u JOIN appointments a ON a.patient_id=u.id WHERE a.doctor_id=? ORDER BY u.name',[req.user.doctorId]));}));

// ---------- Medical records ----------
app.get('/api/records',auth(),wrap(async(req,res)=>{
  const[w,p]=scope(req.user,'r');
  res.json(await q(`SELECT r.id,r.diagnosis,r.notes,r.created_at,u.name patient,d.name doctor,d.specialty FROM records r JOIN users u ON u.id=r.patient_id JOIN doctors d ON d.id=r.doctor_id WHERE ${w} ORDER BY r.created_at DESC`,p));}));
app.post('/api/records',auth('doctor'),wrap(async(req,res)=>{
  const{patient_id,diagnosis,notes}=req.body;
  if(!patient_id||!diagnosis)return res.status(400).json({error:'Choose a patient and enter a diagnosis'});
  await q('INSERT INTO records(patient_id,doctor_id,diagnosis,notes) VALUES(?,?,?,?)',[patient_id,req.user.doctorId,diagnosis,notes||'']);res.json({ok:true});}));

// ---------- Prescriptions ----------
app.get('/api/prescriptions',auth(),wrap(async(req,res)=>{
  const[w,p]=scope(req.user,'x');
  res.json(await q(`SELECT x.id,x.medicine,x.dosage,x.duration,x.instructions,x.status,x.created_at,u.name patient,d.name doctor FROM prescriptions x JOIN users u ON u.id=x.patient_id JOIN doctors d ON d.id=x.doctor_id WHERE ${w} ORDER BY x.created_at DESC`,p));}));
app.post('/api/prescriptions',auth('doctor'),wrap(async(req,res)=>{
  const{patient_id,medicine,dosage,duration,instructions}=req.body;
  if(!patient_id||!medicine)return res.status(400).json({error:'Choose a patient and enter the medicine'});
  await q('INSERT INTO prescriptions(patient_id,doctor_id,medicine,dosage,duration,instructions) VALUES(?,?,?,?,?,?)',[patient_id,req.user.doctorId,medicine,dosage||'',duration||'',instructions||'']);res.json({ok:true});}));
app.patch('/api/prescriptions/:id',auth('doctor'),wrap(async(req,res)=>{
  await q('UPDATE prescriptions SET status=? WHERE id=? AND doctor_id=?',[req.body.status==='completed'?'completed':'active',req.params.id,req.user.doctorId]);res.json({ok:true});}));

// ---------- Hospital reports ----------
app.get('/api/reports',auth('admin'),wrap(async(req,res)=>{
  const[totals]=await q(`SELECT (SELECT COUNT(*) FROM users WHERE role='patient') patients,(SELECT COUNT(*) FROM doctors) doctors,(SELECT COUNT(*) FROM appointments) appointments,(SELECT COUNT(*) FROM records) records,(SELECT COUNT(*) FROM prescriptions) prescriptions,
    (SELECT COALESCE(SUM(d.fee),0) FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.status='completed') revenue`);
  res.json({totals,
    byStatus:await q('SELECT status label,COUNT(*) n FROM appointments GROUP BY status'),
    byHospital:await q('SELECT h.name label,COUNT(a.id) n FROM hospitals h LEFT JOIN doctors d ON d.hospital_id=h.id LEFT JOIN appointments a ON a.doctor_id=d.id GROUP BY h.id ORDER BY n DESC'),
    topDoctors:await q('SELECT d.name label,COUNT(a.id) n FROM doctors d LEFT JOIN appointments a ON a.doctor_id=d.id GROUP BY d.id ORDER BY n DESC LIMIT 5')});}));

app.listen(process.env.PORT||3000,()=>console.log('CarePoint running at http://localhost:'+(process.env.PORT||3000)));
