/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { sendMessage } from "@utils/discord";
import definePlugin, { IconComponent, OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, FluxDispatcher, Menu, showToast, Toasts, UserStore } from "@webpack/common";

import { queryCleverbot } from "./cleverbot";
import { PluginNative } from "@utils/types";

const Native = VencordNative.pluginHelpers.CleverReply as PluginNative<typeof import("./native")>;

const autoReplyUsers = new Set<string>();

const PendingReplyStore = findByPropsLazy("getPendingReply");
const MessageActions = findByPropsLazy("getSendMessageOptionsForReply");
let pendingCount = 0;
let indicatorEl: HTMLDivElement | null = null;

function updateIndicator() {
    if (pendingCount > 0) {
        if (!indicatorEl) {
            indicatorEl = document.createElement("div");
            indicatorEl.id = "vc-cleverreply-indicator";
            indicatorEl.style.cssText = `
                position: fixed;
                bottom: 80px;
                right: 24px;
                background: var(--brand-experiment);
                color: white;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                z-index: 9999;
                pointer-events: none;
            `;
            document.body.appendChild(indicatorEl);
        }
        indicatorEl.textContent = `${pendingCount} repl${pendingCount === 1 ? "y" : "ies"} queued`;
    } else if (indicatorEl) {
        indicatorEl.remove();
        indicatorEl = null;
    }
}

function addPending() {
    pendingCount++;
    updateIndicator();
}

function removePending() {
    pendingCount--;
    updateIndicator();
}

function applyTextSettings(reply: string): string {
    if (settings.store.removePunctuation) {
        reply = reply.replace(/[^\w\s]/g, "");
    }
    if (settings.store.humanize && reply.length > 0) {
        const first = Math.random() < 0.5
            ? reply[0].toLowerCase()
            : reply[0].toUpperCase();
        reply = first + reply.slice(1);
    }
    return reply;
}

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
    removePunctuation: {
        type: OptionType.BOOLEAN,
        description: "Remove punctuation from Cleverbot's response",
        default: false,
    },
    humanize: {
        type: OptionType.BOOLEAN,
        description: "Randomly capitalize or lowercase the first letter",
        default: false,
    },
    autoReplyMinDelay: {
        type: OptionType.NUMBER,
        description: "Minimum seconds before auto-replying",
        default: 3,
    },
    autoReplyMaxDelay: {
        type: OptionType.NUMBER,
        description: "Maximum seconds before auto-replying",
        default: 10,
    },
});

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: { user?: { id: string; }; }) => {
    if (!user) return;
    const active = autoReplyUsers.has(user.id);
    children.push(
        <Menu.MenuItem
            id="vc-cleverreply-auto"
            label={active ? "Stop Auto Reply" : "Auto Reply (Cleverbot)"}
            action={() => {
                if (active) autoReplyUsers.delete(user.id);
                else autoReplyUsers.add(user.id);
                showToast(active ? "Auto-reply stopped" : "Auto-reply started", Toasts.Type.MESSAGE);
            }}
        />
    );
};

export default definePlugin({
    name: "CleverReply",
    description: "Adds a button to reply to messages using Cleverbot",
    authors: [{ name: "CleverReply", id: 0n }],
    settings,

    contextMenus: {
        "user-context": UserContextMenuPatch,
    },

    flux: {
        async MESSAGE_CREATE({ message, optimistic }: { message: any; optimistic: boolean; }) {
            if (optimistic) return;
            if (!autoReplyUsers.has(message.author.id)) return;
            if (message.author.id === UserStore.getCurrentUser().id) return;
            if (!message.content) return;

            const min = settings.store.autoReplyMinDelay;
            const max = settings.store.autoReplyMaxDelay;
            const delay = Math.round((min + Math.random() * (max - min)) * 1000);

            addPending();

            try {
                // Sleep in main process to avoid Chromium background-tab timer throttling
                await Native.sleep(delay);

                let reply = await queryCleverbot(message.channel_id, message.content);
                reply = applyTextSettings(reply);
                sendMessage(message.channel_id, { content: reply });
            } catch (e) {
                showToast(
                    `Auto-reply error: ${e instanceof Error ? e.message : String(e)}`,
                    Toasts.Type.FAILURE
                );
            } finally {
                removePending();
            }
        },
    },

    stop() {
        autoReplyUsers.clear();
        pendingCount = 0;
        updateIndicator();
    },

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

                    addPending();

                    try {
                        let reply = await queryCleverbot(channelId, msg.content);
                        reply = applyTextSettings(reply);
                        const pendingReply = PendingReplyStore.getPendingReply(channelId);
                        const replyOptions = pendingReply
                            ? MessageActions.getSendMessageOptionsForReply(pendingReply)
                            : {};
                        sendMessage(channelId, { content: reply }, true, replyOptions);
                        if (pendingReply) {
                            FluxDispatcher.dispatch({ type: "DELETE_PENDING_REPLY", channelId });
                        }
                    } catch (e) {
                        showToast(
                            `Cleverbot error: ${e instanceof Error ? e.message : String(e)}`,
                            Toasts.Type.FAILURE
                        );
                    } finally {
                        removePending();
                    }
                },
            };
        },
    },
});
