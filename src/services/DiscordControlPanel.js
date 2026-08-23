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
import { discordColorValue } from "./DiscordColor.js";

const LOGO_NAME = "realeza-logo.png";
const LOGO_PATH = fileURLToPath(new URL("../../assets/realeza-logo.png", import.meta.url));
const BANNER_NAME = "realeza-banner.png";
const BANNER_PATH = fileURLToPath(new URL("../../assets/realeza-banner.png", import.meta.url));
const BRAND_FILES = Object.freeze({
    [LOGO_NAME]: LOGO_PATH,
    [BANNER_NAME]: BANNER_PATH,
});

const IDS = {
    keywordButton: "xat-monitor:keywords",
    nicknameButton: "xat-monitor:nicknames",
    keywordModal: "xat-monitor:keywords-modal",
    nicknameModal: "xat-monitor:nicknames-modal",
    colorButton: "xat-monitor:color",
    colorModal: "xat-monitor:color-modal",
    colorInput: "xat-monitor:color-input",
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
        this.brandAttachments = new Set();
    }

    async start() {
        const { panelMessageId } = this.store.snapshot();

        if (panelMessageId) {
            try {
                this.message = await this.channel.messages.fetch(panelMessageId);
                for (const attachment of this.message.attachments?.values?.() || []) {
                    if (BRAND_FILES[attachment.name]) this.brandAttachments.add(attachment.name);
                }
            } catch {
                this.logger.warn("[discord] Painel anterior não foi encontrado; criando outro.");
            }
        }

        if (this.message) {
            const missingFiles = Object.keys(BRAND_FILES)
                .filter((name) => !this.brandAttachments.has(name));
            const editedMessage = await this.message.edit(this.payload({ files: missingFiles }));
            if (editedMessage) this.message = editedMessage;
            missingFiles.forEach((name) => this.brandAttachments.add(name));
        } else {
            const brandFiles = Object.keys(BRAND_FILES);
            this.message = await this.channel.send(this.payload({ files: brandFiles }));
            brandFiles.forEach((name) => this.brandAttachments.add(name));
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
            if (interaction.customId === IDS.colorButton) {
                await interaction.showModal(this.colorModal());
                return;
            }
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
            if (interaction.customId === IDS.colorModal) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const value = interaction.fields.getTextInputValue(IDS.colorInput);
                let color;
                try {
                    color = await this.store.setColor(value);
                } catch (error) {
                    await interaction.editReply(`❌ ${error.message}`);
                    return;
                }
                await this.refresh();
                await interaction.editReply(`🎨 **Cor principal atualizada para ${color}.**`);
                return;
            }
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

    payload({ files = [] } = {}) {
        const state = this.store.snapshot();
        const embed = new EmbedBuilder()
            .setColor(discordColorValue(state.color))
            .setAuthor({ name: "XAT SENTINEL  •  SISTEMA DE INTELIGÊNCIA" })
            .setTitle("🛰️ Central de Monitoramento")
            .setThumbnail(`attachment://${LOGO_NAME}`)
            .setImage(`attachment://${BANNER_NAME}`)
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
                },
                {
                    name: "🎨 VISUAL ATIVO",
                    value: `Cor principal: **${state.color}**`,
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
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(IDS.colorButton)
                .setLabel("Cor principal")
                .setEmoji("🎨")
                .setStyle(ButtonStyle.Secondary)
        );

        const payload = {
            embeds: [embed],
            components: [buttons],
            allowedMentions: { parse: [] },
        };
        if (files.length) {
            payload.files = files.map((name) => (
                new AttachmentBuilder(BRAND_FILES[name]).setName(name)
            ));
        }
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

    colorModal() {
        const color = this.store.snapshot().color;
        const input = new TextInputBuilder()
            .setCustomId(IDS.colorInput)
            .setLabel("Cor hexadecimal")
            .setPlaceholder("#7F05F5")
            .setValue(color)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(6)
            .setMaxLength(7);

        return new ModalBuilder()
            .setCustomId(IDS.colorModal)
            .setTitle("Configurar cor principal")
            .addComponents(new ActionRowBuilder().addComponents(input));
    }
}
