import React, { useEffect, useState } from 'react';
import { api, setToken } from './api.js';

const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

// load a list from the API, with a reload function
function useList(path, enabled = true) {
  const [rows, setRows] = useState([]);
  const load = () => enabled && api(path).then(setRows).catch(() => {});
  useEffect(() => { load(); }, [path]);
  return [rows, load];
}

/* ---------- Login / Register ---------- */
function Auth({ onDone }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'receptionist', speciality: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const d = await api('/auth/' + mode, { method: 'POST', body: f });
      setToken(d.token);
      localStorage.setItem('user', JSON.stringify(d.user));
      onDone(d.user);
    } catch (x) { setErr(x.message); }
  };

  return (
    <form className="panel auth" onSubmit={submit}>
      <h1>{mode === 'login' ? 'Staff log in' : 'Create staff account'}</h1>
      {mode === 'register' && (
        <>
          <input placeholder="Full name" value={f.name} onChange={set('name')} required />
          <select value={f.role} onChange={set('role')}>
            <option value="receptionist">Receptionist</option>
            <option value="doctor">Doctor</option>
            <option value="admin">Admin</option>
          </select>
          {f.role === 'doctor' && <input placeholder="Speciality (e.g. Cardiology)" value={f.speciality} onChange={set('speciality')} />}
        </>
      )}
      <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
      <input type="password" placeholder="Password" value={f.password} onChange={set('password')} required />
      {err && <p className="error">{err}</p>}
      <button className="primary">{mode === 'login' ? 'Log in' : 'Create account'}</button>
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New staff? Create an account' : 'Have an account? Log in'}
      </button>
    </form>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/stats').then(setS); }, []);
  if (!s) return <p className="muted">Loading...</p>;
  const items = [
    ['Patients registered', s.patients],
    ["Today's appointments", s.todayAppointments],
    ['Unpaid bills', `${s.unpaidBills} (${money(s.outstanding)})`],
    ['Revenue collected', money(s.revenue)],
  ];
  return (
    <section className="panel stats">
      {items.map(([k, v]) => <div key={k}><b>{v}</b><span className="muted">{k}</span></div>)}
    </section>
  );
}

/* ---------- Patients ---------- */
function Patients({ canEdit }) {
  const [rows, load] = useList('/patients');
  const [f, setF] = useState({ name: '', age: '', gender: '', phone: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/patients', { method: 'POST', body: f }); setF({ name: '', age: '', gender: '', phone: '' }); load(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <section className="panel">
      <h2>Patients</h2>
      {canEdit && (
        <form className="row" onSubmit={add}>
          <input placeholder="Name" value={f.name} onChange={set('name')} required />
          <input type="number" placeholder="Age" min="0" value={f.age} onChange={set('age')} />
          <select value={f.gender} onChange={set('gender')}>
            <option value="">Gender</option><option value="female">Female</option>
            <option value="male">Male</option><option value="other">Other</option>
          </select>
          <input placeholder="Phone" value={f.phone} onChange={set('phone')} />
          <button className="primary">Register patient</button>
        </form>
      )}
      {err && <p className="error">{err}</p>}
      {rows.length === 0 ? <p className="muted">No patients yet.</p> : (
        <table>
          <thead><tr><th>Name</th><th>Age</th><th>Gender</th><th>Phone</th></tr></thead>
          <tbody>{rows.map((p) => <tr key={p._id}><td>{p.name}</td><td>{p.age}</td><td>{p.gender}</td><td>{p.phone}</td></tr>)}</tbody>
        </table>
      )}
    </section>
  );
}

/* ---------- Appointments ---------- */
function Appointments({ role }) {
  const [rows, load] = useList('/appointments');
  const [patients] = useList('/patients');
  const [doctors] = useList('/doctors');
  const [f, setF] = useState({ patient: '', doctor: '', date: today(), time: '10:00', reason: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const front = role !== 'doctor';

  const book = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/appointments', { method: 'POST', body: f }); load(); }
    catch (x) { setErr(x.message); }
  };
  const update = async (id, body) => { await api('/appointments/' + id, { method: 'PATCH', body }); load(); };
  const complete = (a) => {
    const notes = role === 'receptionist' ? undefined : window.prompt('Visit notes (optional):', a.notes || '');
    update(a._id, { status: 'completed', notes: notes ?? undefined });
  };

  return (
    <section className="panel">
      <h2>Appointments</h2>
      {front && (
        <form className="row" onSubmit={book}>
          <select value={f.patient} onChange={set('patient')} required>
            <option value="">Patient</option>{patients.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <select value={f.doctor} onChange={set('doctor')} required>
            <option value="">Doctor</option>{doctors.map((d) => <option key={d._id} value={d._id}>{d.name} {d.speciality && `(${d.speciality})`}</option>)}
          </select>
          <input type="date" value={f.date} onChange={set('date')} required />
          <input type="time" value={f.time} onChange={set('time')} required />
          <input placeholder="Reason" value={f.reason} onChange={set('reason')} />
          <button className="primary">Book appointment</button>
        </form>
      )}
      {err && <p className="error">{err}</p>}
      {rows.length === 0 ? <p className="muted">No appointments yet.</p> : (
        <table>
          <thead><tr><th>When</th><th>Patient</th><th>Doctor</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a._id}>
                <td>{a.date} {a.time}</td><td>{a.patient?.name}</td><td>{a.doctor?.name}</td>
                <td><span className={'tag ' + a.status}>{a.status}</span>{a.notes && <div className="muted">{a.notes}</div>}</td>
                <td className="actions">
                  {a.status === 'scheduled' && <>
                    <button onClick={() => complete(a)}>Complete</button>
                    <button onClick={() => update(a._id, { status: 'cancelled' })}>Cancel</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ---------- Billing ---------- */
function Billing() {
  const [rows, load] = useList('/bills');
  const [patients] = useList('/patients');
  const [f, setF] = useState({ patient: '', description: '', amount: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/bills', { method: 'POST', body: f }); setF({ ...f, description: '', amount: '' }); load(); }
    catch (x) { setErr(x.message); }
  };
  const pay = async (id) => { await api(`/bills/${id}/pay`, { method: 'PATCH' }); load(); };
  return (
    <section className="panel">
      <h2>Billing</h2>
      <form className="row" onSubmit={add}>
        <select value={f.patient} onChange={set('patient')} required>
          <option value="">Patient</option>{patients.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <input placeholder="Description (e.g. Consultation)" value={f.description} onChange={set('description')} required />
        <input type="number" min="0" placeholder="Amount" value={f.amount} onChange={set('amount')} required />
        <button className="primary">Create bill</button>
      </form>
      {err && <p className="error">{err}</p>}
      {rows.length === 0 ? <p className="muted">No bills yet.</p> : (
        <table>
          <thead><tr><th>Patient</th><th>For</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b._id}>
                <td>{b.patient?.name}</td><td>{b.description}</td><td>{money(b.amount)}</td>
                <td className="actions">{b.paid ? <span className="tag completed">paid</span> : <button onClick={() => pay(b._id)}>Mark paid</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ---------- App shell ---------- */
export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [tab, setTab] = useState('');
  const logout = () => { setToken(''); localStorage.removeItem('user'); setUser(null); setTab(''); };

  if (!user) return <main><Auth onDone={setUser} /></main>;

  const isDoctor = user.role === 'doctor';
  const tabs = isDoctor ? ['Appointments'] : ['Dashboard', 'Patients', 'Appointments', 'Billing'];
  const current = tabs.includes(tab) ? tab : tabs[0];

  return (
    <main>
      <header>
        <strong>Hospital Management</strong>
        <span>{user.name} ({user.role}) <button className="link" onClick={logout}>Log out</button></span>
      </header>
      {tabs.length > 1 && (
        <nav>{tabs.map((t) => <button key={t} className={t === current ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
      )}
      {current === 'Dashboard' && <Dashboard />}
      {current === 'Patients' && <Patients canEdit={!isDoctor} />}
      {current === 'Appointments' && <Appointments role={user.role} />}
      {current === 'Billing' && <Billing />}
    </main>
  );
}
