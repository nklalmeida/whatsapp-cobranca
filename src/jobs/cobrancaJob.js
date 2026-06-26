const cron = require('node-cron');
const { buscarPendentes, sincronizarParticipantes, resumoMensal } = require('../services/cobranca');
const { enviarMensagem, enviarMensagemGrupo, buscarParticipantesGrupo } = require('../services/whatsapp');
const { criarCobrancaPix } = require('../services/efi');
const { pool } = require('../db');

function mensagemCobrancaGrupo() {
  const mes = new Date().toLocaleString('pt-BR', { month: 'long' });

  return `📢 *Lembrete de mensalidade - ${mes}*\n\nOlá pessoal! 👋\n\n` +
    `A mensalidade no valor de *R$ ${process.env.VALOR_MENSAL}* está disponível para pagamento.\n\n` +
    `Cada um vai receber no privado o PIX automaticamente. 📱\n\n` +
    `O pagamento é confirmado automaticamente assim que cair. ✅`;
}

async function enviarCobrancaComPix(participante) {
  try {

    // ✅ CRIA COBRANÇA (EFÍ gera txid automaticamente)
    const cobranca = await criarCobrancaPix(
      participante.numero,
      participante.nome,
      process.env.VALOR_MENSAL
    );
console.log("🔍 COBRANÇA COMPLETA:", cobranca);
console.log("🔍 PIX COPIA E COLA:", cobranca?.pixCopiaECola);
    // salva referência no banco (opcional)
    await pool.query(
      'UPDATE participantes SET txid_atual = $1 WHERE numero = $2',
      [cobranca.txid, participante.numero]
    );

    const primeiroNome = participante.nome?.split(' ')[0] || 'você';

    const msg =
      `Olá, ${primeiroNome}! 👋\n\n` +
      `Sua mensalidade de *R$ ${process.env.VALOR_MENSAL}* está disponível.\n\n` +
      `📲 *PIX Copia e Cola:*\n\n` +
      `\`${cobranca.pixCopiaECola}\`\n\n` +
      `O pagamento é confirmado automaticamente! ✅\n\n` +
      `Ou use a chave PIX: ${process.env.PIX_CHAVE}`;

    await enviarMensagem(participante.numero, msg);

    console.log(`✅ PIX enviado para ${participante.numero}`);

  } catch (err) {
    console.error(`❌ Erro ao enviar cobrança para ${participante.numero}:`, err.message);

    const fallback =
      `Olá! Sua mensalidade de *R$ ${process.env.VALOR_MENSAL}* está disponível.\n\n` +
      `PIX: ${process.env.PIX_CHAVE}\n\n` +
      `Após pagar, envie o comprovante aqui 📸`;

    await enviarMensagem(participante.numero, fallback);
  }
}

async function executarCobrancaMensal() {
  console.log('🚀 Iniciando cobrança mensal...');

  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();

  try {
    const participantes = await buscarParticipantesGrupo();
    await sincronizarParticipantes(participantes);

    await enviarMensagemGrupo(mensagemCobrancaGrupo());
    console.log('✅ Mensagem enviada no grupo');

    await new Promise(r => setTimeout(r, 5000));

    const pendentes = await buscarPendentes(mes, ano);

    for (const p of pendentes) {
      await enviarCobrancaComPix(p);
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`✅ Cobranças enviadas para ${pendentes.length} participantes`);

  } catch (err) {
    console.error('❌ Erro na cobrança mensal:', err.message);
  }
}

async function enviarLembretePendentes() {
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();

  const pendentes = await buscarPendentes(mes, ano);

  for (const p of pendentes) {
    await enviarCobrancaComPix(p);
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function enviarResumoAdmin() {
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();

  const resumo = await resumoMensal(mes, ano);

  const msg =
    `📊 *Resumo da mensalidade*\n\n` +
    `✅ Pagos: ${resumo.pagos}\n` +
    `⏳ Pendentes: ${resumo.pendentes}\n` +
    `👥 Total: ${resumo.total}\n\n` +
    `💰 Arrecadado: R$ ${(resumo.pagos * parseFloat(process.env.VALOR_MENSAL)).toFixed(2)}`;

  await enviarMensagem(process.env.ADMIN_NUMERO, msg);
}

function registrarJobs() {
  cron.schedule('0 9 1 * *', executarCobrancaMensal, { timezone: 'America/Sao_Paulo' });
  cron.schedule('0 10 10 * *', enviarLembretePendentes, { timezone: 'America/Sao_Paulo' });
  cron.schedule('0 10 25 * *', enviarLembretePendentes, { timezone: 'America/Sao_Paulo' });
  cron.schedule('0 8 1 * *', enviarResumoAdmin, { timezone: 'America/Sao_Paulo' });

  console.log('⏰ Jobs agendados: cobrança dia 1, lembretes dias 10 e 25');
}

module.exports = { registrarJobs, executarCobrancaMensal };
