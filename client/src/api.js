export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'API error');
    err.response = res;
    err.data = data;
    throw err;
  }
  return data;
}
