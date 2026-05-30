import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Register from './pages/Register.jsx';
import Calendar from './pages/Calendar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';

function App() {
  // Skip auth check - use default user
  return (
    <Router>
      <nav style={{ padding: '0.5rem', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
        <Link to="/calendar" style={{ marginRight: '1rem' }}>📅 Calendar</Link>
        <Link to="/dashboard">📋 Dashboard</Link>
      </nav>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={<Navigate to="/calendar" replace />}
        />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
