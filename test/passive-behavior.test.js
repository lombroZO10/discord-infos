import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Handlers from "../src/handlers/_all.js";
import ChatConnectionHandler from "../src/handlers/ChatConnectionHandler.js";
import MessageHandler from "../src/handlers/MessageHandler.js";
import UserJoinedHandler from "../src/handlers/UserJoinedHandler.js";
import { DiscordBridge } from "../src/services/DiscordBridge.js";
import { DiscordControlPanel } from "../src/services/DiscordControlPanel.js";
import { DiscordMonitorStore } from "../src/services/DiscordMonitorStore.js";
import { DiscordOnlineCommand } from "../src/services/DiscordOnlineCommand.js";
import { DiscordStatusMonitor } from "../src/services/DiscordStatusMonitor.js";
import { formatXatTextForDiscord } from "../src/services/DiscordTextFormatter.js";
import { BotState } from "../src/services/state.js";

const createConnectedBot = (profile = {}) => {
    const sent = [];
    const bot = {
        state: {
            isLoggingIn: false,
            envData: {
                disabledPowers: [],
                ...profile,
            },
            loginInfo: {
                i: "123",
                k1: "session-key",
                n: "registered-name",
            },
            chatInfo: { id: "456" },
            settings: {
                nick: "DatabaseNick",
                status: "Available",
                avatar: "171",
                pcback: "",
                home: "https://xat.com/DatabaseHome",
                stealth: "disable",
            },
        },
        send: async (name, data) => sent.push([name, data]),
    };

    return { bot, sent };
};

test("private messages are not registered for processing", () => {
    assert.equal(Handlers.some((handler) => handler.name === "p"), false);
});

test("a former command is only treated as passive monitoring input", async () => {
    const relayed = [];
    const bot = {
        state: {
            getUser: () => ({
                getNick: () => "Visitor",
                getRegname: () => "visitor",
            }),
        },
        discordBridge: {
            relayXatMessage: (message) => relayed.push(message),
        },
    };

    await MessageHandler.execute(bot, { u: "123", t: "!ping" });

    assert.deepEqual(relayed, [{
        userId: "123",
        nickname: "Visitor",
        regname: "visitor",
        text: "!ping",
    }]);
});

test("system and slash-prefixed xat packets are not relayed", async () => {
    const relayed = [];
    const bot = {
        state: {
            settings: { modFilters: false },
            getUser: () => undefined,
        },
        discordBridge: {
            relayXatMessage: (message) => relayed.push(message),
        },
    };

    await MessageHandler.execute(bot, { u: "123", t: "system", s: "1" });
    await MessageHandler.execute(bot, { u: "123", t: "/internal" });

    assert.deepEqual(relayed, []);
});

test("joining updates the user cache without sending a welcome message", async () => {
    const users = new Map();
    const bot = {
        state: {
            addUser: (userId, user) => users.set(userId, user),
        },
        reply: () => {
            throw new Error("unexpected automatic message");
        },
    };

    await UserJoinedHandler.execute(bot, {
        u: "456",
        n: "Visitor",
    });

    assert.equal(users.get(456)?.getNick(), "Visitor");
});

test("the bot core exposes no chat-message sending helpers", async () => {
    const source = await readFile(new URL("../src/core/Bot.js", import.meta.url), "utf8");

    assert.doesNotMatch(source, /async\s+(?:reply|sendMessage|sendPM|sendPC)\s*\(/);
    assert.doesNotMatch(source, /this\.send\(["'](?:m|p)["']/);
});

test("the xat runtime exposes no commands, moderation or optional responses", async () => {
    const botSource = await readFile(new URL("../src/core/Bot.js", import.meta.url), "utf8");
    const messageSource = await readFile(
        new URL("../src/handlers/MessageHandler.js", import.meta.url),
        "utf8"
    );

    assert.doesNotMatch(botSource, /async\s+(?:kick|ban|moderationFilters)\s*\(/);
    assert.doesNotMatch(botSource, /t:\s*["']\/(?:k|g|aon)/);
    assert.doesNotMatch(messageSource, /moderationFilters/);
    assert.equal(Handlers.some((handler) => ["a", "z"].includes(handler.name)), false);
});

test("protocol logs do not include packet payloads or credentials", async () => {
    const botSource = await readFile(new URL("../src/core/Bot.js", import.meta.url), "utf8");
    const websocketSource = await readFile(
        new URL("../src/services/websocket.js", import.meta.url),
        "utf8"
    );

    assert.doesNotMatch(botSource, /logger\.info\(`>> \$\{packet\}`\)/);
    assert.doesNotMatch(websocketSource, /logger\.info\(`<< \$\{data\}`\)/);
});

test("the runtime has no OpenAI integration", async () => {
    const files = await Promise.all([
        readFile(new URL("../src/core/Bot.js", import.meta.url), "utf8"),
        readFile(new URL("../src/services/state.js", import.meta.url), "utf8"),
        readFile(new URL("../src/models/Settings.js", import.meta.url), "utf8"),
    ]);

    assert.doesNotMatch(files.join("\n"), /openai/i);
});

test("BOT_NICK overrides the nickname stored in SQLite", async () => {
    const { bot, sent } = createConnectedBot({ nick: "Nog" });

    await ChatConnectionHandler.execute(bot, { i: "connection-id", c: "callback" });

    assert.equal(sent[0][0], "j2");
    assert.equal(sent[0][1].n, "Nog##Available");
});

test("the SQLite nickname remains the fallback when BOT_NICK is empty", async () => {
    const { bot, sent } = createConnectedBot({ nick: null });

    await ChatConnectionHandler.execute(bot, { i: "connection-id", c: "callback" });

    assert.equal(sent[0][1].n, "DatabaseNick##Available");
});

test("BOT_AVATAR and BOT_HOME override the values stored in SQLite", async () => {
    const { bot, sent } = createConnectedBot({
        avatar: "175",
        home: "https://xat.com/Nog",
    });

    await ChatConnectionHandler.execute(bot, { i: "connection-id", c: "callback" });

    assert.equal(sent[0][1].a, "175#");
    assert.equal(sent[0][1].h, "https://xat.com/Nog");
});

test("an empty BOT_HOME removes the home link", async () => {
    const { bot, sent } = createConnectedBot({ home: "" });

    await ChatConnectionHandler.execute(bot, { i: "connection-id", c: "callback" });

    assert.equal(sent[0][1].h, "");
});

test("SQLite remains the fallback when avatar and home variables are absent", async () => {
    const { bot, sent } = createConnectedBot();

    await ChatConnectionHandler.execute(bot, { i: "connection-id", c: "callback" });

    assert.equal(sent[0][1].a, "171#");
    assert.equal(sent[0][1].h, "https://xat.com/DatabaseHome");
});

test("the Discord bridge sends matching messages only as safe private embeds in order", async () => {
    const publicMessages = [];
    const privateMessages = [];
    const logger = { info() {}, warn() {}, error() {} };
    const client = {
        on() {},
        destroy() {},
        users: {
            fetch: async () => ({
                send: async (payload) => privateMessages.push(payload),
            }),
        },
    };
    const store = {
        match: () => ({
            matched: true,
            keywords: ["alerta"],
            nicknames: [],
        }),
    };
    const bridge = new DiscordBridge({
        ownerId: "123456789012345678",
    }, logger, client, store);
    bridge.channel = {
        send: async (payload) => publicMessages.push(payload),
    };

    const first = bridge.relayXatMessage({
        userId: "123",
        nickname: "**Nog**",
        regname: "nog",
        text: `@everyone ${"x".repeat(2_100)}`,
    });
    const second = bridge.relayXatMessage({
        userId: "456",
        nickname: "Second",
        regname: "second",
        text: "message",
    });

    assert.equal(await first, true);
    assert.equal(await second, true);
    assert.equal(publicMessages.length, 0);
    assert.equal(privateMessages.length, 2);
    assert.ok(privateMessages[0].embeds[0].toJSON().description.length <= 4_096);
    assert.match(privateMessages[0].embeds[0].toJSON().title, /Nog/);
    assert.deepEqual(privateMessages[0].allowedMentions, { parse: [] });
    assert.equal(privateMessages[0].files[0].name, "realeza-logo.png");
    assert.match(privateMessages[1].embeds[0].toJSON().title, /Second/);
});

test("the Discord bridge ignores every xat message that does not match a rule", async () => {
    const sent = [];
    const bridge = new DiscordBridge({}, {
        info() {}, warn() {}, error() {},
    }, { on() {}, destroy() {} }, {
        match: () => ({ matched: false, keywords: [], nicknames: [] }),
    });
    bridge.channel = {
        send: async (payload) => sent.push(payload),
    };

    assert.equal(await bridge.relayXatMessage({
        userId: "123",
        nickname: "Pessoa",
        text: "conversa comum",
    }), false);
    assert.equal(sent.length, 0);
});

test("the Discord bridge can stay disabled without affecting the xat bot", async () => {
    const warnings = [];
    const logger = {
        info() {},
        warn: (message) => warnings.push(message),
        error() {},
    };
    const client = { on() {}, destroy() {} };
    const bridge = new DiscordBridge({
        token: null,
        channelId: null,
        activity: "xat.com",
    }, logger, client);

    assert.equal(await bridge.start(), false);
    assert.equal(await bridge.relayXatMessage({}), false);
    assert.equal(warnings.length, 1);
});

test("monitor settings persist and match whole keywords and normalized nicks", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "xat-monitor-"));
    const file = join(directory, "monitor.json");
    t.after(() => rm(directory, { recursive: true, force: true }));

    const store = new DiscordMonitorStore(file);
    await store.load();
    await store.replace("keywords", "Sim\nOFERTA\nsim");
    await store.replace("nicknames", "SeiLahNick");
    await store.setColor("#7f05f5");

    const keywordMatch = store.match({
        text: "Ele disse SIM!",
        nickname: "OutroNick",
        regname: "outro",
    });
    const noPartialMatch = store.match({
        text: "Uma coisa simples",
        nickname: "OutroNick",
        regname: "outro",
    });
    const nicknameMatch = store.match({
        text: "Mensagem comum",
        nickname: "SeiLahNick#r",
        regname: "registro",
    });
    const styledNicknameMatch = store.match({
        text: "Mensagem com fonte diferente",
        nickname: "ＳｅｉＬａｈＮｉｃｋ#r",
        regname: "registro",
    });

    assert.deepEqual(keywordMatch.keywords, ["Sim"]);
    assert.equal(noPartialMatch.matched, false);
    assert.deepEqual(nicknameMatch.nicknames, ["SeiLahNick"]);
    assert.deepEqual(styledNicknameMatch.nicknames, ["SeiLahNick"]);

    const reloaded = new DiscordMonitorStore(file);
    await reloaded.load();
    assert.deepEqual(reloaded.snapshot().keywords, ["Sim", "OFERTA"]);
    assert.deepEqual(reloaded.snapshot().nicknames, ["SeiLahNick"]);
    assert.equal(reloaded.snapshot().color, "#7F05F5");
});

test("known xat smile codes and emoticons become Discord-friendly emoji", () => {
    assert.equal(
        formatXatTextForDiscord("Olha o (cd) :) (heart) :D (desconhecido)"),
        "Olha o 💿 🙂 ❤️ 😄 (desconhecido)"
    );
});

test("the online snapshot excludes the bot and exposes no mutable user objects", () => {
    const state = Object.create(BotState.prototype);
    state.loginInfo = { i: "999" };
    state.users = new Map([
        [123, { getNick: () => "Visitante", getRegname: () => "visitante" }],
        [999, { getNick: () => "Bot", getRegname: () => "bot" }],
    ]);

    assert.deepEqual(state.getOnlineUsers(), [{
        userId: "123",
        nickname: "Visitante",
        regname: "visitante",
    }]);
});

test("/onlines replies safely and deletes its list after exactly one minute", async () => {
    const replies = [];
    const created = [];
    const warnings = [];
    let deleteReplyCalls = 0;
    let scheduledCallback;
    let scheduledDelay;
    const command = new DiscordOnlineCommand({
        getUsers: () => [
            { userId: "2", nickname: "**Zulu**", regname: "zulu" },
            { userId: "1", nickname: "Alpha @everyone", regname: "alpha" },
        ],
        getColor: () => "#7F05F5",
        logger: { warn: (message) => warnings.push(message) },
        schedule: (callback, delay) => {
            scheduledCallback = callback;
            scheduledDelay = delay;
            return { unref() {} };
        },
    });

    assert.equal(await command.register({
        fetch: async () => new Map(),
        create: async (definition) => created.push(definition),
    }), true);
    assert.equal(created[0].name, "onlines");

    assert.equal(await command.handle({
        isChatInputCommand: () => true,
        commandName: "onlines",
        reply: async (payload) => replies.push(payload),
        deleteReply: async () => { deleteReplyCalls += 1; },
    }), true);

    const embed = replies[0].embeds[0].toJSON();
    assert.match(embed.title, /2/);
    assert.ok(embed.description.indexOf("Alpha") < embed.description.indexOf("Zulu"));
    assert.match(embed.description, /@everyone/);
    assert.deepEqual(replies[0].allowedMentions, { parse: [] });
    assert.equal(scheduledDelay, 60_000);
    scheduledCallback();
    await Promise.resolve();
    assert.equal(deleteReplyCalls, 1);
    assert.equal(warnings.length, 0);
});

test("a monitored xat message is alerted privately without appearing in the channel", async () => {
    const publicMessages = [];
    const privateMessages = [];
    const logger = { info() {}, warn() {}, error() {} };
    const client = {
        on() {},
        destroy() {},
        users: {
            fetch: async () => ({
                send: async (payload) => privateMessages.push(payload),
            }),
        },
    };
    const store = {
        match: () => ({
            matched: true,
            keywords: ["Sim"],
            nicknames: ["SeiLahNick"],
        }),
    };
    const bridge = new DiscordBridge({
        ownerId: "123456789012345678",
    }, logger, client, store);
    bridge.channel = {
        send: async (payload) => publicMessages.push(payload),
    };

    assert.equal(await bridge.relayXatMessage({
        userId: "123",
        nickname: "SeiLahNick",
        regname: "registro",
        text: "Sim, mensagem monitorada (cd) :)",
    }), true);

    assert.equal(publicMessages.length, 0);
    assert.equal(privateMessages.length, 1);
    const alert = privateMessages[0].embeds[0].toJSON();
    assert.match(alert.author.name, /REΛLEZA/);
    assert.match(alert.title, /SeiLahNick/);
    assert.match(alert.description, /mensagem monitorada/);
    assert.match(alert.description, /💿/);
    assert.match(alert.description, /🙂/);
    assert.equal(alert.thumbnail.url, "attachment://realeza-logo.png");
    assert.equal(alert.image, undefined);
    assert.equal(privateMessages[0].files.length, 1);
    assert.equal(alert.fields.length, 1);
    assert.equal(alert.fields[0].name, "🎯 Palavra citada");
    assert.match(alert.fields[0].value, /Sim/);
    assert.doesNotMatch(JSON.stringify(alert), /ID 123/);
    assert.deepEqual(privateMessages[0].allowedMentions, { parse: [] });

    assert.equal(await bridge.sendAlert({
        userId: "456",
        nickname: "AlvoMonitorado",
        text: "Mensagem sem palavra-chave",
    }, {
        matched: true,
        keywords: [],
        nicknames: ["AlvoMonitorado"],
    }), true);
    const nicknameAlert = privateMessages[1].embeds[0].toJSON();
    assert.equal(nicknameAlert.fields[0].name, "🎯 Gatilho");
    assert.match(nicknameAlert.fields[0].value, /Nick monitorado/);
});

test("an invalid owner ID disables alerts while leaving the Discord client isolated", async () => {
    const publicMessages = [];
    const errors = [];
    const presences = [];
    let readyHandler;
    const client = {
        on() {},
        once: (_event, handler) => { readyHandler = handler; },
        login: async () => { readyHandler(); },
        destroy() {},
        channels: {
            fetch: async () => ({
                isSendable: () => true,
                send: async (payload) => publicMessages.push(payload),
            }),
        },
        users: {
            fetch: async () => { throw new Error("should not fetch owner"); },
        },
        user: {
            tag: "Bridge#0001",
            setPresence: (presence) => presences.push(presence),
        },
    };
    const store = {
        load: async () => {},
        match: () => ({
            matched: true,
            keywords: ["Sim"],
            nicknames: [],
        }),
    };
    const bridge = new DiscordBridge({
        token: "test-token",
        channelId: "1222348975726657547",
        ownerId: "invalid",
        activity: "xat.com",
    }, {
        info() {},
        warn() {},
        error: (message) => errors.push(message),
    }, client, store);

    assert.equal(await bridge.start(), true);
    assert.equal(await bridge.relayXatMessage({
        userId: "123",
        nickname: "Pessoa",
        text: "Sim",
    }), false);

    assert.equal(bridge.config.ownerId, null);
    assert.equal(publicMessages.length, 0);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /DISCORD_OWNER_ID inválido/);
    assert.ok([
        "o império crescer",
        "as oportunidades surgirem",
        "o dinheiro trabalhar",
    ].includes(presences[0].activities[0].name));
    bridge.stop();
});

test("the operational channel keeps a live dashboard and separate xat events", async () => {
    const messages = [];
    const edits = [];
    const dashboardMessage = {
        edit: async (payload) => edits.push(payload),
    };
    const channel = {
        send: async (payload) => {
            messages.push(payload);
            return messages.length === 1 ? dashboardMessage : { id: String(messages.length) };
        },
    };
    const monitor = new DiscordStatusMonitor({
        logger: { error() {} },
        chatName: "rhb",
        heartbeatMs: 3_600_000,
    });

    await monitor.setXat("connecting", "Preparando conexão.");
    await monitor.attach(channel, "Bridge#0001");
    await monitor.setXat("reconnecting", "Sessão renovada.");
    await monitor.setXat("connected", "Sala pronta.");
    monitor.touchXat();

    assert.equal(messages.length, 5);
    assert.ok(edits.length >= 4);
    assert.match(messages[0].embeds[0].toJSON().title, /Monitorando conexões/);
    assert.match(messages[1].embeds[0].toJSON().title, /Monitoramento iniciado/);
    assert.match(messages[3].embeds[0].toJSON().title, /Reconectando/);

    const latestDashboard = edits.at(-1).embeds[0].toJSON();
    assert.equal(latestDashboard.fields.find((field) => field.name === "Reconexões xat").value, "1");
    assert.match(latestDashboard.fields.find((field) => field.name === "xat").value, /Conectado/);
    assert.match(
        latestDashboard.fields.find((field) => field.name === "Último sinal xat").value,
        /<t:\d+:R>/
    );
    assert.deepEqual(messages[4].allowedMentions, { parse: [] });
    monitor.stop();
});

test("the Discord control panel is persistent and restricted to the owner", async () => {
    const state = {
        panelMessageId: null,
        color: "#7F05F5",
        keywords: ["Sim"],
        nicknames: ["SeiLahNick"],
    };
    const edits = [];
    const panelPayloads = [];
    const replies = [];
    const modals = [];
    const store = {
        snapshot: () => ({
            panelMessageId: state.panelMessageId,
            color: state.color,
            keywords: [...state.keywords],
            nicknames: [...state.nicknames],
        }),
        setPanelMessageId: async (id) => {
            state.panelMessageId = id;
        },
        replace: async (type, value) => {
            state[type] = value ? value.split("\n") : [];
            return state[type];
        },
        setColor: async (color) => {
            state.color = color.toUpperCase();
            return state.color;
        },
    };
    const message = {
        id: "999",
        edit: async (payload) => edits.push(payload),
    };
    const channel = {
        messages: { fetch: async () => { throw new Error("missing"); } },
        send: async (payload) => {
            panelPayloads.push(payload);
            return message;
        },
    };
    const panel = new DiscordControlPanel({
        client: {},
        channel,
        ownerId: "123",
        store,
        logger: { warn() {}, error() {}, info() {} },
    });

    await panel.start();
    assert.equal(state.panelMessageId, "999");
    const keywordField = panel.payload().embeds[0].toJSON().fields
        .find((field) => field.name.includes("PALAVRAS-CHAVE"));
    assert.match(keywordField.value, /Sim/);
    assert.equal(
        panel.payload().embeds[0].toJSON().thumbnail.url,
        "attachment://realeza-logo.png"
    );
    assert.equal(
        panel.payload().embeds[0].toJSON().image.url,
        "attachment://realeza-banner.png"
    );
    assert.equal(panelPayloads[0].files[0].name, "realeza-logo.png");
    assert.equal(panelPayloads[0].files[1].name, "realeza-banner.png");
    assert.equal(panel.payload().files, undefined);
    assert.equal(panel.payload().components.length, 1);

    await panel.handleInteraction({
        customId: "xat-monitor:color",
        user: { id: "123" },
        isButton: () => true,
        showModal: async (modal) => modals.push(modal.toJSON()),
    });
    assert.equal(modals[0].custom_id, "xat-monitor:color-modal");

    await panel.handleInteraction({
        customId: "xat-monitor:color-modal",
        user: { id: "123" },
        isButton: () => false,
        isModalSubmit: () => true,
        fields: { getTextInputValue: () => "#7f05f5" },
        deferReply: async () => {},
        editReply: async (content) => replies.push(content),
    });
    assert.equal(state.color, "#7F05F5");
    assert.equal(panel.payload().embeds[0].toJSON().color, 0x7F05F5);

    await panel.handleInteraction({
        customId: "xat-monitor:keywords",
        user: { id: "unauthorized" },
        reply: async (payload) => replies.push(payload),
    });
    assert.equal(replies.length, 2);

    await panel.handleInteraction({
        customId: "xat-monitor:keywords",
        user: { id: "123" },
        isButton: () => true,
        showModal: async (modal) => modals.push(modal.toJSON()),
    });
    assert.equal(modals[1].custom_id, "xat-monitor:keywords-modal");

    await panel.handleInteraction({
        customId: "xat-monitor:nicknames-modal",
        user: { id: "123" },
        isButton: () => false,
        isModalSubmit: () => true,
        fields: { getTextInputValue: () => "NovoNick" },
        deferReply: async () => {},
        editReply: async (content) => replies.push(content),
    });
    assert.deepEqual(state.nicknames, ["NovoNick"]);
    assert.ok(edits.length >= 1);
});
