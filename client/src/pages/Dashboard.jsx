import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { Link } from 'react-router-dom';

// Helper to format dates
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function Dashboard() {
  // Data
  const [mares, setMares] = useState([]);
  const [stallions, setStallions] = useState([]);
  const [cycles, setCycles] = useState([]); // cycles of selected mare
  const [collections, setCollections] = useState([]);

  // Form state
  const [mareForm, setMareForm] = useState({ name: '', birthDate: '', lastBred: '' });
  const [editingMare, setEditingMare] = useState(null);
  const [stallionForm, setStallionForm] = useState({ name: '', breed: '' });
  const [editingStallion, setEditingStallion] = useState(null);
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
      setMareForm({ name: '', birthDate: '', lastBred: '' });
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
      setStallionForm({ name: '', breed: '' });
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
              <strong>{m.name}</strong> (Born: {m.birthDate})
              {m.lastBred && <span> — Last Bred: {m.lastBred}</span>}
              <button style={{ marginLeft: '0.5rem' }} onClick={() => loadCycles(m.id)}>View Cycles</button>
              <button style={{ marginLeft: '0.5rem' }} onClick={() => setEditingMare(m)}>Edit</button>
              <button style={{ marginLeft: '0.5rem', color: 'red' }} onClick={() => handleDeleteMare(m.id)}>Delete</button>
            </li>
          ))}
        </ul>
        {editingMare ? (
          <form onSubmit={handleEditMare} style={{ background: '#f5f5f5', padding: '1rem' }}>
            <h4>Edit Mare</h4>
            <input placeholder="Name" value={editingMare.name} onChange={(e) => setEditingMare({ ...editingMare, name: e.target.value })} required />
            <input type="date" value={editingMare.birthDate} onChange={(e) => setEditingMare({ ...editingMare, birthDate: e.target.value })} required />
            <input type="date" placeholder="Last Bred" value={editingMare.lastBred || ''} onChange={(e) => setEditingMare({ ...editingMare, lastBred: e.target.value })} />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditingMare(null)} style={{ marginLeft: '0.5rem' }}>Cancel</button>
          </form>
        ) : (
          <form onSubmit={handleAddMare}>
            <h4>Add Mare</h4>
            <input placeholder="Name" value={mareForm.name} onChange={(e) => setMareForm({ ...mareForm, name: e.target.value })} required />
            <input type="date" placeholder="Birth Date" value={mareForm.birthDate} onChange={(e) => setMareForm({ ...mareForm, birthDate: e.target.value })} required />
            <input type="date" placeholder="Last Bred" value={mareForm.lastBred} onChange={(e) => setMareForm({ ...mareForm, lastBred: e.target.value })} />
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
              <strong>{s.name}</strong> (Breed: {s.breed || 'Not set'})
              <button style={{ marginLeft: '0.5rem' }} onClick={() => setEditingStallion(s)}>Edit</button>
              <button style={{ marginLeft: '0.5rem', color: 'red' }} onClick={() => handleDeleteStallion(s.id)}>Delete</button>
            </li>
          ))}
        </ul>
        {editingStallion ? (
          <form onSubmit={handleEditStallion} style={{ background: '#f5f5f5', padding: '1rem' }}>
            <h4>Edit Stallion</h4>
            <input placeholder="Name" value={editingStallion.name} onChange={(e) => setEditingStallion({ ...editingStallion, name: e.target.value })} required />
            <input placeholder="Breed" value={editingStallion.breed || ''} onChange={(e) => setEditingStallion({ ...editingStallion, breed: e.target.value })} />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditingStallion(null)} style={{ marginLeft: '0.5rem' }}>Cancel</button>
          </form>
        ) : (
          <form onSubmit={handleAddStallion}>
            <h4>Add Stallion</h4>
            <input placeholder="Name" value={stallionForm.name} onChange={(e) => setStallionForm({ ...stallionForm, name: e.target.value })} required />
            <input placeholder="Breed" value={stallionForm.breed} onChange={(e) => setStallionForm({ ...stallionForm, breed: e.target.value })} />
            <button type="submit">Add Stallion</button>
          </form>
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
                {m.name}
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
                {s.name}
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
                {m.name}
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
