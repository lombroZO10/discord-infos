# Free xat Bot

Bot de moderação para salas do xat, desenvolvido em Node.js.

Esta versão não possui comandos e não envia mensagens automáticas, mensagens públicas, PMs, PCs ou ações de moderação. O bot somente mantém a conexão, a presença, o cache temporário de usuários e o monitoramento para o Discord.

## Recursos mantidos

- Rastreamento de entrada e saída de usuários
- Monitoramento seletivo de mensagens públicas do xat no Discord
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
BOT_NICK=Bot
BOT_AVATAR=171
BOT_HOME=
CHAT_LANGUAGE=all
DISABLED_POWERS=[29]
WEBSOCKET_URL=wss://bots.xat.com/v2
WEBSOCKET_ORIGIN=https://xat.com
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=123456789012345678
DISCORD_OWNER_ID=123456789012345678
DISCORD_ACTIVITY=xat.com
DISCORD_CONFIG_FILE=./data/discord-monitor.json
```

Quando `BOT_NICK` ou `BOT_AVATAR` estiver preenchido, o valor correspondente define o nome ou avatar exibido pelo bot. Se uma dessas variáveis for omitida ou estiver vazia, o valor salvo no SQLite será usado como fallback.

`BOT_HOME` define o link da casinha. Uma variável presente e vazia (`BOT_HOME=`) remove o link; se ela for omitida do `.env`, o valor salvo no SQLite será mantido.

## Ponte xat para Discord

A integração é estritamente de mão única. O canal configurado mantém somente o painel de controle. Quando uma mensagem pública do xat corresponde a uma palavra-chave ou nick monitorado, o alerta é enviado exclusivamente ao privado de `DISCORD_OWNER_ID`. Mensagens que não acionam uma regra são ignoradas. O Discord não envia mensagens, comandos ou ações de volta ao xat.

Pacotes de sistema, texto vazio e mensagens internas iniciadas por `/` não são monitorados. As detecções seguem uma fila para preservar a ordem, são exibidas em embeds privados e não geram menções de usuários, cargos, `@here` ou `@everyone`.

O bot do Discord precisa conseguir visualizar o canal, enviar mensagens e ler o histórico de mensagens para recuperar o painel já publicado. Como ele não lê mensagens do Discord, o intent privilegiado **Message Content** não é necessário. Se o Discord estiver indisponível ou mal configurado, o bot do xat continua seu fluxo normal e registra o erro.

Ao conectar, o bot cria ou recupera no canal um painel com dois botões: **Configurar palavras** e **Configurar nicks**. Somente a conta definida em `DISCORD_OWNER_ID` pode usar os controles. Cada modal aceita um item por linha; enviar o campo vazio limpa aquela lista.

O botão **Cor principal** aceita uma cor hexadecimal, usando `#7F05F5` como padrão. A cor é salva e aplicada ao painel e aos alertas privados. A logo aparece nos dois; o banner é exibido somente no painel principal.

`DISCORD_ACTIVITY` aceita uma ou mais frases separadas por `|`, alternadas aleatoriamente a cada minuto. O valor antigo `xat.com` ativa automaticamente as três frases padrão desta versão.

Palavras-chave são comparadas como palavras ou frases completas, sem diferenciar maiúsculas e minúsculas. Nicks são comparados sem diferenciar maiúsculas e minúsculas e desconsideram formatação comum do xat. Quando houver correspondência, `DISCORD_OWNER_ID` recebe no privado um embed com usuário, motivo e mensagem. O estado fica em `DISCORD_CONFIG_FILE` e não é versionado.

Fontes Unicode decorativas, acentos combinados e caracteres invisíveis são normalizados durante a comparação dos nicks. Na mensagem privada, smiles conhecidos do xat, como `(cd)`, `(heart)`, `:)`, `:D` e `<3`, são convertidos para emojis do Discord; códigos desconhecidos são preservados.

## Execução

```bash
npm start
```

## Comportamento sem mensagens e comandos

- Mensagens iniciadas por `!` ou qualquer outro caractere são tratadas como mensagens comuns; nenhum comando é executado.
- Mensagens públicas, PMs e PCs recebidos não geram respostas do bot.
- Entradas de usuários não geram mensagens de boas-vindas.
- Pacotes internos de autenticação, presença, ping e keepalive continuam ativos porque fazem parte da conexão, não são mensagens enviadas aos usuários.

## Operação passiva no xat

O bot não responde tickles, presentes ou transferências e não executa kick, ban ou filtros de moderação. Os únicos pacotes enviados ao xat são técnicos e indispensáveis para autenticação, entrada na sala, ping, keepalive e reconexão. Esta versão também não integra nem envia conteúdo para a OpenAI.

## Segurança

- Nunca compartilhe o arquivo `.env` nem as credenciais da conta.
- Não versione `database.db`, logs ou o cache da sessão.
- Mantenha as dependências atualizadas.

## Licença

MIT License — consulte [LICENSE](LICENSE).
