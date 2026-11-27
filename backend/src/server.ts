import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 4000);
const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`UberBuses Backend API listening on port ${PORT}`);
});
