import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
    DEFAULT_DISCORD_COLOR,
    normalizeDiscordColor,
    storedDiscordColor,
} from "./DiscordColor.js";

const MAX_ENTRIES = 40;
const MAX_ENTRY_LENGTH = 80;

const normalize = (value) => String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}|\p{Cf}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();

const normalizeNickname = (value) => normalize(
    String(value || "")
        .replace(/\([^)]*\)/g, "")
        .split("##", 1)[0]
        .split("#", 1)[0]
);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cleanEntries = (input) => {
    const values = Array.isArray(input)
        ? input
        : String(input || "").split(/[\n,]+/);
    const unique = new Map();

    for (const rawValue of values) {
        const value = String(rawValue || "")
            .normalize("NFKC")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, MAX_ENTRY_LENGTH);
        const key = normalize(value);
        if (key && !unique.has(key)) unique.set(key, value);
        if (unique.size >= MAX_ENTRIES) break;
    }

    return [...unique.values()];
};

export class DiscordMonitorStore {
    constructor(file = "./data/discord-monitor.json") {
        this.file = resolve(file);
        this.data = {
            version: 3,
            panelMessageId: null,
            color: DEFAULT_DISCORD_COLOR,
            keywords: [],
            nicknames: [],
        };
        this.writeQueue = Promise.resolve();
    }

    async load() {
        try {
            const stored = JSON.parse(await readFile(this.file, "utf8"));
            this.data = {
                version: 3,
                panelMessageId: typeof stored.panelMessageId === "string"
                    ? stored.panelMessageId
                    : null,
                color: storedDiscordColor(stored),
                keywords: cleanEntries(stored.keywords),
                nicknames: cleanEntries(stored.nicknames),
            };
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }

        return this.snapshot();
    }

    snapshot() {
        return {
            panelMessageId: this.data.panelMessageId,
            color: this.data.color,
            keywords: [...this.data.keywords],
            nicknames: [...this.data.nicknames],
        };
    }

    async replace(type, input) {
        if (!new Set(["keywords", "nicknames"]).has(type)) {
            throw new Error("Tipo de monitoramento inválido.");
        }

        this.data[type] = cleanEntries(input);
        await this.persist();
        return [...this.data[type]];
    }

    async setPanelMessageId(messageId) {
        this.data.panelMessageId = messageId;
        await this.persist();
    }

    async setColor(color) {
        const normalized = normalizeDiscordColor(color);
        if (!normalized) throw new Error("Use uma cor hexadecimal como #7F05F5.");
        this.data.color = normalized;
        await this.persist();
        return normalized;
    }

    match(message) {
        const text = normalize(message.text);
        const names = new Set([
            normalizeNickname(message.nickname),
            normalizeNickname(message.regname),
        ].filter(Boolean));

        const keywords = this.data.keywords.filter((keyword) => {
            const normalizedKeyword = normalize(keyword);
            if (!normalizedKeyword || !text) return false;
            const pattern = new RegExp(
                `(^|[^\\p{L}\\p{N}_])${escapeRegExp(normalizedKeyword)}(?=$|[^\\p{L}\\p{N}_])`,
                "iu"
            );
            return pattern.test(text);
        });
        const nicknames = this.data.nicknames.filter((nickname) => (
            names.has(normalizeNickname(nickname))
        ));

        return {
            matched: keywords.length > 0 || nicknames.length > 0,
            keywords,
            nicknames,
        };
    }

    persist() {
        this.writeQueue = this.writeQueue.then(async () => {
            await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
            const temporaryFile = `${this.file}.${process.pid}.tmp`;
            await writeFile(
                temporaryFile,
                `${JSON.stringify(this.data, null, 2)}\n`,
                { encoding: "utf8", mode: 0o600 }
            );
            await rename(temporaryFile, this.file);
        });

        return this.writeQueue;
    }
}
