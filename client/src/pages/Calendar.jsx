import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const stallions = await apiFetch('/api/stallions');
        const mares = await apiFetch('/api/mares');
        const allEvents = [];
        const fmt = (d) => d.toISOString().split('T')[0];

        for (const s of stallions) {
          const schedule = await apiFetch(`/api/stallions/${s.id}/schedule`);
          const days = schedule.days || [];
          const now = new Date();
          const end = new Date();
          end.setDate(now.getDate() + 30);
          for (let d = new Date(now); d <= end; d.setDate(d.getDate() + 1)) {
            if (days.includes(d.getDay())) {
              allEvents.push({
                title: `${s.name} collection`,
                start: fmt(d),
                allDay: true,
                backgroundColor: '#4caf50',
                borderColor: '#388e3c',
              });
            }
          }
        }

        for (const m of mares) {
          const est = await apiFetch(`/api/mares/${m.id}/estimated-cycles?count=6`);
          const dates = est.estimatedCycles || [];
          dates.forEach(d => {
            allEvents.push({
              title: `${m.name} heat`,
              start: d,
              allDay: true,
              backgroundColor: '#ff9800',
              borderColor: '#f57c00',
            });
          });
        }

        setEvents(allEvents);
      } catch (e) {
        setError(e.message);
      }
    };
    load();
  }, []);

  return (
    <div style={{ maxWidth: '900px', margin: 'auto', padding: '1rem' }}>
      <h2>Calendar (simplified)</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {events.map((e, i) => (
          <li key={i} style={{ color: e.backgroundColor, marginBottom: '0.5rem' }}>
            {e.title} on {e.start}
          </li>
        ))}
      </ul>
    </div>
  );
}
