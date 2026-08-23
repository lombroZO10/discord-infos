import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    escapeMarkdown,
} from "discord.js";

const IDS = {
    keywordButton: "xat-monitor:keywords",
    nicknameButton: "xat-monitor:nicknames",
    keywordModal: "xat-monitor:keywords-modal",
    nicknameModal: "xat-monitor:nicknames-modal",
    input: "xat-monitor:entries",
};

const listEntries = (entries) => {
    if (entries.length === 0) return "Nenhum item configurado.";
    const value = entries
        .map((entry) => `• ${escapeMarkdown(entry)}`)
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
    }

    async start() {
        const { panelMessageId } = this.store.snapshot();

        if (panelMessageId) {
            try {
                this.message = await this.channel.messages.fetch(panelMessageId);
            } catch {
                this.logger.warn("[discord] Painel anterior não foi encontrado; criando outro.");
            }
        }

        if (this.message) {
            await this.message.edit(this.payload());
        } else {
            this.message = await this.channel.send(this.payload());
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
                `${type === "keywords" ? "Palavras-chave" : "Nicks"} atualizados: ${entries.length}.`
            );
        }
    }

    async refresh() {
        if (this.message) await this.message.edit(this.payload());
    }

    payload() {
        const state = this.store.snapshot();
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("Monitoramento do xat")
            .setDescription(
                "Todas as mensagens públicas são encaminhadas para este canal. "
                + "Correspondências abaixo também geram um alerta privado."
            )
            .addFields(
                {
                    name: `Palavras-chave (${state.keywords.length})`,
                    value: listEntries(state.keywords),
                    inline: true,
                },
                {
                    name: `Nicks monitorados (${state.nicknames.length})`,
                    value: listEntries(state.nicknames),
                    inline: true,
                }
            )
            .setFooter({ text: "Configuração restrita ao responsável do bot." });

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(IDS.keywordButton)
                .setLabel("Configurar palavras")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(IDS.nicknameButton)
                .setLabel("Configurar nicks")
                .setStyle(ButtonStyle.Secondary)
        );

        return {
            embeds: [embed],
            components: [buttons],
            allowedMentions: { parse: [] },
        };
    }

    modal(type) {
        const isKeywords = type === "keywords";
        const entries = this.store.snapshot()[type].join("\n").slice(0, 4_000);
        const input = new TextInputBuilder()
            .setCustomId(IDS.input)
            .setLabel(isKeywords ? "Palavras-chave" : "Nicks")
            .setPlaceholder("Um item por linha; deixe vazio para limpar.")
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
