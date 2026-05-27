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

const STALLION_COLORS = [
  { backgroundColor: '#2e7d32', borderColor: '#1b5e20' }, // green
  { backgroundColor: '#1565c0', borderColor: '#0d47a1' }, // blue
  { backgroundColor: '#6a1b9a', borderColor: '#4a148c' }, // purple
  { backgroundColor: '#c62828', borderColor: '#b71c1c' }, // red
  { backgroundColor: '#ef6c00', borderColor: '#e65100' }, // orange
  { backgroundColor: '#00838f', borderColor: '#006064' }, // teal
  { backgroundColor: '#4527a0', borderColor: '#311b92' }, // deep purple
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
  const [showVetForm, setShowVetForm] = useState(false);
  const [mareForm, setMareForm] = useState({
    registeredName: '',
    barnName: '',
    dob: '',
    registry: ''
  });

  // **Added stallionId to breedingForm**
  const [breedingForm, setBreedingForm] = useState({
    breedDate: '',
    breedDates: [],
    stallionId: '',            // NEW
    confirmedInFoal: '',
    gestationDate: ''
  });

  const [breedingMareId, setBreedingMareId] = useState(null);
  const [stallionForm, setStallionForm] = useState({
    registeredName: '',
    barnName: '',
    dob: '',
    registry: ''
  });
  const [cycleForm, setCycleForm] = useState({
    mareId: '',
    startDate: '',
    endDate: ''
  });
  const [scheduleForm, setScheduleForm] = useState({
    stallionId: '',
    days: []
  });
  const [vetForm, setVetForm] = useState({
    mareId: '',
    stallionId: '',
    date: '',
    time: '',
    vetName: '',
    reason: '',
    notes: ''
  });
  
  // Edit state
  const [editingMare, setEditingMare] = useState(null);
  const [editingStallion, setEditingStallion] = useState(null);
  const [editingCyclesMare, setEditingCyclesMare] = useState(null);
  const [mareCycles, setMareCycles] = useState([]);

  // Load data
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
      const fmt = d => d.toISOString().split('T')[0];

      // Stallion collection days
      for (let si = 0; si < stallionsData.length; si++) {
        const s = stallionsData[si];
        const schedule = await apiFetch(`/api/stallions/${s.id}/schedule`).catch(() => ({ days: [] }));
        const days = schedule.days || [];
        const stallionColor = STALLION_COLORS[si % STALLION_COLORS.length];
        const now = new Date();
        const end = new Date();
        end.setDate(now.getDate() + 60);
        for (let d = new Date(now); d <= end; d.setDate(d.getDate() + 1)) {
          if (days.includes(d.getDay())) {
            allEvents.push({
              title: `${s.barnName || s.registeredName} collection`,
              start: fmt(d),
              allDay: true,
              backgroundColor: stallionColor.backgroundColor,
              borderColor: stallionColor.borderColor,
            });
          }
        }
      }

      // Mare specific events
      for (const m of maresData) {
        const breeding = await apiFetch(`/api/mares/${m.id}/breeding`).catch(() => ({}));
        const isPregnant = !!breeding.confirmedInFoal;
        // Estimated heat cycles (only when NOT pregnant)
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
        // Actual cycles
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
        // Breeding events (show stallion used)
        if (breeding.breedDate) {
          const stallionName = (() => {
            const s = stallions.find(st => st.id === breeding.stallionId);
            return s ? `${s.barnName || s.registeredName}` : 'Unknown';
          })();
          allEvents.push({
            title: `${m.barnName || m.registeredName} bred → ${stallionName}`,
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

      // Vet appointments
      const vetAppts = await apiFetch('/api/vet-appointments').catch(() => []);
      vetAppts.forEach(v => {
        const title = v.vet_name
          ? `${v.vet_name}${v.reason ? ' - ' + v.reason : ''}`
          : (v.reason || 'Vet Appointment');
        allEvents.push({
          title,
          start: v.date,
          allDay: true,
          backgroundColor: '#f44336',
          borderColor: '#d32f2f',
        });
      });

      setEvents(allEvents);
    } catch (e) {
      setError(e.message);
    }
  };

  // Mare handlers
  const handleAddMare = async e => {
    e.preventDefault();
    try {
      const mare = await apiFetch('/api/mares', {
        method: 'POST',
        body: JSON.stringify(mareForm),
      });
      if (breedingForm.breedDate || breedingForm.confirmedInFoal || breedingForm.gestationDate) {
        await apiFetch(`/api/mares/${mare.id}/breeding`, {
          method: 'PUT',
          body: JSON.stringify(breedingForm),
        });
      }
      setMareForm({ registeredName: '', barnName: '', dob: '', registry: '' });
      setBreedingForm({ breedDate: '', breedDates: [], stallionId: '', confirmedInFoal: '', gestationDate: '' });
      setShowMareForm(false);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddBreeding = async e => {
    e.preventDefault();
    try {
      await apiFetch(`/api/mares/${breedingMareId}/breeding`, {
        method: 'PUT',
        body: JSON.stringify(breedingForm),
      });
      setShowBreedingForm(false);
      setBreedingMareId(null);
      setBreedingForm({ breedDate: '', breedDates: [], stallionId: '', confirmedInFoal: '', gestationDate: '' });
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEditMare = async e => {
    e.preventDefault();
    try {
      await apiFetch(`/api/mares/${editingMare.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingMare),
      });
      if (editingMare.breedDate || editingMare.confirmedInFoal || editingMare.gestationDate) {
        await apiFetch(`/api/mares/${editingMare.id}/breeding`, {
          method: 'PUT',
          body: JSON.stringify({
            breedDate: editingMare.breedDate,
            confirmedInFoal: editingMare.confirmedInFoal,
            gestationDate: editingMare.gestationDate,
            stallionId: editingMare.stallionId,
          }),
        });
      }
      setEditingMare(null);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  // Stallion handlers
  const handleAddStallion = async e => {
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

  const handleEditStallion = async e => {
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

  // Cycle handlers
  const handleAddCycle = async e => {
    e.preventDefault();
    try {
      await apiFetch(`/api/cycles`, {
        method: 'POST',
        body: JSON.stringify({
          mareId: cycleForm.mareId,
          startDate: cycleForm.startDate,
          endDate: cycleForm.endDate,
        }),
      });
      setCycleForm({ mareId: '', startDate: '', endDate: '' });
      setShowCycleForm(false);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  // Vet handlers
  const handleAddVetAppointment = async e => {
    e.preventDefault();
    try {
      await apiFetch('/api/vet-appointments', {
        method: 'POST',
        body: JSON.stringify(vetForm),
      });
      setVetForm({
        mareId: '',
        stallionId: '',
        date: '',
        time: '',
        vetName: '',
        reason: '',
        notes: '',
      });
      setShowVetForm(false);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  // Calendar navigation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getEventsForDay = day => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(
      e => e.start === dateStr || (e.end && dateStr >= e.start && dateStr <= e.end)
    );
  };

  // Render
  return (
    <div style={{ maxWidth: '1000px', margin: 'auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>📅 Calendar</h2>
        <Link to="/">🏠 Dashboard</Link>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Quick‑add buttons */}
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
        <button onClick={() => setShowVetForm(!showVetForm)}>
          {showVetForm ? '✕ Cancel' : '+ Add Vet Appointment'}
        </button>
      </div>

      {/* Mare Form */}
      {showMareForm && (
        <form onSubmit={handleAddMare} style={{ background: '#f5f5f5', padding: '1rem', marginBottom: '1rem' }}>
          <h4>Add Mare</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.5rem' }}>
            <input placeholder="Registered Name" value={mareForm.registeredName}
                   onChange={e => setMareForm({ ...mareForm, registeredName: e.target.value })} required />
            <input placeholder="Barn Name (Nickname)" value={mareForm.barnName}
                   onChange={e => setMareForm({ ...mareForm, barnName: e.target.value })} />
            <input type="date" placeholder="DOB" value={mareForm.dob}
                   onChange={e => setMareForm({ ...mareForm, dob: e.target.value })} required />
            <select value={mareForm.registry}
                    onChange={e => setMareForm({ ...mareForm, registry: e.target.value })} required>
              <option value="">Select Registry</option>
              {REGISTRIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Optional breeding info while creating the mare */}
          <div style={{ marginTop: '0.75rem', background: '#e3f2fd', padding: '0.75rem' }}>
            <h5>Optional Breeding Info</h5>
            {/* Breed Date */}
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Breed Date</label>
              <input type="date" value={breedingForm.breedDate}
                     onChange={e => setBreedingForm({ ...breedingForm, breedDate: e.target.value })} />
            </div>
            {/* **Stallion selector** */}
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Stallion (Bred To)</label>
              <select value={breedingForm.stallionId}
                      onChange={e => setBreedingForm({ ...breedingForm, stallionId: e.target.value })}>
                <option value="">Select Stallion</option>
                {stallions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.barnName || s.registeredName}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Confirmed In‑Foal</label>
              <input type="date" value={breedingForm.confirmedInFoal}
                     onChange={e => setBreedingForm({ ...breedingForm, confirmedInFoal: e.target.value })} />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Gestation Due Date</label>
              <input type="date" value={breedingForm.gestationDate}
                     onChange={e => setBreedingForm({ ...breedingForm, gestationDate: e.target.value })} />
            </div>
          </div>

          <button type="submit" style={{ marginTop: '0.5rem' }}>Add Mare</button>
        </form>
      )}

      {/* Stallion Form */}
      {showStallionForm && (
        <form onSubmit={handleAddStallion} style={{ background: '#f5f5f5', padding: '1rem', marginBottom: '1rem' }}>
          <h4>Add Stallion</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.5rem' }}>
            <input placeholder="Registered Name" value={stallionForm.registeredName}
                   onChange={e => setStallionForm({ ...stallionForm, registeredName: e.target.value })} required />
            <input placeholder="Barn Name (Nickname)" value={stallionForm.barnName}
                   onChange={e => setStallionForm({ ...stallionForm, barnName: e.target.value })} />
            <input type="date" placeholder="DOB" value={stallionForm.dob}
                   onChange={e => setStallionForm({ ...stallionForm, dob: e.target.value })} required />
            <select value={stallionForm.registry}
                    onChange={e => setStallionForm({ ...stallionForm, registry: e.target.value })} required>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
            <select value={cycleForm.mareId}
                    onChange={e => setCycleForm({ ...cycleForm, mareId: e.target.value })} required>
              <option value="">Select Mare</option>
              {mares.map(m => <option key={m.id} value={m.id}>{m.registeredName} {m.barnName && `(${m.barnName})`}</option>)}
            </select>
            <input type="date" placeholder="Start Date" value={cycleForm.startDate}
                   onChange={e => setCycleForm({ ...cycleForm, startDate: e.target.value })} required />
            <input type="date" placeholder="End Date" value={cycleForm.endDate}
                   onChange={e => setCycleForm({ ...cycleForm, endDate: e.target.value })} required />
          </div>
          <button type="submit" style={{ marginTop: '0.5rem' }}>Add Cycle</button>
        </form>
      )}

      {/* Breeding Info Form */}
      {showBreedingForm && (
        <form onSubmit={handleAddBreeding} style={{ background: '#e3f2fd', padding: '1rem', marginBottom: '1rem' }}>
          <h4>Set Breeding Info</h4>
          {breedingForm.breedDates && breedingForm.breedDates.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Breed Dates:</strong>
              <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem' }}>
                {breedingForm.breedDates.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Add Breed Date</label>
              <input type="date" style={{ width: '100%' }} value={breedingForm.breedDate}
                     onChange={e => setBreedingForm({ ...breedingForm, breedDate: e.target.value })} />
            </div>
            {/* **Stallion selector** */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Stallion (Bred To)</label>
              <select style={{ width: '100%' }} value={breedingForm.stallionId}
                      onChange={e => setBreedingForm({ ...breedingForm, stallionId: e.target.value })}>
                <option value="">Select Stallion</option>
                {stallions.map(s => (
                  <option key={s.id} value={s.id}>{s.barnName || s.registeredName}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Confirmed In‑Foal</label>
              <input type="date" style={{ width: '100%' }} value={breedingForm.confirmedInFoal}
                     onChange={e => setBreedingForm({ ...breedingForm, confirmedInFoal: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Gestation Due Date</label>
              <input type="date" style={{ width: '100%' }} value={breedingForm.gestationDate}
                     onChange={e => setBreedingForm({ ...breedingForm, gestationDate: e.target.value })} />
            </div>
          </div>
          <button type="submit" style={{ marginTop: '0.5rem' }}>Save Breeding Info</button>
          <button type="button" onClick={() => setShowBreedingForm(false)} style={{ marginLeft: '0.5rem' }}>Cancel</button>
        </form>
      )}

      {/* Vet Form */}
      {showVetForm && (
        <form onSubmit={handleAddVetAppointment} style={{ background: '#fff3e0', padding: '1rem', marginBottom: '1rem' }}>
          <h4>Add Vet Appointment</h4>
          {/* (form fields omitted for brevity – unchanged) */}
          <button type="submit" style={{ marginTop: '0.5rem' }}>Add Vet</button>
        </form>
      )}

      {/* Calendar Grid */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <button onClick={prevMonth}>◀</button>
        <strong style={{ margin: '0 1rem' }}>{monthName}</strong>
        <button onClick={nextMonth}>▶</button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7,1fr)',
        gap: '4px'
      }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
          <div key={d} style={{ fontWeight:'bold', padding:'0.25rem' }}>{d}</div>
        ))}
        {Array.from({length:firstDay}).map((_,i)=>(
          <div key={'blank-'+i}/>
        ))}
        {Array.from({length:daysInMonth}).map((_,i)=>{
          const day = i+1;
          const today = new Date();
          const isToday = today.getDate()===day && today.getMonth()===month && today.getFullYear()===year;
          const dayEvents = getEventsForDay(day);
          return (
            <div key={day}
                 style={{
                   border: isToday ? '2px solid var(--brown-medium)' : '1px solid #ddd',
                   borderRadius: '6px',
                   padding: '0.25rem',
                   minHeight: '60px',
                   background: '#fff',
                   position: 'relative'
                 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: isToday ? 'bold' : 'normal' }}>{day}</div>
              {dayEvents.map((ev,idx)=>(
                <div key={idx}
                     style={{
                       fontSize: '0.7rem',
                       marginTop: '2px',
                       padding: '1px 2px',
                       borderRadius: '3px',
                       background: ev.backgroundColor,
                       borderLeft: `3px solid ${ev.borderColor}`,
                       overflow: 'hidden',
                       textOverflow: 'ellipsis',
                       whiteSpace: 'nowrap'
                     }}
                     title={ev.title}>{ev.title}</div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
