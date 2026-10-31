const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

require('./db');

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const lessonRoutes = require('./routes/lessons');

function createApp(options = {}) {
  const { serveClient = true } = options;
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, name: 'IT-Scool' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/lessons', lessonRoutes);
  app.use('/api/contacts', require('./routes/contacts'));
  app.use('/api/groups', require('./routes/groups'));
  app.use('/api/payments', require('./routes/payments'));
  app.use('/api/schedule', require('./routes/schedule'));
  app.use('/api/office', require('./routes/office'));
  app.use('/api/leads', require('./routes/leads'));
  app.use('/api/attendance', require('./routes/attendance'));
  app.use('/api/homework', require('./routes/homework'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/parent', require('./routes/parent'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/announcements', require('./routes/announcements'));
  app.use('/api/student', require('./routes/student'));
  app.use('/api/messages', require('./routes/messages'));
  app.use('/api/materials', require('./routes/materials'));
  app.use('/api/gradebook', require('./routes/gradebook'));
  app.use('/api/diary', require('./routes/diary'));
  app.use('/api/trials', require('./routes/trials'));
  app.use('/api/portfolio', require('./routes/portfolio'));
  app.use('/api/search', require('./routes/search'));
  app.use('/api/files', require('./routes/files'));
  app.use('/api/documents', require('./routes/documents'));
  app.use('/api/builder', require('./routes/builder'));
  app.use('/api/outline', require('./routes/outline'));
  app.use('/api/shares', require('./routes/shares'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/landings', require('./routes/landings'));
  app.use('/api/analytics', require('./routes/analytics'));

  if (serveClient) {
    const clientDist = path.join(__dirname, '..', 'client', 'dist');
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(clientDist, 'index.html'));
      });
    } else {
      app.get('/', (_req, res) => {
        res.type('html').send(`
          <h1>IT-Scool API</h1>
          <p>Клиент ещё не собран. Выполните: <code>npm run build</code></p>
          <p>API: <a href="/api/health">/api/health</a></p>
        `);
      });
    }
  }

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  });

  return app;
}

module.exports = { createApp };
