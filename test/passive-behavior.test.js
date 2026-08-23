import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import Handlers from "../src/handlers/_all.js";
import ChatConnectionHandler from "../src/handlers/ChatConnectionHandler.js";
import MessageHandler from "../src/handlers/MessageHandler.js";
import UserJoinedHandler from "../src/handlers/UserJoinedHandler.js";

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
    const bot = {
        state: {
            settings: { modFilters: true },
        },
        moderationFilters: async (userId, message) => {
            moderated.push([userId, message]);
        },
    };

    await MessageHandler.execute(bot, { u: "123", t: "!ping" });

    assert.deepEqual(moderated, [[123, "!ping"]]);
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
