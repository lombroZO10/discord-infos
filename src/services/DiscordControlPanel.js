import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    escapeMarkdown,
} from "discord.js";
import { fileURLToPath } from "node:url";

const LOGO_NAME = "realeza-logo.png";
const LOGO_PATH = fileURLToPath(new URL("../../assets/realeza-logo.png", import.meta.url));

const IDS = {
    keywordButton: "xat-monitor:keywords",
    nicknameButton: "xat-monitor:nicknames",
    keywordModal: "xat-monitor:keywords-modal",
    nicknameModal: "xat-monitor:nicknames-modal",
    input: "xat-monitor:entries",
};

const listEntries = (entries) => {
    if (entries.length === 0) return "```ansi\n\u001b[2;30mNenhum item configurado\u001b[0m\n```";
    const value = entries
        .map((entry, index) => `\`${String(index + 1).padStart(2, "0")}\`  ${escapeMarkdown(entry)}`)
        .join("\n");
    return value.slice(0, 1_024);
};

export class DiscordControlPanel {
    constructor({ client, channel, ownerId, store, logger }) {
        this.client = client;
        this.channel = channel;
        this.ownerId = ownerId;
        this.store = store;
        this.logger = logger;
        this.message = null;
        this.hasLogoAttachment = false;
    }

    async start() {
        const { panelMessageId } = this.store.snapshot();

        if (panelMessageId) {
            try {
                this.message = await this.channel.messages.fetch(panelMessageId);
                this.hasLogoAttachment = Boolean(
                    this.message.attachments?.find?.((attachment) => attachment.name === LOGO_NAME)
                );
            } catch {
                this.logger.warn("[discord] Painel anterior não foi encontrado; criando outro.");
            }
        }

        if (this.message) {
            const attachLogo = !this.hasLogoAttachment;
            const editedMessage = await this.message.edit(this.payload({
                attachLogo,
                replaceAttachments: attachLogo,
            }));
            if (editedMessage) this.message = editedMessage;
            this.hasLogoAttachment = true;
        } else {
            this.message = await this.channel.send(this.payload({ attachLogo: true }));
            this.hasLogoAttachment = true;
            await this.store.setPanelMessageId(this.message.id);
        }
    }

    async handleInteraction(interaction) {
        if (!interaction.customId?.startsWith("xat-monitor:")) return;

        if (interaction.user.id !== this.ownerId) {
            await interaction.reply({
                content: "Somente o responsável configurado pode usar este painel.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (interaction.isButton()) {
            const type = interaction.customId === IDS.keywordButton
                ? "keywords"
                : interaction.customId === IDS.nicknameButton
                    ? "nicknames"
                    : null;
            if (!type) return;
            await interaction.showModal(this.modal(type));
            return;
        }

        if (interaction.isModalSubmit()) {
            const type = interaction.customId === IDS.keywordModal
                ? "keywords"
                : interaction.customId === IDS.nicknameModal
                    ? "nicknames"
                    : null;
            if (!type) return;

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const value = interaction.fields.getTextInputValue(IDS.input);
            const entries = await this.store.replace(type, value);
            await this.refresh();
            await interaction.editReply(
                `✅ **${type === "keywords" ? "Palavras-chave" : "Nicks"} atualizados.** `
                + `${entries.length} ${entries.length === 1 ? "regra ativa" : "regras ativas"}.`
            );
        }
    }

    async refresh() {
        if (this.message) await this.message.edit(this.payload());
    }

    payload({ attachLogo = false, replaceAttachments = false } = {}) {
        const state = this.store.snapshot();
        const embed = new EmbedBuilder()
            .setColor(0x00D4AA)
            .setAuthor({ name: "XAT SENTINEL  •  SISTEMA DE INTELIGÊNCIA" })
            .setTitle("🛰️ Central de Monitoramento")
            .setThumbnail(`attachment://${LOGO_NAME}`)
            .setDescription(
                "**Controle exatamente o que merece sua atenção.**\n"
                + "O sistema ignora o restante da conversa e publica somente mensagens que "
                + "acionarem uma das regras abaixo. Cada detecção também gera um alerta privado."
            )
            .addFields(
                {
                    name: "◈ STATUS DO SISTEMA",
                    value: "```ansi\n\u001b[2;32m● ONLINE\u001b[0m  │  FILTRO SELETIVO ATIVO\n```",
                },
                {
                    name: `🔑 PALAVRAS-CHAVE  •  ${state.keywords.length} ATIVAS`,
                    value: listEntries(state.keywords),
                    inline: true,
                },
                {
                    name: `👤 NICKS MONITORADOS  •  ${state.nicknames.length} ATIVOS`,
                    value: listEntries(state.nicknames),
                    inline: true,
                },
                {
                    name: "🛡️ PROTEÇÃO",
                    value: "Sem menções automáticas • Sem comandos para o xat • Acesso exclusivo do responsável",
                }
            )
            .setFooter({ text: "XAT Sentinel • alterações aplicadas instantaneamente" })
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(IDS.keywordButton)
                .setLabel("Gerenciar palavras")
                .setEmoji("🔑")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(IDS.nicknameButton)
                .setLabel("Gerenciar nicks")
                .setEmoji("👤")
                .setStyle(ButtonStyle.Primary)
        );

        const payload = {
            embeds: [embed],
            components: [buttons],
            allowedMentions: { parse: [] },
        };
        if (attachLogo) {
            payload.files = [new AttachmentBuilder(LOGO_PATH).setName(LOGO_NAME)];
        }
        if (replaceAttachments) payload.attachments = [];
        return payload;
    }

    modal(type) {
        const isKeywords = type === "keywords";
        const entries = this.store.snapshot()[type].join("\n").slice(0, 4_000);
        const input = new TextInputBuilder()
            .setCustomId(IDS.input)
            .setLabel(isKeywords ? "Palavras-chave" : "Nicks")
            .setPlaceholder(
                isKeywords
                    ? "Ex.: promoção (uma palavra ou frase por linha)"
                    : "Ex.: SeiLahNick (um nick por linha)"
            )
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(4_000);
        if (entries) input.setValue(entries);

        return new ModalBuilder()
            .setCustomId(isKeywords ? IDS.keywordModal : IDS.nicknameModal)
            .setTitle(isKeywords ? "Configurar palavras-chave" : "Configurar nicks")
            .addComponents(new ActionRowBuilder().addComponents(input));
    }
}
