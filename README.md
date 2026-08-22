# Free xat Bot

Bot de moderação para salas do xat, desenvolvido em Node.js.

Esta versão não possui comandos e não envia mensagens automáticas, mensagens públicas, PMs ou PCs. O bot continua mantendo a conexão, a presença, o cache de usuários e os filtros automáticos de moderação.

## Recursos mantidos

- Filtros de moderação configurados no banco SQLite
- Moderação opcional via OpenAI
- Rastreamento de entrada e saída de usuários
- Reconexão e tratamento de erros
- Ping e keepalive da conexão
- WebSocket compatível com o serviço de bots do xat

## Requisitos

- Node.js 18 ou superior
- Conta xat com acesso por API
- Rank de bot na sala de destino

## Instalação

```bash
npm install
```

Copie `.env.example` para `.env` e preencha:

```env
BOT_USER=your_xat_username
BOT_APIKEY=your_xat_api_key
BOT_CHAT=your_chat_name
CHAT_LANGUAGE=all
DISABLED_POWERS=[29]
WEBSOCKET_URL=wss://bots.xat.com/v2
WEBSOCKET_ORIGIN=https://xat.com
OPENAI_KEY=""
```

## Execução

```bash
npm start
```

## Comportamento sem mensagens e comandos

- Mensagens iniciadas por `!` ou qualquer outro caractere são tratadas como mensagens comuns; nenhum comando é executado.
- Mensagens públicas, PMs e PCs recebidos não geram respostas do bot.
- Entradas de usuários não geram mensagens de boas-vindas.
- Pacotes internos de autenticação, presença, ping e keepalive continuam ativos porque fazem parte da conexão, não são mensagens enviadas aos usuários.

## Configuração da moderação

As opções de moderação continuam armazenadas na tabela `settings` do arquivo `database.db`. Como não existem comandos nesta versão, alterações nessas opções devem ser feitas diretamente no banco ou por uma futura interface administrativa.

## Segurança

- Nunca compartilhe o arquivo `.env` nem as credenciais da conta.
- Não versione `database.db`, logs ou o cache da sessão.
- Mantenha as dependências atualizadas.

## Licença

MIT License — consulte [LICENSE](LICENSE).
