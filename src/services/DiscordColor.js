export const DEFAULT_DISCORD_COLOR = "#7F05F5";

export const normalizeDiscordColor = (value) => {
    const color = String(value || "").trim();
    const match = color.match(/^#?([0-9a-f]{6})$/i);
    return match ? `#${match[1].toUpperCase()}` : null;
};

export const discordColorValue = (value) => (
    Number.parseInt((normalizeDiscordColor(value) || DEFAULT_DISCORD_COLOR).slice(1), 16)
);

export const storedDiscordColor = (stored = {}) => (
    normalizeDiscordColor(stored.color)
    || DEFAULT_DISCORD_COLOR
);
