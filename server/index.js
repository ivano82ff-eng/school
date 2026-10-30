/**
 * Local and VPS entry: one Node process serves API + client/dist.
 */
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp({ serveClient: true });

app.listen(PORT, () => {
  console.log(`IT-Scool запущена: http://localhost:${PORT}`);
});
