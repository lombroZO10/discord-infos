export const DISCORD_THEMES = Object.freeze({
    realeza: {
        label: "Realeza",
        emoji: "👑",
        color: 0xC0C0C0,
        description: "Prata imperial",
    },
    ouro: {
        label: "Ouro",
        emoji: "✨",
        color: 0xF1C40F,
        description: "Dourado premium",
    },
    esmeralda: {
        label: "Esmeralda",
        emoji: "💚",
        color: 0x00D4AA,
        description: "Verde sofisticado",
    },
    rubi: {
        label: "Rubi",
        emoji: "❤️",
        color: 0xED4245,
        description: "Vermelho intenso",
    },
    royal: {
        label: "Royal",
        emoji: "💜",
        color: 0x9B59B6,
        description: "Roxo majestoso",
    },
    gelo: {
        label: "Gelo",
        emoji: "💎",
        color: 0x3498DB,
        description: "Azul cristalino",
    },
});

export const DEFAULT_DISCORD_THEME = "realeza";

export const getDiscordTheme = (themeName) => (
    DISCORD_THEMES[themeName] || DISCORD_THEMES[DEFAULT_DISCORD_THEME]
);

export const isDiscordTheme = (themeName) => (
    Object.hasOwn(DISCORD_THEMES, themeName)
);
