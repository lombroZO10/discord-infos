export default {
    name: "y", // Packet name

    /**
     * Chat main connection
     * @param {object} bot - Bot instance
     * @param {object} packet - Packet data
     */
    async execute (bot, packet) {
        if (!packet.i) {
            return await bot.state.isConnected();
        }

        // Relogging mode
        if (bot.state.isLoggingIn) {
            return await bot.send("v", {
                n: bot.state.envData.username,
                a: bot.state.envData.apiKey,
            });
        }

        if (!bot.state.loginInfo.k1) return;

        // Connection data
        const j2Packet = {
            cb: packet.c,
            Y: 2,
            l5: 65535,
            l4: 500,
            l3: 500,
            l2: 0,
            y: packet.i,
            k: bot.state.loginInfo.k1,
            k3: bot.state.loginInfo.k3,
            d1: bot.state.loginInfo.d1 || false,
            z: "m1.67,3",
            p: 0,
            c: bot.state.chatInfo.id,
            f: 0,
            u: bot.state.loginInfo.i,
        };

        // Disabled powers
        if (bot.state.envData.disabledPowers) {
            for (const k of bot.state.envData.disabledPowers) {
                const subid = Math.pow(2, k % 32);
                const section = "m" + (k >> 5);
                if (j2Packet[section]) {
                    j2Packet[section] += subid;
                } else {
                    j2Packet[section] = subid;
                }
            }
        }

        // Account flags
        j2Packet.d0 = bot.state.loginInfo.d0 || false;

        // Bride and powers
        for (let i = 2; i <= 35; i++) {
            const pid = "d" + i;
            if (bot.state.loginInfo[pid]) {
                j2Packet[pid] = bot.state.loginInfo[pid];
            }
        }

        // Account data
        j2Packet.dO = bot.state.loginInfo.dO || false;
        j2Packet.dx = bot.state.loginInfo.dx || false;
        j2Packet.dt = bot.state.loginInfo.dt || false;
        j2Packet.N = bot.state.loginInfo.n;
        j2Packet.n = `${bot.state.settings.nick}##${bot.state.settings.status}`;
        j2Packet.a = `${bot.state.settings.avatar}#${bot.state.settings.pcback}`;
        j2Packet.h = bot.state.settings.home;
        j2Packet.v = bot.state.loginInfo.d1 ? 1 : 0;

        // Extra data
        j2Packet.W = Buffer.from(
            JSON.stringify({
                Pcplus: bot.state.settings.pcplus,
                avatarSettings: Buffer.from(
                    JSON.stringify({
                        avatareffect: bot.state.settings.avatareffect,
                        avatarframe: bot.state.settings.avatarframe,
                        avatarspeed: bot.state.settings.avatarspeed,
                        avatarcolor: bot.state.settings.avatarcolor,
                    })
                ).toString("base64"),
                Stealth: bot.state.settings.stealth === "on" ? "enable" : "disable",
                StatusFx: Buffer.from(
                    JSON.stringify({
                        effect: bot.state.settings.statusfx_effect,
                        speed: bot.state.settings.statusfx_speed,
                        status2: bot.state.settings.statusfx_status2,
                        waveFrequency: bot.state.settings.statusfx_wave_frequency,
                    })
                ).toString("base64"),
                pstyle: Buffer.from(
                    JSON.stringify({
                        pstyle: bot.state.settings.pstyle_image,
                        pstylecol: bot.state.settings.pstyle_color,
                        pstyleicon: bot.state.settings.pstyle_icons === "true" ? false : true,
                        pstylegradient: bot.state.settings.pstyle_grad,
                        pstylePos: "",
                        pstyleVersion: "0.666z",
                    })
                ).toString("base64"),
            })
        ).toString("base64");

        await bot.send("j2", j2Packet);
    },
};
