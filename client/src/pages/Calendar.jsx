import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { Link } from 'react-router-dom';

const REGISTRIES = [
  'American Quarter Horse Association',
  'American Paint Horse Association',
  'Thoroughbred',
  'Arabian Horse Association',
  'American Morgan Horse Association',
  'American Mustang',
  'Other'
];

export default function Calendar() {
  const [mares, setMares] = useState([]);
  const [stallions, setStallions] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [error, setError] = useState('');
  
  // Form state
  const [showMareForm, setShowMareForm] = useState(false);
  const [showStallionForm, setShowStallionForm] = useState(false);
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [showBreedingForm, setShowBreedingForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [mareForm, setMareForm] = useState({ registeredName: '', barnName: '', dob: '', registry: '' });
  const [breedingForm, setBreedingForm] = useState({ breedDate: '', confirmedInFoal: '', gestationDate: '' });
  const [breedingMareId, setBreedingMareId] = useState(null);
  const [stallionForm, setStallionForm] = useState({ registeredName: '', barnName: '', dob: '', registry: '' });
  const [cycleForm, setCycleForm] = useState({ mareId: '', startDate: '', endDate: '' });
  const [scheduleForm, setScheduleForm] = useState({ stallionId: '', days: [] });
  
  // Edit state
  const [editingMare, setEditingMare] = useState(null);
  const [editingStallion, setEditingStallion] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const stallionsData = await apiFetch('/api/stallions');
      const maresData = await apiFetch('/api/mares');
      setStallions(stallionsData);
      setMares(maresData);
      
      const allEvents = [];
      const fmt = (d) => d.toISOString().split('T')[0];

      for (const s of stallionsData) {
        const schedule = await apiFetch(`/api/stallions/${s.id}/schedule`).catch(() => ({ days: [] }));
        const days = schedule.days || [];
        const now = new Date();
        const end = new Date();
        end.setDate(now.getDate() + 60);
        for (let d = new Date(now); d <= end; d.setDate(d.getDate() + 1)) {
          if (days.includes(d.getDay())) {
            allEvents.push({
              title: `${s.barnName || s.registeredName} collection`,
              start: fmt(d),
              allDay: true,
              backgroundColor: '#4caf50',
              borderColor: '#388e3c',
            });
          }
        }
      }

      for (const m of maresData) {
        // Get breeding info first to check if pregnant
        const breeding = await apiFetch(`/api/mares/${m.id}/breeding`).catch(() => ({}));
        const isPregnant = !!breeding.confirmedInFoal;
        
        // Only show estimated heat cycles if NOT pregnant
        if (!isPregnant) {
          const est = await apiFetch(`/api/mares/${m.id}/estimated-cycles?count=26`).catch(() => ({ estimatedCycles: [] }));
          const dates = est.estimatedCycles || [];
          dates.forEach(d => {
            allEvents.push({
              title: `${m.barnName || m.registeredName} heat`,
              start: d,
              allDay: true,
              backgroundColor: '#ff9800',
              borderColor: '#f57c00',
            });
          });
        }
        
        // Add actual cycles
        const cycles = await apiFetch(`/api/mares/${m.id}/cycles`).catch(() => []);
        cycles.forEach(c => {
          allEvents.push({
            title: `${m.barnName || m.registeredName} cycle`,
            start: c.startDate,
            end: c.endDate,
            allDay: true,
            backgroundColor: '#e91e63',
            borderColor: '#c2185b',
          });
        });

        // Add breeding info (multiple breed dates - show all past breedings)
        if (breeding.breedDate) {
          allEvents.push({
            title: `${m.barnName || m.registeredName} bred`,
            start: breeding.breedDate,
            allDay: true,
            backgroundColor: '#2196f3',
            borderColor: '#1976d2',
          });
        }
        if (breeding.gestationDate) {
          allEvents.push({
            title: `${m.barnName || m.registeredName} due (foal)`,
            start: breeding.gestationDate,
            allDay: true,
            backgroundColor: '#9c27b0',
            borderColor: '#7b1fa2',
          });
        }
        if (breeding.confirmedInFoal) {
          allEvents.push({
            title: `${m.barnName || m.registeredName} in foal confirmed`,
            start: breeding.confirmedInFoal,
            allDay: true,
            backgroundColor: '#00bcd4',
            borderColor: '#0097a7',
          });
        }
      }

      setEvents(allEvents);
    } catch (e) {
      setError(e.message);
    }
  };

  // Mare handlers
  const handleAddMare = async (e) => {
    e.preventDefault();
    try {
      const mare = await apiFetch('/api/mares', {
        method: 'POST',
        body: JSON.stringify(mareForm),
      });
      // Save breeding info if provided
      if (breedingForm.breedDate || breedingForm.confirmedInFoal || breedingForm.gestationDate) {
        await apiFetch(`/api/mares/${mare.id}/breeding`, {
          method: 'PUT',
          body: JSON.stringify(breedingForm),
        });
      }
      setMareForm({ registeredName: '', barnName: '', dob: '', registry: '' });
      setBreedingForm({ breedDate: '', confirmedInFoal: '', gestationDate: '' });
      setShowMareForm(false);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddBreeding = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/mares/${breedingMareId}/breeding`, {
        method: 'PUT',
        body: JSON.stringify(breedingForm),
      });
      setShowBreedingForm(false);
      setBreedingMareId(null);
      setBreedingForm({ breedDate: '', confirmedInFoal: '', gestationDate: '' });
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEditMare = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/mares/${editingMare.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingMare),
      });
      // Save breeding info if provided
      if (editingMare.breedDate || editingMare.confirmedInFoal || editingMare.gestationDate) {
        await apiFetch(`/api/mares/${editingMare.id}/breeding`, {
          method: 'PUT',
          body: JSON.stringify({
            breedDate: editingMare.breedDate,
            confirmedInFoal: editingMare.confirmedInFoal,
            gestationDate: editingMare.gestationDate,
          }),
        });
      }
      setEditingMare(null);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  // Stallion schedule handler
  const handleSetSchedule = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/stallions/${scheduleForm.stallionId}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ days: scheduleForm.days }),
      });
      setShowScheduleForm(false);
      setScheduleForm({ stallionId: '', days: [] });
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteMare = async (id) => {
    if (!confirm('Delete this mare?')) return;
    try {
      await apiFetch(`/api/mares/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  // Stallion handlers
  const handleAddStallion = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/stallions', {
        method: 'POST',
        body: JSON.stringify(stallionForm),
      });
      setStallionForm({ registeredName: '', barnName: '', dob: '', registry: '' });
      setShowStallionForm(false);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEditStallion = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/stallions/${editingStallion.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingStallion),
      });
      setEditingStallion(null);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteStallion = async (id) => {
    if (!confirm('Delete this stallion?')) return;
    try {
      await apiFetch(`/api/stallions/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  // Cycle handlers
  const handleAddCycle = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/mares/${cycleForm.mareId}/cycles`, {
        method: 'POST',
        body: JSON.stringify({ startDate: cycleForm.startDate, endDate: cycleForm.endDate }),
      });
      setCycleForm({ mareId: '', startDate: '', endDate: '' });
      setShowCycleForm(false);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  // Calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.start === dateStr || (e.end && dateStr >= e.start && dateStr <= e.end));
  };

  return (
    <div style={{ maxWidth: '1000px', margin: 'auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>📅 Calendar</h2>
        <Link to="/">🏠 Dashboard</Link>
      </div>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Quick Add Buttons */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => setShowMareForm(!showMareForm)}>
          {showMareForm ? '✕ Cancel' : '+ Add Mare'}
        </button>
        <button onClick={() => setShowStallionForm(!showStallionForm)}>
          {showStallionForm ? '✕ Cancel' : '+ Add Stallion'}
        </button>
        <button onClick={() => setShowCycleForm(!showCycleForm)}>
          {showCycleForm ? '✕ Cancel' : '+ Add Heat Cycle'}
        </button>
      </div>

      {/* Mare Form */}
      {showMareForm && (
        <form onSubmit={handleAddMare} style={{ background: '#f5f5f5', padding: '1rem', marginBottom: '1rem' }}>
          <h4>Add Mare</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            <input placeholder="Registered Name" value={mareForm.registeredName} onChange={e => setMareForm({ ...mareForm, registeredName: e.target.value })} required />
            <input placeholder="Barn Name (Nickname)" value={mareForm.barnName} onChange={e => setMareForm({ ...mareForm, barnName: e.target.value })} />
            <input type="date" placeholder="DOB" value={mareForm.dob} onChange={e => setMareForm({ ...mareForm, dob: e.target.value })} required />
            <select value={mareForm.registry} onChange={e => setMareForm({ ...mareForm, registry: e.target.value })} required>
              <option value="">Select Registry</option>
              {REGISTRIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <h4 style={{ marginTop: '1rem' }}>Breeding Info (Optional)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            <input type="date" placeholder="Breed Date" value={breedingForm.breedDate} onChange={e => setBreedingForm({ ...breedingForm, breedDate: e.target.value })} />
            <input type="date" placeholder="Confirmed In Foal" value={breedingForm.confirmedInFoal} onChange={e => setBreedingForm({ ...breedingForm, confirmedInFoal: e.target.value })} />
            <input type="date" placeholder="Gestation Due Date" value={breedingForm.gestationDate} onChange={e => setBreedingForm({ ...breedingForm, gestationDate: e.target.value })} />
          </div>
          <button type="submit" style={{ marginTop: '0.5rem' }}>Add Mare</button>
        </form>
      )}

      {/* Stallion Form */}
      {showStallionForm && (
        <form onSubmit={handleAddStallion} style={{ background: '#f5f5f5', padding: '1rem', marginBottom: '1rem' }}>
          <h4>Add Stallion</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            <input placeholder="Registered Name" value={stallionForm.registeredName} onChange={e => setStallionForm({ ...stallionForm, registeredName: e.target.value })} required />
            <input placeholder="Barn Name (Nickname)" value={stallionForm.barnName} onChange={e => setStallionForm({ ...stallionForm, barnName: e.target.value })} />
            <input type="date" placeholder="DOB" value={stallionForm.dob} onChange={e => setStallionForm({ ...stallionForm, dob: e.target.value })} required />
            <select value={stallionForm.registry} onChange={e => setStallionForm({ ...stallionForm, registry: e.target.value })} required>
              <option value="">Select Registry</option>
              {REGISTRIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" style={{ marginTop: '0.5rem' }}>Add Stallion</button>
        </form>
      )}

      {/* Cycle Form */}
      {showCycleForm && (
        <form onSubmit={handleAddCycle} style={{ background: '#fce4ec', padding: '1rem', marginBottom: '1rem' }}>
          <h4>Add Heat Cycle</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            <select value={cycleForm.mareId} onChange={e => setCycleForm({ ...cycleForm, mareId: e.target.value })} required>
              <option value="">Select Mare</option>
              {mares.map(m => <option key={m.id} value={m.id}>{m.registeredName} {m.barnName && `(${m.barnName})`}</option>)}
            </select>
            <input type="date" placeholder="Start Date" value={cycleForm.startDate} onChange={e => setCycleForm({ ...cycleForm, startDate: e.target.value })} required />
            <input type="date" placeholder="End Date" value={cycleForm.endDate} onChange={e => setCycleForm({ ...cycleForm, endDate: e.target.value })} required />
          </div>
          <button type="submit" style={{ marginTop: '0.5rem' }}>Add Cycle</button>
        </form>
      )}

      {/* Breeding Info Form */}
      {showBreedingForm && (
        <form onSubmit={handleAddBreeding} style={{ background: '#e3f2fd', padding: '1rem', marginBottom: '1rem' }}>
          <h4>Set Breeding Info</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            <input type="date" placeholder="Breed Date" value={breedingForm.breedDate} onChange={e => setBreedingForm({ ...breedingForm, breedDate: e.target.value })} />
            <input type="date" placeholder="Confirmed In Foal" value={breedingForm.confirmedInFoal} onChange={e => setBreedingForm({ ...breedingForm, confirmedInFoal: e.target.value })} />
            <input type="date" placeholder="Gestation Due Date" value={breedingForm.gestationDate} onChange={e => setBreedingForm({ ...breedingForm, gestationDate: e.target.value })} />
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit">Save Breeding Info</button>
            <button type="button" onClick={() => { setShowBreedingForm(false); setBreedingMareId(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Stallion Schedule Form */}
      {showScheduleForm && (
        <form onSubmit={handleSetSchedule} style={{ background: '#e8f5e9', padding: '1rem', marginBottom: '1rem' }}>
          <h4>Set Collection Days</h4>
          <p>Select days of the week for semen collection:</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
              <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: scheduleForm.days.includes(idx) ? '#4caf50' : '#fff', borderRadius: '4px', border: '1px solid #ccc' }}>
                <input type="checkbox" checked={scheduleForm.days.includes(idx)} onChange={e => {
                  if (e.target.checked) {
                    setScheduleForm({ ...scheduleForm, days: [...scheduleForm.days, idx] });
                  } else {
                    setScheduleForm({ ...scheduleForm, days: scheduleForm.days.filter(d => d !== idx) });
                  }
                }} />
                {day}
              </label>
            ))}
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit">Save Schedule</button>
            <button type="button" onClick={() => { setShowScheduleForm(false); setScheduleForm({ stallionId: '', days: [] }); }}>Cancel</button>
          </div>
        </form>
      )}


      {/* Edit Mare Modal */}
      {editingMare && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleEditMare} style={{ background: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '90%' }}>
            <h3>Edit Mare</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <input placeholder="Registered Name" value={editingMare.registeredName || ''} onChange={e => setEditingMare({ ...editingMare, registeredName: e.target.value })} required />
              <input placeholder="Barn Name" value={editingMare.barnName || ''} onChange={e => setEditingMare({ ...editingMare, barnName: e.target.value })} />
              <input type="date" value={editingMare.dob || ''} onChange={e => setEditingMare({ ...editingMare, dob: e.target.value })} required />
              <select value={editingMare.registry || ''} onChange={e => setEditingMare({ ...editingMare, registry: e.target.value })}>
                <option value="">Select Registry</option>
                {REGISTRIES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button type="submit">Save</button>
              <button type="button" onClick={() => setEditingMare(null)}>Cancel</button>
              <button type="button" onClick={() => { handleDeleteMare(editingMare.id); setEditingMare(null); }} style={{ color: 'red', marginLeft: 'auto' }}>Delete</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Stallion Modal */}
      {editingStallion && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleEditStallion} style={{ background: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '90%' }}>
            <h3>Edit Stallion</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <input placeholder="Registered Name" value={editingStallion.registeredName || ''} onChange={e => setEditingStallion({ ...editingStallion, registeredName: e.target.value })} required />
              <input placeholder="Barn Name" value={editingStallion.barnName || ''} onChange={e => setEditingStallion({ ...editingStallion, barnName: e.target.value })} />
              <input type="date" value={editingStallion.dob || ''} onChange={e => setEditingStallion({ ...editingStallion, dob: e.target.value })} required />
              <select value={editingStallion.registry || ''} onChange={e => setEditingStallion({ ...editingStallion, registry: e.target.value })}>
                <option value="">Select Registry</option>
                {REGISTRIES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button type="submit">Save</button>
              <button type="button" onClick={() => setEditingStallion(null)}>Cancel</button>
              <button type="button" onClick={() => { handleDeleteStallion(editingStallion.id); setEditingStallion(null); }} style={{ color: 'red', marginLeft: 'auto' }}>Delete</button>
            </div>
          </form>
        </div>
      )}

      {/* Mares & Stallions List */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ background: '#f5f5f5', padding: '1rem' }}>
          <h3>Mares</h3>
          {mares.length === 0 ? <p>No mares added yet</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {mares.map(m => (
                <li key={m.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: 'white', borderRadius: '4px' }}>
                  <strong>{m.registeredName}</strong>
                  {m.barnName && <span> ({m.barnName})</span>}
                  <br /><small>{m.registry} • DOB: {m.dob}</small>
                  <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setEditingMare(m)}>Edit</button>
                    <button onClick={async () => {
                      const breeding = await apiFetch(`/api/mares/${m.id}/breeding`).catch(() => ({}));
                      setBreedingForm({ breedDate: breeding.breedDate || '', confirmedInFoal: breeding.confirmedInFoal || '', gestationDate: breeding.gestationDate || '' });
                      setBreedingMareId(m.id);
                      setShowBreedingForm(true);
                    }}>Breeding Info</button>
                    <button onClick={() => handleDeleteMare(m.id)} style={{ color: 'red' }}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ background: '#f5f5f5', padding: '1rem' }}>
          <h3>Stallions</h3>
          {stallions.length === 0 ? <p>No stallions added yet</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {stallions.map(s => (
                <li key={s.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: 'white', borderRadius: '4px' }}>
                  <strong>{s.registeredName}</strong>
                  {s.barnName && <span> ({s.barnName})</span>}
                  <br /><small>{s.registry} • DOB: {s.dob}</small>
                  <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setEditingStallion(s)}>Edit</button>
                    <button onClick={() => { setScheduleForm({ stallionId: s.id, days: [] }); setShowScheduleForm(true); }}>Set Collection Days</button>
                    <button onClick={() => handleDeleteStallion(s.id)} style={{ color: 'red' }}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ border: '2px solid #333', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#333', color: 'white', padding: '0.5rem' }}>
          <button onClick={prevMonth} style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>◀</button>
          <h3 style={{ margin: 0 }}>{monthName}</h3>
          <button onClick={nextMonth} style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>▶</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#ddd' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ background: '#eee', padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #ccc' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#fff' }}>
          {Array(firstDay).fill(null).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: '80px', border: '1px solid #eee', background: '#f9f9f9' }} />
          ))}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            return (
              <div key={day} style={{ minHeight: '80px', border: '1px solid #eee', padding: '4px', fontSize: '0.9rem' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{day}</div>
                {dayEvents.slice(0, 3).map((e, idx) => (
                  <div key={idx} style={{ 
                    background: e.backgroundColor, 
                    color: 'white', 
                    padding: '2px 4px', 
                    borderRadius: '3px', 
                    fontSize: '0.7rem',
                    marginBottom: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 3 && <div style={{ fontSize: '0.65rem', color: '#666' }}>+{dayEvents.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', background: '#4caf50', borderRadius: '2px' }}></span> Stallion Collection
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', background: '#ff9800', borderRadius: '2px' }}></span> Estimated Heat
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', background: '#e91e63', borderRadius: '2px' }}></span> Cycle
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', background: '#2196f3', borderRadius: '2px' }}></span> Bred
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', background: '#00bcd4', borderRadius: '2px' }}></span> In Foal Confirmed
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', background: '#9c27b0', borderRadius: '2px' }}></span> Due (Foal)
        </span>
      </div>
    </div>
  );
}