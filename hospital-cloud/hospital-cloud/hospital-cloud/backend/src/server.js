const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User, Patient, Appointment, Bill } = require('./models');
const { sign, requireAuth } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

// Send any thrown error back as JSON instead of crashing the server
const h = (fn) => (req, res) => fn(req, res).catch((e) => res.status(400).json({ error: e.message }));
const front = ['admin', 'receptionist']; // front-desk roles

app.get('/api/health', (_req, res) => res.json({ ok: true })); // for Docker / AWS load balancer

// ---------- auth ----------
// NOTE: open registration is demo-only. In production only admins should create staff accounts.
app.post('/api/auth/register', h(async (req, res) => {
  const { name, email, password, role, speciality } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  try {
    const user = await User.create({
      name, email, speciality,
      role: ['admin', 'doctor', 'receptionist'].includes(role) ? role : 'receptionist',
      password: await bcrypt.hash(password, 10),
    });
    res.json({ token: sign(user), user: { name: user.name, role: user.role } });
  } catch (e) {
    res.status(400).json({ error: e.code === 11000 ? 'That email is already registered.' : e.message });
  }
}));

app.post('/api/auth/login', h(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  res.json({ token: sign(user), user: { name: user.name, role: user.role } });
}));

// ---------- doctors ----------
app.get('/api/doctors', requireAuth(), h(async (_req, res) => {
  res.json(await User.find({ role: 'doctor' }).select('name speciality').sort('name'));
}));

// ---------- patients ----------
app.get('/api/patients', requireAuth(), h(async (_req, res) => {
  res.json(await Patient.find().sort('-createdAt').limit(200));
}));
app.post('/api/patients', requireAuth(...front), h(async (req, res) => {
  const { name, age, gender, phone } = req.body;
  res.json(await Patient.create({ name, age, gender: gender || undefined, phone }));
}));

// ---------- appointments ----------
app.get('/api/appointments', requireAuth(), h(async (req, res) => {
  const filter = req.user.role === 'doctor' ? { doctor: req.user.id } : {}; // doctors only see their own
  res.json(await Appointment.find(filter)
    .populate('patient', 'name age').populate('doctor', 'name speciality')
    .sort('date time').limit(200));
}));
app.post('/api/appointments', requireAuth(...front), h(async (req, res) => {
  const { patient, doctor, date, time, reason } = req.body;
  const clash = await Appointment.findOne({ doctor, date, time, status: 'scheduled' });
  if (clash) return res.status(409).json({ error: 'That doctor already has an appointment at this time.' });
  res.json(await Appointment.create({ patient, doctor, date, time, reason }));
}));
app.patch('/api/appointments/:id', requireAuth(), h(async (req, res) => {
  const { status, notes } = req.body;
  const a = await Appointment.findById(req.params.id);
  if (!a) return res.status(404).json({ error: 'Appointment not found.' });
  if (req.user.role === 'doctor' && String(a.doctor) !== req.user.id) {
    return res.status(403).json({ error: 'This is not your appointment.' });
  }
  if (status) a.status = status;
  if (notes !== undefined && req.user.role !== 'receptionist') a.notes = notes; // clinical notes: doctor/admin only
  await a.save();
  res.json(a);
}));

// ---------- billing ----------
app.get('/api/bills', requireAuth(...front), h(async (_req, res) => {
  res.json(await Bill.find().populate('patient', 'name').sort('-createdAt').limit(200));
}));
app.post('/api/bills', requireAuth(...front), h(async (req, res) => {
  const { patient, description, amount } = req.body;
  res.json(await Bill.create({ patient, description, amount: Number(amount) }));
}));
app.patch('/api/bills/:id/pay', requireAuth(...front), h(async (req, res) => {
  res.json(await Bill.findByIdAndUpdate(req.params.id, { paid: true }, { new: true }));
}));

// ---------- dashboard ----------
app.get('/api/stats', requireAuth(...front), h(async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const [patients, todayAppts, unpaid, paid] = await Promise.all([
    Patient.countDocuments(),
    Appointment.countDocuments({ date: today, status: 'scheduled' }),
    Bill.aggregate([{ $match: { paid: false } }, { $group: { _id: null, n: { $sum: 1 }, sum: { $sum: '$amount' } } }]),
    Bill.aggregate([{ $match: { paid: true } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
  ]);
  res.json({
    patients,
    todayAppointments: todayAppts,
    unpaidBills: unpaid[0]?.n || 0,
    outstanding: unpaid[0]?.sum || 0,
    revenue: paid[0]?.sum || 0,
  });
}));

// ---------- start (retry until MongoDB is up) ----------
async function start() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/hospital';
  for (let i = 0; i < 20; i++) {
    try { await mongoose.connect(uri); break; }
    catch { console.log('Waiting for MongoDB...'); await new Promise((r) => setTimeout(r, 3000)); }
  }
  app.listen(process.env.PORT || 5000, () => console.log('API running'));
}
start();
