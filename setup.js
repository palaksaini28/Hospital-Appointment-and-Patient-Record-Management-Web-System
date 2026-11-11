// Creates the database, tables and demo data. WARNING: resets all data.
require('dotenv').config();
const mysql=require('mysql2/promise'),bcrypt=require('bcryptjs'),fs=require('fs');
(async()=>{
  const name=process.env.DB_NAME||'carepoint';
  const c=await mysql.createConnection({host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',multipleStatements:true});
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``); await c.changeUser({database:name});
  await c.query(fs.readFileSync(__dirname+'/schema.sql','utf8'));
  const user=async(n,e,p,r,ph='')=>(await c.query('INSERT INTO users(name,email,password,phone,role) VALUES(?,?,?,?,?)',[n,e,await bcrypt.hash(p,10),ph,r]))[0].insertId;
  await user('Admin','admin@carepoint.com','admin123','admin');
  const hosp=[['Himalaya Care Hospital','Dehradun','12 Rajpur Road'],['Ganga Multispeciality','Roorkee','Civil Lines'],['Sunrise Heart Institute','Haridwar','Jwalapur Main Road'],['Green Valley Clinic','Roorkee','IIT Road']];
  for(const h of hosp) await c.query('INSERT INTO hospitals(name,city,address) VALUES(?,?,?)',h);
  const docs=[['Dr. Aarav Sharma','Cardiologist',3,900],['Dr. Meera Nair','General Physician',1,500],['Dr. Rohan Verma','Orthopedic',2,700],['Dr. Ananya Rao','Dermatologist',2,600],['Dr. Kabir Singh','Neurologist',1,1000],['Dr. Isha Gupta','Pediatrician',4,450],['Dr. Vikram Joshi','ENT Specialist',4,500],['Dr. Sana Khan','Gynecologist',3,800]];
  for(const [i,d] of docs.entries()){const uid=await user(d[0],`doctor${i+1}@carepoint.com`,'doctor123','doctor');await c.query('INSERT INTO doctors(user_id,hospital_id,name,specialty,fee) VALUES(?,?,?,?,?)',[uid,d[2],d[0],d[1],d[3]]);}
  const pid=await user('Demo Patient','patient@demo.com','patient123','patient','9876543210');
  const day=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
  await c.query('INSERT INTO appointments(patient_id,doctor_id,date,time,reason,status) VALUES(?,?,?,?,?,?),(?,?,?,?,?,?)',[pid,2,day(-10),'10:00','Fever and cough','completed',pid,1,day(2),'11:30','Chest discomfort check','confirmed']);
  await c.query('INSERT INTO records(patient_id,doctor_id,diagnosis,notes) VALUES(?,?,?,?)',[pid,2,'Viral fever','Rest, fluids. Review if fever lasts beyond 3 days.']);
  await c.query('INSERT INTO prescriptions(patient_id,doctor_id,medicine,dosage,duration,instructions) VALUES(?,?,?,?,?,?)',[pid,2,'Paracetamol 500mg','1 tablet, twice daily','5 days','After meals']);
  console.log('Database ready.\nLogins: patient@demo.com/patient123 | doctor1@carepoint.com/doctor123 | admin@carepoint.com/admin123');
  await c.end();
})().catch(e=>{console.error('Setup failed:',e.message);process.exit(1)});
