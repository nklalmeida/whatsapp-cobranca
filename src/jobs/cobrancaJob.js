const cron = require('node-cron');
const { buscarPendentes, sincronizarParticipantes, resumoMensal } = require('../services/cobranca');
const { enviarMensagem, enviarMensagemGrupo, buscarParticipantesGrupo } = require('../services/whatsapp');

function mensagemCobrancaGrupo() {
  const mes = new Date().toLocaleString('pt-BR', { month: 'long' });
  return `📢 *Lembrete de mensalidade - ${mes}*\n\nOlá pessoal! 👋\n\nA mensalidade do grupo no valor de *R$ ${process.env.VALOR_MENSAL}* está disponível para pagamento.\n\n💰 *Chave PIX:* ${process.env.PIX_CHAVE}\n👤 *Favorecido:* ${process.env.PIX_NOME}\n💵 *Valor:* R$ ${process.env.VALOR_MENSAL}\n\nApós pagar, me envie o *comprovante aqui no privado* que confirmo automaticamente! ✅\n\nDúvidas? Chame o admin @${process.env.ADMIN_NUMERO} 😊`;
}

function mensagemCobrancaPrivado(nome) {
  const primeiroNome = nome?.split(' ')[0] || 'você';
  return `Olá, ${primeiroNome}! 👋\n\nPassando para lembrar da mensalidade do grupo:\n\n💰 *Chave PIX:* ${process.env.PIX_CHAVE}\n👤 *Favorecido:* ${process.env.PIX_NOME}\n💵 *Valor:* R$ ${process.env.VALOR_MENSAL}\n\nSó me enviar o comprovante aqui que confirmo na hora! 📸✅`;
}

async function executarCobrancaMensal() {
  console.log('🚀 Iniciando cobrança mensal...');
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();

  try {
    // Sincroniza lista de participantes do grupo
    const participantes = await buscarParticipantesGrupo();
    await sincronizarParticipantes(participantes);

    // Envia mensagem no grupo
    await enviarMensagemGrupo(mensagemCobrancaGrupo());
    console.log('✅ Mensagem enviada no grupo');

    // Espera 5 segundos antes de enviar privados
    await new Promise(r => setTimeout(r, 5000));

    // Envia mensagem privada para cada pendente
    const pendentes = await buscarPendentes(mes, ano);
    for (const p of pendentes) {
      try {
        await enviarMensagem(p.numero, mensagemCobrancaPrivado(p.nome));
        await new Promise(r => setTimeout(r, 1500)); // delay entre mensagens
      } catch (err) {
        console.error(`❌ Erro ao enviar para ${p.numero}:`, err.message);
      }
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
    const msg = `⏰ *Lembrete:* Sua mensalidade de *R$ ${process.env.VALOR_MENSAL}* ainda está pendente!\n\nPIX: ${process.env.PIX_CHAVE}\n\nEnvie o comprovante aqui quando pagar! 😊`;
    await enviarMensagem(p.numero, msg).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
  }
}

async function enviarResumoAdmin() {
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();
  const resumo = await resumoMensal(mes, ano);

  const msg = `📊 *Resumo da mensalidade*\n\n✅ Pagos: ${resumo.pagos}\n⏳ Pendentes: ${resumo.pendentes}\n👥 Total: ${resumo.total}\n\n💰 Arrecadado: R$ ${(resumo.pagos * parseFloat(process.env.VALOR_MENSAL)).toFixed(2)}`;
  await enviarMensagem(process.env.ADMIN_NUMERO, msg);
}

function registrarJobs() {
  // Cobrança no dia 1 de cada mês às 9h
  cron.schedule('0 9 1 * *', executarCobrancaMensal, { timezone: 'America/Sao_Paulo' });

  // Lembrete no dia 10 às 10h para quem não pagou
  cron.schedule('0 10 10 * *', enviarLembretePendentes, { timezone: 'America/Sao_Paulo' });

  // Lembrete final no dia 25 às 10h
  cron.schedule('0 10 25 * *', enviarLembretePendentes, { timezone: 'America/Sao_Paulo' });

  // Resumo para o admin todo dia 1 às 8h
  cron.schedule('0 8 1 * *', enviarResumoAdmin, { timezone: 'America/Sao_Paulo' });

  console.log('⏰ Jobs agendados: cobrança dia 1, lembretes dias 10 e 25');
}

module.exports = { registrarJobs, executarCobrancaMensal };
