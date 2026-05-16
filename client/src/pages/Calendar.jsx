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
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [error, setError] = useState('');
  
  // Form state
  const [showMareForm, setShowMareForm] = useState(false);
  const [showStallionForm, setShowStallionForm] = useState(false);
  const [mareForm, setMareForm] = useState({ registeredName: '', barnName: '', dob: '', registry: '' });
  const [stallionForm, setStallionForm] = useState({ registeredName: '', barnName: '', dob: '', registry: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const stallions = await apiFetch('/api/stallions');
      const mares = await apiFetch('/api/mares');
      const allEvents = [];
      const fmt = (d) => d.toISOString().split('T')[0];

      for (const s of stallions) {
        const schedule = await apiFetch(`/api/stallions/${s.id}/schedule`).catch(() => ({ days: [] }));
        const days = schedule.days || [];
        const now = new Date();
        const end = new Date();
        end.setDate(now.getDate() + 60);
        for (let d = new Date(now); d <= end; d.setDate(d.getDate() + 1)) {
          if (days.includes(d.getDay())) {
            allEvents.push({
              title: `${s.barnName || s.registeredName || s.name} collection`,
              start: fmt(d),
              allDay: true,
              backgroundColor: '#4caf50',
              borderColor: '#388e3c',
            });
          }
        }
      }

      for (const m of mares) {
        const est = await apiFetch(`/api/mares/${m.id}/estimated-cycles?count=6`).catch(() => ({ estimatedCycles: [] }));
        const dates = est.estimatedCycles || [];
        dates.forEach(d => {
          allEvents.push({
            title: `${m.barnName || m.registeredName || m.name} heat`,
            start: d,
            allDay: true,
            backgroundColor: '#ff9800',
            borderColor: '#f57c00',
          });
        });
        
        // Add actual cycles
        const cycles = await apiFetch(`/api/mares/${m.id}/cycles`).catch(() => []);
        cycles.forEach(c => {
          allEvents.push({
            title: `${m.barnName || m.registeredName || m.name} cycle`,
            start: c.startDate,
            end: c.endDate,
            allDay: true,
            backgroundColor: '#e91e63',
            borderColor: '#c2185b',
          });
        });
      }

      setEvents(allEvents);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddMare = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/mares', {
        method: 'POST',
        body: JSON.stringify(mareForm),
      });
      setMareForm({ registeredName: '', barnName: '', dob: '', registry: '' });
      setShowMareForm(false);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

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
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <button onClick={() => setShowMareForm(!showMareForm)}>
          {showMareForm ? '✕ Cancel' : '+ Add Mare'}
        </button>
        <button onClick={() => setShowStallionForm(!showStallionForm)}>
          {showStallionForm ? '✕ Cancel' : '+ Add Stallion'}
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
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', background: '#4caf50', borderRadius: '2px' }}></span> Stallion Collection
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', background: '#ff9800', borderRadius: '2px' }}></span> Estimated Heat
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '12px', background: '#e91e63', borderRadius: '2px' }}></span> Cycle
        </span>
      </div>
    </div>
  );
}