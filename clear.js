const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('horsebreeder.db');
const tables = ['users','mares','cycles','stallions','collections'];
let pending = tables.length;
tables.forEach(t => {
  db.run(`DELETE FROM ${t};`, err => {
    if (err) console.error('Error clearing', t, err);
    if (--pending === 0) {
      db.close();
    }
  });
});
