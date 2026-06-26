const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function iniciarBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS participantes (
      id SERIAL PRIMARY KEY,
      numero VARCHAR(20) UNIQUE NOT NULL,
      nome VARCHAR(100),
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pagamentos (
      id SERIAL PRIMARY KEY,
      participante_id INTEGER REFERENCES participantes(id),
      mes INTEGER NOT NULL,
      ano INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'pendente',
      comprovante_url TEXT,
      validado_em TIMESTAMP,
      observacao TEXT,
      criado_em TIMESTAMP DEFAULT NOW(),
      UNIQUE(participante_id, mes, ano)
    );
  `);
  console.log('✅ Banco de dados pronto');
}

module.exports = { pool, iniciarBanco };
