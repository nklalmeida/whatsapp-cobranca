const express = require('express');
const router = express.Router();
const { registrarPagamento } = require('../services/cobranca');
const { enviarMensagem } = require('../services/whatsapp');
const { pool } = require('../db');

// Webhook do EFI Bank — notifica quando PIX é pago
router.post('/pix-webhook', async (req, res) => {
  res.sendStatus(200); // responde rápido

  const pixList = req.body?.pix;
  if (!pixList || !Array.isArray(pixList)) return;

  for (const pix of pixList) {
    const txid = pix.txid;
    const valor = pix.valor;
    const horario = pix.horario;

    console.log(`💰 PIX recebido! txid: ${txid}, valor: R$ ${valor}`);

    try {
      // Busca o número do participante pelo txid
      const { rows } = await pool.query(
        'SELECT numero FROM participantes WHERE txid_atual = $1',
        [txid]
      );

      if (!rows.length) {
        console.log(`⚠️ txid ${txid} não encontrado no banco`);
        continue;
      }

      const numero = rows[0].numero;
      await registrarPagamento(numero, 'confirmado', `PIX recebido automaticamente — R$ ${valor}`);
      await enviarMensagem(numero,
        `✅ *Pagamento confirmado automaticamente!*\n\n` +
        `💰 Valor: R$ ${valor}\n` +
        `📅 Data: ${new Date(horario).toLocaleDateString('pt-BR')}\n\n` +
        `Obrigado! 🎉`
      );

      console.log(`✅ Pagamento de ${numero} confirmado automaticamente`);
    } catch (err) {
      console.error(`❌ Erro ao processar PIX ${txid}:`, err.message);
    }
  }
});

module.exports = router;
