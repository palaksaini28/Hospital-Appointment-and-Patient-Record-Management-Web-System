# CarePoint – Hospital Appointment & Patient Record System
Stack: Node.js + Express REST API, MySQL, HTML/CSS/JavaScript, Bootstrap 5.

## Run it
1. Install Node.js 18+ and MySQL 8 (make sure MySQL is running).
2. Open this folder in VS Code, edit `.env` (set DB_PASSWORD if your MySQL root has one).
3. In the VS Code terminal:
   ```
   npm install
   npm run setup     # creates DB, tables, demo data (resets data!)
   npm start
   ```
4. Open http://localhost:3000

## Demo logins
- Patient: patient@demo.com / patient123 (or sign up)
- Doctor: doctor1@carepoint.com / doctor123 (doctor1..doctor8)
- Admin: admin@carepoint.com / admin123

## REST API
POST /api/auth/signup, /login · GET /api/hospitals, /doctors, /doctors/:id/slots?date=
GET/POST /api/appointments, PATCH /api/appointments/:id · GET/POST /api/records
GET/POST /api/prescriptions, PATCH /api/prescriptions/:id · GET /api/patients · GET /api/reports
