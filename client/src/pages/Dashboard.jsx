import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { Link } from 'react-router-dom';

// Helper to format dates
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const REGISTRIES = [
  'American Quarter Horse Association',
  'American Paint Horse Association',
  'Thoroughbred',
  'Arabian Horse Association',
  'American Morgan Horse Association',
  'American Mustang',
  'Other'
];

export default function Dashboard() {
  // Data
  const [mares, setMares] = useState([]);
  const [stallions, setStallions] = useState([]);
  const [cycles, setCycles] = useState([]); // cycles of selected mare
  const [collections, setCollections] = useState([]);

  // Form state
  const [mareForm, setMareForm] = useState({ registeredName: '', barnName: '', dob: '', registry: '', registrationNumber: '', ownerName: '', ownerPhone: '', ownerEmail: '', vetName: '', vetPhone: '', vetEmail: '' });
  const [editingMare, setEditingMare] = useState(null);
  const [stallionForm, setStallionForm] = useState({ registeredName: '', barnName: '', dob: '', registry: '', registrationNumber: '', semenType: '', breederName: '', breederPhone: '', breederEmail: '', vetName: '', vetPhone: '', vetEmail: '' });
  const [editingStallion, setEditingStallion] = useState(null);

  const SEMEN_TYPES = ['Fresh', 'Cooled', 'Frozen', 'Live Cover'];
  const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const [stallionSchedules, setStallionSchedules] = useState({}); // { stallionId: [0,1,2...] }
  const [editingSchedule, setEditingSchedule] = useState(null); // stallion being edited
  const [cycleForm, setCycleForm] = useState({ mareId: '', startDate: '', endDate: '' });
  const [collectionForm, setCollectionForm] = useState({
    stallionId: '',
    mareId: '',
    cycleId: '',
    date: '',
    method: 'live',
  });
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  // Load initial data
  useEffect(() => {
    loadMares();
    loadStallions();
  }, []);

  const loadMares = async () => {
    try {
      const data = await apiFetch('/api/mares');
      setMares(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const loadStallions = async () => {
    try {
      const data = await apiFetch('/api/stallions');
      setStallions(data);
      // Load schedule for each stallion
      const schedules = {};
      for (const s of data) {
        try {
          const sched = await apiFetch(`/api/stallions/${s.id}/schedule`);
          schedules[s.id] = sched.days || [];
        } catch {
          schedules[s.id] = [];
        }
      }
      setStallionSchedules(schedules);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSaveSchedule = async (stallionId) => {
    try {
      await apiFetch(`/api/stallions/${stallionId}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ days: stallionSchedules[stallionId] || [] }),
      });
      setEditingSchedule(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const loadCycles = async (mareId) => {
    try {
      const data = await apiFetch(`/api/mares/${mareId}/cycles`);
      setCycles(data);
    } catch (e) {
      setError(e.message);
    }
  };

  // Handlers
  const handleAddMare = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/mares', {
        method: 'POST',
        body: JSON.stringify(mareForm),
      });
      setMareForm({ registeredName: '', barnName: '', dob: '', registry: '', registrationNumber: '', ownerName: '', ownerPhone: '', ownerEmail: '', vetName: '', vetPhone: '', vetEmail: '' });
      loadMares();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEditMare = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch(`/api/mares/${editingMare.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingMare),
      });
      setEditingMare(null);
      loadMares();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteMare = async (id) => {
    if (!confirm('Delete this mare?')) return;
    setError('');
    try {
      await apiFetch(`/api/mares/${id}`, { method: 'DELETE' });
      loadMares();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddStallion = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/stallions', {
        method: 'POST',
        body: JSON.stringify(stallionForm),
      });
      setStallionForm({ registeredName: '', barnName: '', dob: '', registry: '', registrationNumber: '', semenType: '', breederName: '', breederPhone: '', breederEmail: '', vetName: '', vetPhone: '', vetEmail: '' });
      loadStallions();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEditStallion = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch(`/api/stallions/${editingStallion.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingStallion),
      });
      setEditingStallion(null);
      loadStallions();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteStallion = async (id) => {
    if (!confirm('Delete this stallion?')) return;
    setError('');
    try {
      await apiFetch(`/api/stallions/${id}`, { method: 'DELETE' });
      loadStallions();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddCycle = async (e) => {
    e.preventDefault();
    setError('');
    const { mareId, startDate, endDate } = cycleForm;
    try {
      await apiFetch(`/api/mares/${mareId}/cycles`, {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate }),
      });
      setCycleForm({ mareId: '', startDate: '', endDate: '' });
      loadCycles(mareId);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddCollection = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/collections', {
        method: 'POST',
        body: JSON.stringify(collectionForm),
      });
      setCollectionForm({
        stallionId: '',
        mareId: '',
        cycleId: '',
        date: '',
        method: 'live',
      });
    } catch (e) {
      setError(e.message);
    }
  };

  const handleExportReport = async () => {
    setError('');
    const stallionId = collectionForm.stallionId;
    if (!stallionId) {
      setError('Select a stallion to export report');
      return;
    }
    try {
      const data = await apiFetch(`/api/stallions/${stallionId}/report`);
      setReport(data);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: 'auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Dashboard</h2>
        <Link to="/calendar">📅 View Calendar</Link>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Mares Section */}
      <section>
        <h3>Mares</h3>
        <ul>
          {mares.map((m) => (
            <li key={m.id} style={{ marginBottom: '0.5rem' }}>
              <strong>{m.registeredName}</strong>
              {m.barnName && <span> ({m.barnName})</span>}
              <span> — DOB: {m.dob}</span>
              {m.registry && <span> — {m.registry}</span>}
              {m.registrationNumber && <span> — Reg#: {m.registrationNumber}</span>}
              <button style={{ marginLeft: '0.5rem' }} onClick={() => loadCycles(m.id)}>View Cycles</button>
              <button style={{ marginLeft: '0.5rem' }} onClick={() => setEditingMare(m)}>Edit</button>
              <button style={{ marginLeft: '0.5rem', color: 'red' }} onClick={() => handleDeleteMare(m.id)}>Delete</button>
            </li>
          ))}
        </ul>
        {editingMare ? (
          <form onSubmit={handleEditMare} style={{ background: '#f5f5f5', padding: '1rem' }}>
            <h4>Edit Mare</h4>
            <input placeholder="Registered Name" value={editingMare.registeredName || ''} onChange={(e) => setEditingMare({ ...editingMare, registeredName: e.target.value })} required />
            <input placeholder="Barn Name" value={editingMare.barnName || ''} onChange={(e) => setEditingMare({ ...editingMare, barnName: e.target.value })} />
            <input type="date" value={editingMare.dob || ''} onChange={(e) => setEditingMare({ ...editingMare, dob: e.target.value })} required />
            <select value={editingMare.registry || ''} onChange={(e) => setEditingMare({ ...editingMare, registry: e.target.value })}>
              <option value="">Select Registry</option>
              {REGISTRIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder="Registration Number" value={editingMare.registrationNumber || ''} onChange={(e) => setEditingMare({ ...editingMare, registrationNumber: e.target.value })} />
            <hr style={{ margin: '1rem 0', opacity: 0.3 }} />
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Owner Contact</h5>
            <input placeholder="Owner Name" value={editingMare.ownerName || ''} onChange={(e) => setEditingMare({ ...editingMare, ownerName: e.target.value })} />
            <input placeholder="Owner Phone" value={editingMare.ownerPhone || ''} onChange={(e) => setEditingMare({ ...editingMare, ownerPhone: e.target.value })} />
            <input placeholder="Owner Email" type="email" value={editingMare.ownerEmail || ''} onChange={(e) => setEditingMare({ ...editingMare, ownerEmail: e.target.value })} />
            <hr style={{ margin: '1rem 0', opacity: 0.3 }} />
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Veterinarian Info</h5>
            <input placeholder="Vet Name" value={editingMare.vetName || ''} onChange={(e) => setEditingMare({ ...editingMare, vetName: e.target.value })} />
            <input placeholder="Vet Phone" value={editingMare.vetPhone || ''} onChange={(e) => setEditingMare({ ...editingMare, vetPhone: e.target.value })} />
            <input placeholder="Vet Email" type="email" value={editingMare.vetEmail || ''} onChange={(e) => setEditingMare({ ...editingMare, vetEmail: e.target.value })} />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditingMare(null)} style={{ marginLeft: '0.5rem' }}>Cancel</button>
          </form>
        ) : (
          <form onSubmit={handleAddMare}>
            <h4>Add Mare</h4>
            <input placeholder="Registered Name" value={mareForm.registeredName} onChange={(e) => setMareForm({ ...mareForm, registeredName: e.target.value })} required />
            <input placeholder="Barn Name (optional)" value={mareForm.barnName} onChange={(e) => setMareForm({ ...mareForm, barnName: e.target.value })} />
            <input type="date" placeholder="DOB" value={mareForm.dob} onChange={(e) => setMareForm({ ...mareForm, dob: e.target.value })} required />
            <select value={mareForm.registry} onChange={(e) => setMareForm({ ...mareForm, registry: e.target.value })} required>
              <option value="">Select Registry</option>
              {REGISTRIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder="Registration Number" value={mareForm.registrationNumber} onChange={(e) => setMareForm({ ...mareForm, registrationNumber: e.target.value })} />
            <hr style={{ margin: '1rem 0', opacity: 0.3 }} />
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Owner Contact</h5>
            <input placeholder="Owner Name" value={mareForm.ownerName} onChange={(e) => setMareForm({ ...mareForm, ownerName: e.target.value })} />
            <input placeholder="Owner Phone" value={mareForm.ownerPhone} onChange={(e) => setMareForm({ ...mareForm, ownerPhone: e.target.value })} />
            <input placeholder="Owner Email" type="email" value={mareForm.ownerEmail} onChange={(e) => setMareForm({ ...mareForm, ownerEmail: e.target.value })} />
            <hr style={{ margin: '1rem 0', opacity: 0.3 }} />
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Veterinarian Info</h5>
            <input placeholder="Vet Name" value={mareForm.vetName} onChange={(e) => setMareForm({ ...mareForm, vetName: e.target.value })} />
            <input placeholder="Vet Phone" value={mareForm.vetPhone} onChange={(e) => setMareForm({ ...mareForm, vetPhone: e.target.value })} />
            <input placeholder="Vet Email" type="email" value={mareForm.vetEmail} onChange={(e) => setMareForm({ ...mareForm, vetEmail: e.target.value })} />
            <button type="submit">Add Mare</button>
          </form>
        )}
      </section>

      {/* Stallions Section */}
      <section>
        <h3>Stallions</h3>
        <ul>
          {stallions.map((s) => (
            <li key={s.id} style={{ marginBottom: '0.5rem' }}>
              <strong>{s.registeredName}</strong>
              {s.barnName && <span> ({s.barnName})</span>}
              <span> — DOB: {s.dob}</span>
              {s.registry && <span> — {s.registry}</span>}
              {s.registrationNumber && <span> — Reg#: {s.registrationNumber}</span>}
              {s.semenType && <span> — {s.semenType}</span>}
              <button style={{ marginLeft: '0.5rem' }} onClick={() => setEditingStallion(s)}>Edit</button>
              <button style={{ marginLeft: '0.5rem' }} onClick={() => setEditingSchedule(s.id)}>Schedule</button>
              <button style={{ marginLeft: '0.5rem', color: 'red' }} onClick={() => handleDeleteStallion(s.id)}>Delete</button>
            </li>
          ))}
        </ul>
        {editingStallion ? (
          <form onSubmit={handleEditStallion} style={{ background: '#f5f5f5', padding: '1rem' }}>
            <h4>Edit Stallion</h4>
            <input placeholder="Registered Name" value={editingStallion.registeredName || ''} onChange={(e) => setEditingStallion({ ...editingStallion, registeredName: e.target.value })} required />
            <input placeholder="Barn Name" value={editingStallion.barnName || ''} onChange={(e) => setEditingStallion({ ...editingStallion, barnName: e.target.value })} />
            <input type="date" value={editingStallion.dob || ''} onChange={(e) => setEditingStallion({ ...editingStallion, dob: e.target.value })} required />
            <select value={editingStallion.registry || ''} onChange={(e) => setEditingStallion({ ...editingStallion, registry: e.target.value })}>
              <option value="">Select Registry</option>
              {REGISTRIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder="Registration Number" value={editingStallion.registrationNumber || ''} onChange={(e) => setEditingStallion({ ...editingStallion, registrationNumber: e.target.value })} />
            <select value={editingStallion.semenType || ''} onChange={(e) => setEditingStallion({ ...editingStallion, semenType: e.target.value })}>
              <option value="">Select Semen Type</option>
              {SEMEN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <hr style={{ margin: '1rem 0', opacity: 0.3 }} />
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Breeder Contact (for semen shipping)</h5>
            <input placeholder="Breeder Name" value={editingStallion.breederName || ''} onChange={(e) => setEditingStallion({ ...editingStallion, breederName: e.target.value })} />
            <input placeholder="Breeder Phone" value={editingStallion.breederPhone || ''} onChange={(e) => setEditingStallion({ ...editingStallion, breederPhone: e.target.value })} />
            <input placeholder="Breeder Email" type="email" value={editingStallion.breederEmail || ''} onChange={(e) => setEditingStallion({ ...editingStallion, breederEmail: e.target.value })} />
            <hr style={{ margin: '1rem 0', opacity: 0.3 }} />
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Veterinarian Info</h5>
            <input placeholder="Vet Name" value={editingStallion.vetName || ''} onChange={(e) => setEditingStallion({ ...editingStallion, vetName: e.target.value })} />
            <input placeholder="Vet Phone" value={editingStallion.vetPhone || ''} onChange={(e) => setEditingStallion({ ...editingStallion, vetPhone: e.target.value })} />
            <input placeholder="Vet Email" type="email" value={editingStallion.vetEmail || ''} onChange={(e) => setEditingStallion({ ...editingStallion, vetEmail: e.target.value })} />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditingStallion(null)} style={{ marginLeft: '0.5rem' }}>Cancel</button>
          </form>
        ) : (
          <form onSubmit={handleAddStallion}>
            <h4>Add Stallion</h4>
            <input placeholder="Registered Name" value={stallionForm.registeredName} onChange={(e) => setStallionForm({ ...stallionForm, registeredName: e.target.value })} required />
            <input placeholder="Barn Name (optional)" value={stallionForm.barnName} onChange={(e) => setStallionForm({ ...stallionForm, barnName: e.target.value })} />
            <input type="date" placeholder="DOB" value={stallionForm.dob} onChange={(e) => setStallionForm({ ...stallionForm, dob: e.target.value })} required />
            <select value={stallionForm.registry} onChange={(e) => setStallionForm({ ...stallionForm, registry: e.target.value })} required>
              <option value="">Select Registry</option>
              {REGISTRIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder="Registration Number" value={stallionForm.registrationNumber} onChange={(e) => setStallionForm({ ...stallionForm, registrationNumber: e.target.value })} />
            <select value={stallionForm.semenType} onChange={(e) => setStallionForm({ ...stallionForm, semenType: e.target.value })}>
              <option value="">Select Semen Type</option>
              {SEMEN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <hr style={{ margin: '1rem 0', opacity: 0.3 }} />
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Breeder Contact (for semen shipping)</h5>
            <input placeholder="Breeder Name" value={stallionForm.breederName} onChange={(e) => setStallionForm({ ...stallionForm, breederName: e.target.value })} />
            <input placeholder="Breeder Phone" value={stallionForm.breederPhone} onChange={(e) => setStallionForm({ ...stallionForm, breederPhone: e.target.value })} />
            <input placeholder="Breeder Email" type="email" value={stallionForm.breederEmail} onChange={(e) => setStallionForm({ ...stallionForm, breederEmail: e.target.value })} />
            <hr style={{ margin: '1rem 0', opacity: 0.3 }} />
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Veterinarian Info</h5>
            <input placeholder="Vet Name" value={stallionForm.vetName} onChange={(e) => setStallionForm({ ...stallionForm, vetName: e.target.value })} />
            <input placeholder="Vet Phone" value={stallionForm.vetPhone} onChange={(e) => setStallionForm({ ...stallionForm, vetPhone: e.target.value })} />
            <input placeholder="Vet Email" type="email" value={stallionForm.vetEmail} onChange={(e) => setStallionForm({ ...stallionForm, vetEmail: e.target.value })} />
            <button type="submit">Add Stallion</button>
          </form>
        )}

        {/* Stallion Schedule Editor */}
        {editingSchedule && (
          <div style={{ background: '#e8f5e9', padding: '1rem', marginTop: '1rem' }}>
            <h4>Collection Days for {stallions.find(s => s.id === editingSchedule)?.registeredName}</h4>
            <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Select days of the week for collection:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {DAYS_OF_WEEK.map((day, idx) => (
                <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={(stallionSchedules[editingSchedule] || []).includes(idx)}
                    onChange={(e) => {
                      const current = stallionSchedules[editingSchedule] || [];
                      const updated = e.target.checked
                        ? [...current, idx]
                        : current.filter(d => d !== idx);
                      setStallionSchedules({ ...stallionSchedules, [editingSchedule]: updated });
                    }}
                  />
                  {day}
                </label>
              ))}
            </div>
            <button onClick={() => handleSaveSchedule(editingSchedule)}>Save Schedule</button>
            <button onClick={() => setEditingSchedule(null)} style={{ marginLeft: '0.5rem' }}>Cancel</button>
          </div>
        )}
      </section>

      {/* Cycle Section */}
      <section>
        <h3>Add Cycle</h3>
        <form onSubmit={handleAddCycle}>
          <select
            required
            value={cycleForm.mareId}
            onChange={(e) => setCycleForm({ ...cycleForm, mareId: e.target.value })}
          >
            <option value="">Select Mare</option>
            {mares.map((m) => (
              <option key={m.id} value={m.id}>
                {m.registeredName}
              </option>
            ))}
          </select>
          <input
            type="date"
            placeholder="Start"
            value={cycleForm.startDate}
            onChange={(e) => setCycleForm({ ...cycleForm, startDate: e.target.value })}
            required
          />
          <input
            type="date"
            placeholder="End"
            value={cycleForm.endDate}
            onChange={(e) => setCycleForm({ ...cycleForm, endDate: e.target.value })}
            required
          />
          <button type="submit">Add Cycle</button>
        </form>
        {/* Visual Cycle Calendar */}
        {cycles.length > 0 && (
          <>
            <h4>Cycles for selected mare</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', background: '#ddd', border: '1px solid #999' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ background: '#eee', padding: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>{d}</div>
              ))}
              {(() => {
                // Find month range
                const dates = cycles.flatMap(c => [new Date(c.startDate), new Date(c.endDate)]);
                const minDate = new Date(Math.min(...dates));
                const maxDate = new Date(Math.max(...dates));
                minDate.setDate(1);
                maxDate.setDate(1);
                maxDate.setMonth(maxDate.getMonth() + 1);
                maxDate.setDate(0);
                
                const firstDay = minDate.getDay();
                const daysInMonth = maxDate.getDate();
                const cells = [];
                
                for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} />);
                
                for (let d = 1; d <= daysInMonth; d++) {
                  const current = new Date(minDate.getFullYear(), minDate.getMonth(), d);
                  const currentStr = current.toISOString().slice(0, 10);
                  const inCycle = cycles.find(c => currentStr >= c.startDate && currentStr <= c.endDate);
                  cells.push(
                    <div key={d} style={{ 
                      background: inCycle ? '#ffcccb' : '#fff', 
                      padding: '4px', 
                      fontSize: '0.75rem',
                      minHeight: '40px',
                      border: inCycle ? '2px solid #e91e63' : '1px solid #eee'
                    }}>
                      <div>{d}</div>
                      {inCycle && <div style={{ color: '#e91e63', fontSize: '0.65rem' }}>Heat</div>}
                    </div>
                  );
                }
                return cells;
              })()}
            </div>
          </>
        )}
      </section>

      {/* Collection Section */}
      <section>
        <h3>Add Collection Day</h3>
        <form onSubmit={handleAddCollection}>
          <select
            required
            value={collectionForm.stallionId}
            onChange={(e) => setCollectionForm({ ...collectionForm, stallionId: e.target.value })}
          >
            <option value="">Select Stallion</option>
            {stallions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.registeredName}
              </option>
            ))}
          </select>

          <select
            required
            value={collectionForm.mareId}
            onChange={(e) => setCollectionForm({ ...collectionForm, mareId: e.target.value })}
          >
            <option value="">Select Mare</option>
            {mares.map((m) => (
              <option key={m.id} value={m.id}>
                {m.registeredName}
              </option>
            ))}
          </select>

          <select
            required
            value={collectionForm.cycleId}
            onChange={(e) => setCollectionForm({ ...collectionForm, cycleId: e.target.value })}
          >
            <option value="">Select Cycle</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
              </option>
            ))}
          </select>

          <input
            type="date"
            required
            value={collectionForm.date}
            onChange={(e) => setCollectionForm({ ...collectionForm, date: e.target.value })}
          />

          <select
            required
            value={collectionForm.method}
            onChange={(e) => setCollectionForm({ ...collectionForm, method: e.target.value })}
          >
            <option value="live">Live Cover</option>
            <option value="cooled">Cooled Semen</option>
            <option value="frozen">Frozen Semen</option>
          </select>

          <button type="submit">Add Collection</button>
        </form>
        <button style={{ marginTop: '1rem' }} onClick={handleExportReport}>
          Export Stallion Report
        </button>
        {report && (
          <pre style={{ background: '#f0f0f0', padding: '1rem' }}>
            {JSON.stringify(report, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
