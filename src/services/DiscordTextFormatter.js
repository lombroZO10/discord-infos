const XAT_SMILES = new Map([
    ["cd", "💿"],
    ["smile", "🙂"],
    ["laugh", "😂"],
    ["wink", "😉"],
    ["tongue", "😛"],
    ["cool", "😎"],
    ["cry", "😢"],
    ["mad", "😠"],
    ["love", "😍"],
    ["heart", "❤️"],
    ["thumbsup", "👍"],
    ["thumbsdown", "👎"],
    ["party", "🥳"],
    ["star", "⭐"],
    ["music", "🎵"],
    ["coffee", "☕"],
    ["gift", "🎁"],
]);

const EMOTICONS = [
    [/(^|\s):-?\)(?=$|\s|[!?.,])/g, "$1🙂"],
    [/(^|\s):-?\((?=$|\s|[!?.,])/g, "$1🙁"],
    [/(^|\s);-?\)(?=$|\s|[!?.,])/g, "$1😉"],
    [/(^|\s):-?[dD](?=$|\s|[!?.,])/g, "$1😄"],
    [/(^|\s):-?[pP](?=$|\s|[!?.,])/g, "$1😛"],
    [/(^|\s)[xX][dD](?=$|\s|[!?.,])/g, "$1😆"],
    [/(^|\s)<3(?=$|\s|[!?.,])/g, "$1❤️"],
];

export const formatXatTextForDiscord = (value) => {
    let text = String(value || "").replace(
        /\(([a-z][a-z0-9_+-]*)(?:#[^)]*)?\)/gi,
        (original, code) => XAT_SMILES.get(code.toLocaleLowerCase()) || original
    );
    for (const [pattern, replacement] of EMOTICONS) {
        text = text.replace(pattern, replacement);
    }
    return text;
};

/**
 * Splits the reply notation emitted by the xat HTML5 client:
 * ❯#reference[quoted message] reply text
 */
export const parseXatReply = (value) => {
    const text = String(value || "").trim();
    const match = text.match(/^❯#([a-z0-9]+)\[/i);
    if (!match) return null;

    const quoteStart = match[0].length;
    const quoteEnd = text.indexOf("]", quoteStart);
    if (quoteEnd < quoteStart) return null;

    const quotedText = text.slice(quoteStart, quoteEnd).trim();
    if (!quotedText) return null;

    return {
        referenceId: match[1],
        quotedText,
        replyText: text.slice(quoteEnd + 1).trim(),
    };
};
