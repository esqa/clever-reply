/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { sendMessage } from "@utils/discord";
import definePlugin, { IconComponent, OptionType } from "@utils/types";
import { ChannelStore, showToast, Toasts } from "@webpack/common";

import { queryCleverbot } from "./cleverbot";

const RobotIcon: IconComponent = ({ height = 24, width = 24, className }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} height={height} width={width}>
        <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3M7.5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S9.83 13 9 13s-1.5-.67-1.5-1.5M16 17H8v-2h8zm-1-4c-.83 0-1.5-.67-1.5-1.5S14.17 10 15 10s1.5.67 1.5 1.5S15.83 13 15 13" />
    </svg>
);

const settings = definePluginSettings({
    showToasts: {
        type: OptionType.BOOLEAN,
        description: "Show toast notifications while waiting for Cleverbot",
        default: true,
    },
});

export default definePlugin({
    name: "CleverReply",
    description: "Adds a button to reply to messages using Cleverbot",
    authors: [{ name: "CleverReply", id: 0n }],
    settings,

    messagePopoverButton: {
        icon: RobotIcon,
        render(msg) {
            if (!msg.content) return null;

            return {
                label: "Cleverbot Reply",
                icon: RobotIcon,
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: async () => {
                    const channelId = msg.channel_id;

                    if (settings.store.showToasts) {
                        showToast("Thinking...", Toasts.Type.MESSAGE);
                    }

                    try {
                        const reply = await queryCleverbot(channelId, msg.content);
                        sendMessage(channelId, { content: reply });
                    } catch (e) {
                        showToast(
                            `Cleverbot error: ${e instanceof Error ? e.message : String(e)}`,
                            Toasts.Type.FAILURE
                        );
                    }
                },
            };
        },
    },
});
