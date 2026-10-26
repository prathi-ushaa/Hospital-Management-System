const mongoose = require('mongoose');
const { Schema } = mongoose;

const User = mongoose.model('User', new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'doctor', 'receptionist'], default: 'receptionist' },
  speciality: String, // for doctors
}));

const Patient = mongoose.model('Patient', new Schema({
  name: { type: String, required: true },
  age: Number,
  gender: { type: String, enum: ['female', 'male', 'other'] },
  phone: String,
  createdAt: { type: Date, default: Date.now },
}));

const Appointment = mongoose.model('Appointment', new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, required: true }, // HH:MM
  reason: String,
  notes: String, // written by the doctor
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
}));

const Bill = mongoose.model('Bill', new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  paid: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}));

module.exports = { User, Patient, Appointment, Bill };
