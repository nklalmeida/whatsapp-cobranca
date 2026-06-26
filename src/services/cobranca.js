const { pool } = require('../db');

async function sincronizarParticipantes(participantes) {
  for (const p of participantes) {
    await pool.query(
      `INSERT INTO participantes (numero, nome) VALUES ($1, $2)
       ON CONFLICT (numero) DO UPDATE SET nome = $2, ativo = true`,
      [p.numero, p.nome]
    );
  }
}

async function buscarPendentes(mes, ano) {
  const { rows } = await pool.query(`
    SELECT p.id, p.numero, p.nome
    FROM participantes p
    LEFT JOIN pagamentos pg ON pg.participante_id = p.id AND pg.mes = $1 AND pg.ano = $2
    WHERE p.ativo = true AND (pg.id IS NULL OR pg.status = 'pendente')
  `, [mes, ano]);
  return rows;
}

async function buscarPendentesComNome(mes, ano, status = null) {
  let condicao = `(pg.id IS NULL OR pg.status = 'pendente')`;
  if (status) condicao = `pg.status = '${status}'`;

  const { rows } = await pool.query(`
    SELECT p.id, p.numero, p.nome, pg.status
    FROM participantes p
    LEFT JOIN pagamentos pg ON pg.participante_id = p.id AND pg.mes = $1 AND pg.ano = $2
    WHERE p.ativo = true AND ${condicao}
  `, [mes, ano]);
  return rows;
}

async function registrarPagamento(numero, status, observacao) {
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();

  const { rows } = await pool.query('SELECT id FROM participantes WHERE numero = $1', [numero]);
  if (!rows.length) return null;

  const participanteId = rows[0].id;

  await pool.query(`
    INSERT INTO pagamentos (participante_id, mes, ano, status, observacao, validado_em)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (participante_id, mes, ano)
    DO UPDATE SET status = $4, observacao = $5, validado_em = NOW()
  `, [participanteId, mes, ano, status, observacao]);

  return participanteId;
}

async function jaEnviouComprovante(numero) {
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();

  const { rows } = await pool.query(`
    SELECT pg.status FROM pagamentos pg
    JOIN participantes p ON p.id = pg.participante_id
    WHERE p.numero = $1 AND pg.mes = $2 AND pg.ano = $3
  `, [numero, mes, ano]);

  return rows[0]?.status || null;
}

async function resumoMensal(mes, ano) {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE pg.status = 'confirmado') as pagos,
      COUNT(*) FILTER (WHERE pg.status = 'aguardando') as aguardando,
      COUNT(*) FILTER (WHERE pg.status IS NULL OR pg.status = 'pendente') as pendentes,
      COUNT(*) as total
    FROM participantes p
    LEFT JOIN pagamentos pg ON pg.participante_id = p.id AND pg.mes = $1 AND pg.ano = $2
    WHERE p.ativo = true
  `, [mes, ano]);
  return rows[0];
}

module.exports = { sincronizarParticipantes, buscarPendentes, buscarPendentesComNome, registrarPagamento, jaEnviouComprovante, resumoMensal };
