require('dotenv').config();
const express = require('express');
const { iniciarBanco } = require('./db');
const { registrarJobs } = require('./jobs/cobrancaJob');
const webhookRoutes = require('./routes/webhook');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use('/', webhookRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

async function iniciar() {
  await iniciarBanco();
  registrarJobs();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🤖 Agente de cobrança rodando na porta ${PORT}`);
    console.log(`📅 Cobrança automática: todo dia 1 às 9h`);
    console.log(`🔔 Lembretes: dias 10 e 25 de cada mês`);
  });
}

iniciar().catch(console.error);
