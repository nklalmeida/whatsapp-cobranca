# 🤖 Agente de Cobrança WhatsApp

Agente que cobra mensalidade automaticamente em grupos WhatsApp, valida comprovantes PIX com IA (Claude Vision) e confirma pagamentos automaticamente.

## Como funciona

1. Todo dia 1 do mês o agente envia cobrança no grupo e privado para cada participante
2. O participante paga o PIX e envia a foto do comprovante no privado
3. Claude Vision analisa a imagem e valida o valor, data e chave PIX
4. O agente confirma ou rejeita automaticamente e atualiza o banco

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- Conta no Railway (grátis)
- Chave de API da Anthropic

## Instalação local

### 1. Clone e instale dependências

```bash
git clone https://github.com/seu-usuario/whatsapp-cobranca
cd whatsapp-cobranca
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com seus dados:
- `EVOLUTION_API_KEY` — qualquer string segura (você define)
- `GRUPO_ID` — ID do grupo WhatsApp (veja abaixo como obter)
- `ADMIN_NUMERO` — seu número sem `+` e sem espaços (ex: `5544999999999`)
- `VALOR_MENSAL` — valor da mensalidade (ex: `50.00`)
- `PIX_CHAVE` — sua chave PIX
- `PIX_NOME` — nome que aparece no PIX
- `ANTHROPIC_API_KEY` — chave da API da Anthropic

### 3. Suba os containers

```bash
cd docker
docker-compose up -d
```

### 4. Configure a Evolution API

Acesse `http://localhost:8080` e:

1. Crie uma instância com o nome do `.env` (`EVOLUTION_INSTANCE`)
2. Escaneie o QR code com seu WhatsApp
3. Configure o webhook apontando para `http://app:3000/webhook`
4. Ative o evento `messages.upsert`

### 5. Obtenha o ID do grupo

Use a rota da Evolution API:
```
GET http://localhost:8080/group/fetchAllGroups/{instancia}?getParticipants=false
```
Copie o `id` do grupo desejado e coloque em `GRUPO_ID` no `.env`.

### 6. Inicie o backend

```bash
npm start
```

## Deploy no Railway (produção grátis)

1. Crie uma conta em [railway.app](https://railway.app)
2. Novo projeto → Deploy from GitHub
3. Adicione um banco PostgreSQL no projeto
4. Configure todas as variáveis de ambiente no painel
5. A Evolution API precisa de um serviço separado com a imagem Docker `atendai/evolution-api:latest`
6. Aponte o webhook da Evolution para a URL gerada pelo Railway

## Comandos úteis

### Disparar cobrança manualmente (sem esperar o cron)
```bash
curl -X POST http://localhost:3000/cobrar-agora
```

### Verificar saúde do serviço
```bash
curl http://localhost:3000/health
```

## Estrutura do projeto

```
src/
├── index.js              # Entrada da aplicação
├── db/
│   └── index.js          # Conexão PostgreSQL e schema
├── routes/
│   └── webhook.js        # Recebe eventos do WhatsApp
├── services/
│   ├── whatsapp.js       # Integração Evolution API
│   ├── claudeVision.js   # Validação de comprovantes com IA
│   └── cobranca.js       # Lógica de pagamentos
└── jobs/
    └── cobrancaJob.js    # Agendamento (cron)
```

## Agendamento de cobranças

| Data | Ação |
|------|------|
| Dia 1 às 8h | Resumo para o admin |
| Dia 1 às 9h | Cobrança no grupo + privado |
| Dia 10 às 10h | Lembrete para quem não pagou |
| Dia 25 às 10h | Lembrete final |

## Segurança

- O Claude Vision detecta comprovantes adulterados ou falsos
- Comprovantes suspeitos são sinalizados ao admin
- Cada participante só pode ter um status por mês
- API key da Evolution protege o endpoint de webhook

## Limitações

- A validação por imagem é muito boa mas não 100% infalível
- WhatsApp pode banir números que enviam muitas mensagens em sequência — o sistema já tem delays entre envios
- Para grupos grandes (+100 pessoas), considere usar webhook de pagamento bancário no lugar da validação por imagem
