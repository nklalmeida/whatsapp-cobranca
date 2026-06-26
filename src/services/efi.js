const https = require('https');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const EFI_CLIENT_ID = process.env.EFI_CLIENT_ID;
const EFI_CLIENT_SECRET = process.env.EFI_CLIENT_SECRET;
const EFI_SANDBOX = process.env.EFI_SANDBOX !== 'false';
const EFI_PIX_CHAVE = process.env.PIX_CHAVE;

const BASE_URL = EFI_SANDBOX
  ? 'https://pix-h.api.efipay.com.br'
  : 'https://pix.api.efipay.com.br';

const CERT_PATH = path.join(__dirname, '../../certs/efi.p12');

function criarAgente() {
  const cert = fs.readFileSync(CERT_PATH);
  return new https.Agent({ pfx: cert, passphrase: '' });
}

async function obterToken() {
  try {
    const agent = criarAgente();
    const credentials = Buffer.from(`${EFI_CLIENT_ID}:${EFI_CLIENT_SECRET}`).toString('base64');

    const { data } = await axios.post(`${BASE_URL}/oauth/token`, {
      grant_type: 'client_credentials'
    }, {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: agent
    });

    return data.access_token;

  } catch (error) {
    console.error("Status:", error.response?.status);
    console.error("Resposta:", error.response?.data);
    console.error("Mensagem:", error.message);
    throw error;
  }
}

async function criarCobrancaPix(numero, nome, valor, txid) { const token = await obterToken(); const agent = criarAgente(); const { data } = await axios.put(${BASE_URL}/v2/cob/${txid}, { calendario: { expiracao: 86400 }, valor: { original: parseFloat(valor).toFixed(2) }, chave: EFI_PIX_CHAVE, solicitacaoPagador: Mensalidade - ${nome || numero} }, { headers: { Authorization: Bearer ${token}, 'Content-Type': 'application/json' }, httpsAgent: agent }); console.log("COBRANÇA COMPLETA:", data); console.log("LOC:", data?.loc); console.log("LOC ID:", data?.loc?.id); return data; }


async function gerarQrCode(cobranca) {
  const token = await obterToken();
  const agent = criarAgente();

  const locId = cobranca.loc.id;

  const { data } = await axios.get(`${BASE_URL}/v2/loc/${locId}/qrcode`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    httpsAgent: agent
  });

  return data;
}

async function configurarWebhook(urlWebhook) {
  const token = await obterToken();
  const agent = criarAgente();
  await axios.put(`${BASE_URL}/v2/webhook/${EFI_PIX_CHAVE}`, {
    webhookUrl: urlWebhook
  }, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    httpsAgent: agent
  });
}

module.exports = { criarCobrancaPix, gerarQrCode, configurarWebhook };
