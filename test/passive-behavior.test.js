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

test("a former command is treated as an ordinary public message", async () => {
    const moderated = [];
    const relayed = [];
    const bot = {
        state: {
            settings: { modFilters: true },
            getUser: () => ({
                getNick: () => "Visitor",
                getRegname: () => "visitor",
            }),
        },
        discordBridge: {
            relayXatMessage: (message) => relayed.push(message),
        },
        moderationFilters: async (userId, message) => {
            moderated.push([userId, message]);
        },
    };

    await MessageHandler.execute(bot, { u: "123", t: "!ping" });

    assert.deepEqual(moderated, [[123, "!ping"]]);
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
    assert.match(privateMessages[0].embeds[0].toJSON().fields[0].value, /Nog/);
    assert.deepEqual(privateMessages[0].allowedMentions, { parse: [] });
    assert.equal(privateMessages[0].files[0].name, "realeza-logo.png");
    assert.match(privateMessages[1].embeds[0].toJSON().fields[0].value, /Second/);
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

    assert.deepEqual(keywordMatch.keywords, ["Sim"]);
    assert.equal(noPartialMatch.matched, false);
    assert.deepEqual(nicknameMatch.nicknames, ["SeiLahNick"]);

    const reloaded = new DiscordMonitorStore(file);
    await reloaded.load();
    assert.deepEqual(reloaded.snapshot().keywords, ["Sim", "OFERTA"]);
    assert.deepEqual(reloaded.snapshot().nicknames, ["SeiLahNick"]);
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
        text: "Sim, mensagem monitorada",
    }), true);

    assert.equal(publicMessages.length, 0);
    assert.equal(privateMessages.length, 1);
    const alert = privateMessages[0].embeds[0].toJSON();
    assert.match(alert.title, /Atividade monitorada/);
    assert.match(alert.description, /mensagem monitorada/);
    assert.equal(alert.thumbnail.url, "attachment://realeza-logo.png");
    assert.match(alert.fields[1].value, /Sim/);
    assert.match(alert.fields[1].value, /SeiLahNick/);
    assert.deepEqual(privateMessages[0].allowedMentions, { parse: [] });
});

test("an invalid owner ID disables alerts while leaving the Discord client isolated", async () => {
    const publicMessages = [];
    const errors = [];
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
            setPresence() {},
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
});

test("the Discord control panel is persistent and restricted to the owner", async () => {
    const state = {
        panelMessageId: null,
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
    assert.equal(panelPayloads[0].files[0].name, "realeza-logo.png");
    assert.equal(panel.payload().files, undefined);

    await panel.handleInteraction({
        customId: "xat-monitor:keywords",
        user: { id: "unauthorized" },
        reply: async (payload) => replies.push(payload),
    });
    assert.equal(replies.length, 1);

    await panel.handleInteraction({
        customId: "xat-monitor:keywords",
        user: { id: "123" },
        isButton: () => true,
        showModal: async (modal) => modals.push(modal.toJSON()),
    });
    assert.equal(modals[0].custom_id, "xat-monitor:keywords-modal");

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
