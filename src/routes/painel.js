const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/api/dashboard', async (req, res) => {
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();
  try {
    const { rows: resumo } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE pg.status = 'confirmado') as pagos,
        COUNT(*) FILTER (WHERE pg.status = 'aguardando') as aguardando,
        COUNT(*) FILTER (WHERE pg.status = 'rejeitado') as rejeitados,
        COUNT(*) FILTER (WHERE pg.status IS NULL OR pg.status = 'pendente') as pendentes,
        COUNT(p.id) as total
      FROM participantes p
      LEFT JOIN pagamentos pg ON pg.participante_id = p.id AND pg.mes = $1 AND pg.ano = $2
      WHERE p.ativo = true
    `, [mes, ano]);

    const { rows: participantes } = await pool.query(`
      SELECT p.id, p.numero, p.nome, p.criado_em,
        pg.status, pg.validado_em, pg.observacao
      FROM participantes p
      LEFT JOIN pagamentos pg ON pg.participante_id = p.id AND pg.mes = $1 AND pg.ano = $2
      WHERE p.ativo = true
      ORDER BY pg.status NULLS LAST, p.nome
    `, [mes, ano]);

    const { rows: historico } = await pool.query(`
      SELECT p.nome, p.numero, pg.mes, pg.ano, pg.status, pg.validado_em
      FROM pagamentos pg
      JOIN participantes p ON p.id = pg.participante_id
      ORDER BY pg.ano DESC, pg.mes DESC, pg.validado_em DESC
      LIMIT 50
    `);

    res.json({ resumo: resumo[0], participantes, historico, mes, ano });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/confirmar', async (req, res) => {
  const { numero, status, observacao } = req.body;
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();
  try {
    const { rows } = await pool.query('SELECT id FROM participantes WHERE numero = $1', [numero]);
    if (!rows.length) return res.status(404).json({ error: 'Participante não encontrado' });
    await pool.query(`
      INSERT INTO pagamentos (participante_id, mes, ano, status, observacao, validado_em)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (participante_id, mes, ano)
      DO UPDATE SET status = $4, observacao = $5, validado_em = NOW()
    `, [rows[0].id, mes, ano, status, observacao || '']);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
