const axios = require('axios');

const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const TOKEN = process.env.ZAPI_TOKEN;
const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

const api = axios.create({
  baseURL: `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}`,
  headers: {
    'Client-Token': CLIENT_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function enviarMensagem(numero, texto) {
  await api.post('/send-text', {
    phone: numero,
    message: texto
  });
}

async function enviarMensagemGrupo(texto) {
  await api.post('/send-text', {
    phone: process.env.GRUPO_ID,
    message: texto
  });
}

async function buscarParticipantesGrupo() {
  const { data } = await api.get(`/group-members/${process.env.GRUPO_ID}`);
  const lista = Array.isArray(data) ? data : data.members || data.participants || [];
  return lista
    .filter(p => !p.isAdmin)
    .map(p => ({ numero: p.phone, nome: p.name || p.phone }));
}

module.exports = { enviarMensagem, enviarMensagemGrupo, buscarParticipantesGrupo };
