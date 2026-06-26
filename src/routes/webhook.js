const express = require('express');
const router = express.Router();
const { registrarPagamento, jaEnviouComprovante, buscarPendentesComNome, resumoMensal } = require('../services/cobranca');
const { enviarMensagem, enviarMensagemGrupo } = require('../services/whatsapp');

// Webhook Z-API recebe mensagens
router.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  console.log('📩 Webhook recebido:', JSON.stringify(req.body));
  const body = req.body;

  // Z-API envia isStatusReply para mensagens de status — ignora
  if (body.isStatusReply) return;
  console.log('👤 Remetente:', remetente, '| Admin:', isAdmin, '| Texto:', texto);

  const numero = body.phone?.replace(/\D/g, '');
  const isGrupo = body.isGroupMsg || false;
  const remetente = isGrupo ? body.author?.replace(/\D/g, '') : numero;

  if (!remetente) return;

  const isAdmin = remetente === process.env.ADMIN_NUMERO;
  const texto = body.text?.message || '';
  const temImagem = body.type === 'ReceivedCallback' && (body.image || body.document);

  // Admin enviou comando
  if (isAdmin && !isGrupo && texto) {
    await tratarComandoAdmin(texto);
    return;
  }

  // Participante enviou imagem no privado
  if (temImagem && !isGrupo) {
    await tratarComprovante(remetente, body);
    return;
  }

  // Participante enviou texto no privado
  if (texto && !isGrupo && !isAdmin) {
    await tratarMensagemTexto(remetente, texto);
  }
});

async function tratarComprovante(numero, body) {
  const statusAtual = await jaEnviouComprovante(numero);

  if (statusAtual === 'confirmado') {
    await enviarMensagem(numero, '✅ Você já está com o pagamento confirmado esse mês! Obrigado 😊');
    return;
  }

  if (statusAtual === 'aguardando') {
    await enviarMensagem(numero, '⏳ Seu comprovante já foi recebido e está aguardando confirmação do admin. Em breve você recebe a resposta!');
    return;
  }

  await registrarPagamento(numero, 'aguardando', 'comprovante enviado, aguardando confirmação manual');

  await enviarMensagem(numero, '📸 Recebi seu comprovante! Vou encaminhar para o admin confirmar.\n\nAssim que confirmado você recebe uma mensagem aqui. 😊');

  const nome = body.senderName || numero;
  const msgAdmin =
    `📥 *Novo comprovante recebido*\n\n` +
    `👤 Participante: ${nome}\n` +
    `📱 Número: ${numero}\n` +
    `💵 Mensalidade: R$ ${process.env.VALOR_MENSAL}\n\n` +
    `Para confirmar:\n✅ *ok ${numero}*\n\n` +
    `Para rejeitar:\n❌ *nok ${numero} motivo aqui*`;

  await enviarMensagem(process.env.ADMIN_NUMERO, msgAdmin);
}

async function tratarComandoAdmin(texto) {
  const lower = texto.trim().toLowerCase();

  if (lower.startsWith('ok ')) {
    const numero = lower.replace('ok ', '').trim();
    await registrarPagamento(numero, 'confirmado', 'confirmado pelo admin');
    await enviarMensagem(numero, `✅ *Pagamento confirmado!*\n\nSua mensalidade de R$ ${process.env.VALOR_MENSAL} foi confirmada. Obrigado! 🎉`);
    await enviarMensagem(process.env.ADMIN_NUMERO, `✅ Pagamento de ${numero} confirmado.`);
    return;
  }

  if (lower.startsWith('nok ')) {
    const partes = texto.trim().split(' ');
    const numero = partes[1];
    const motivo = partes.slice(2).join(' ') || 'comprovante não aprovado';
    await registrarPagamento(numero, 'rejeitado', motivo);
    await enviarMensagem(numero, `❌ *Comprovante não aprovado*\n\n${motivo}\n\nVerifique e envie o comprovante correto:\n💰 PIX: ${process.env.PIX_CHAVE}\n💵 Valor: R$ ${process.env.VALOR_MENSAL}`);
    await enviarMensagem(process.env.ADMIN_NUMERO, `❌ Pagamento de ${numero} rejeitado.`);
    return;
  }

  if (lower === 'pendentes') {
    const mes = new Date().getMonth() + 1;
    const ano = new Date().getFullYear();
    const lista = await buscarPendentesComNome(mes, ano);
    if (!lista.length) {
      await enviarMensagem(process.env.ADMIN_NUMERO, '✅ Todos pagaram esse mês!');
      return;
    }
    const linhas = lista.map((p, i) => `${i + 1}. ${p.nome || p.numero} (${p.numero})`).join('\n');
    await enviarMensagem(process.env.ADMIN_NUMERO, `⏳ *Pendentes este mês:*\n\n${linhas}`);
    return;
  }

  if (lower === 'aguardando') {
    const mes = new Date().getMonth() + 1;
    const ano = new Date().getFullYear();
    const lista = await buscarPendentesComNome(mes, ano, 'aguardando');
    if (!lista.length) {
      await enviarMensagem(process.env.ADMIN_NUMERO, '✅ Nenhum comprovante aguardando confirmação.');
      return;
    }
    const linhas = lista.map((p, i) => `${i + 1}. ${p.nome || p.numero} → ok ${p.numero}`).join('\n');
    await enviarMensagem(process.env.ADMIN_NUMERO, `📋 *Aguardando sua confirmação:*\n\n${linhas}`);
    return;
  }

  if (lower === 'resumo') {
    const mes = new Date().getMonth() + 1;
    const ano = new Date().getFullYear();
    const r = await resumoMensal(mes, ano);
    await enviarMensagem(process.env.ADMIN_NUMERO,
      `📊 *Resumo do mês*\n\n` +
      `✅ Confirmados: ${r.pagos}\n` +
      `⏳ Aguardando: ${r.aguardando || 0}\n` +
      `❌ Pendentes: ${r.pendentes}\n` +
      `👥 Total: ${r.total}\n\n` +
      `💰 Arrecadado: R$ ${(r.pagos * parseFloat(process.env.VALOR_MENSAL)).toFixed(2)}`
    );
    return;
  }

  if (lower === 'cobrar') {
    const { executarCobrancaMensal } = require('../jobs/cobrancaJob');
    executarCobrancaMensal();
    await enviarMensagem(process.env.ADMIN_NUMERO, '🚀 Cobrança iniciada!');
    return;
  }

  if (lower === 'ajuda') {
    await enviarMensagem(process.env.ADMIN_NUMERO,
      `🤖 *Comandos disponíveis:*\n\n` +
      `✅ *ok [número]* — confirmar pagamento\n` +
      `❌ *nok [número] [motivo]* — rejeitar\n` +
      `📋 *pendentes* — ver quem não pagou\n` +
      `⏳ *aguardando* — comprovantes pendentes\n` +
      `📊 *resumo* — resumo do mês\n` +
      `🚀 *cobrar* — disparar cobrança agora`
    );
  }
}

async function tratarMensagemTexto(numero, texto) {
  const lower = texto.toLowerCase();
  if (lower.includes('paguei') || lower.includes('comprovante') || lower.includes('enviei')) {
    await enviarMensagem(numero, `📸 Me envie a *foto do comprovante* aqui que encaminho para o admin confirmar!\n\nDados PIX:\n💰 Chave: ${process.env.PIX_CHAVE}\n👤 Favorecido: ${process.env.PIX_NOME}\n💵 Valor: R$ ${process.env.VALOR_MENSAL}`);
  } else if (lower.includes('pix') || lower.includes('valor') || lower.includes('quanto')) {
    await enviarMensagem(numero, `💰 *Dados para pagamento:*\n\nChave PIX: ${process.env.PIX_CHAVE}\nFavorecido: ${process.env.PIX_NOME}\nValor: R$ ${process.env.VALOR_MENSAL}\n\nApós pagar, me envie a foto do comprovante! 📸`);
  }
}

router.post('/cobrar-agora', async (req, res) => {
  const { executarCobrancaMensal } = require('../jobs/cobrancaJob');
  executarCobrancaMensal();
  res.json({ ok: true, mensagem: 'Cobrança iniciada em background' });
});

module.exports = router;
