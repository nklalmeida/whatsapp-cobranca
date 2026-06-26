require('dotenv').config();
const express = require('express');
const path = require('path');
const { iniciarBanco } = require('./db');
const { registrarJobs } = require('./jobs/cobrancaJob');
const webhookRoutes = require('./routes/webhook');
const painelRoutes = require('./routes/painel');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Autenticação simples para o painel
app.use('/painel', (req, res, next) => {
  const senha = req.query.senha || req.headers['x-senha'];
  if (senha !== process.env.PAINEL_SENHA) {
    return res.status(401).send(`
      <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f0;">
      <form method="GET" action="/painel" style="background:#fff;padding:2rem;border-radius:12px;border:1px solid #e0ddd6;min-width:300px;">
        <h2 style="margin-bottom:1rem;font-size:18px;">Painel de Cobrança</h2>
        <input name="senha" type="password" placeholder="Senha de acesso" style="width:100%;padding:10px;border:1px solid #e0ddd6;border-radius:8px;margin-bottom:1rem;font-size:14px;">
        <button type="submit" style="width:100%;padding:10px;background:#1d9e75;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Entrar</button>
      </form></body></html>
    `);
  }
  next();
});

app.use('/painel', express.static(path.join(__dirname, '../public')));
app.get('/painel', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.use('/', painelRoutes);
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
    console.log(`🖥️  Painel: http://localhost:${PORT}/painel?senha=SUA_SENHA`);
  });
}

iniciar().catch(console.error);
