import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import '@fullcalendar/common/main.css';
import '@fullcalendar/daygrid/main.css';

// Helper to generate a date string (YYYY-MM-DD)
const fmt = (d) => d.toISOString().split('T')[0];

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load everything and build the FullCalendar event list
    const load = async () => {
      try {
        const stallions = await apiFetch('/api/stallions');
        const mares = await apiFetch('/api/mares');
        const allEvents = [];

        // ---- Stallion collection schedules (weekly recurring) ----
        for (const s of stallions) {
          // fetch days of week (0=Sun..6=Sat)
          const schedule = await apiFetch(`/api/stallions/${s.id}/schedule`);
          const days = schedule.days || [];
          // create events for the next 30 days
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

        // ---- Mare heat‑cycle estimates ----
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
      <h2>Full Calendar Overview</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek,dayGridDay',
        }}
        events={events}
        height="auto"
      />
      <p style={{ marginTop: '1rem' }}>
        <span style={{ background: '#4caf50', color: 'white', padding: '2px 6px', borderRadius: '3px' }}>Stallion collection day</span>{' '}
        <span style={{ background: '#ff9800', color: 'white', padding: '2px 6px', borderRadius: '3px', marginLeft: '0.5rem' }}>Mare heat‑cycle start</span>
      </p>
    </div>
  );
}
