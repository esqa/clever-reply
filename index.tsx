/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { addMemberListDecorator, removeMemberListDecorator } from "@api/MemberListDecorators";
import { addMessageDecoration, removeMessageDecoration } from "@api/MessageDecorations";
import { definePluginSettings } from "@api/Settings";
import { sendMessage } from "@utils/discord";
import definePlugin, { IconComponent, OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, FluxDispatcher, GuildStore, Menu, showToast, Toasts, UserStore, useState } from "@webpack/common";

import { queryCleverbot } from "./cleverbot";
import { PluginNative } from "@utils/types";

const Native = VencordNative.pluginHelpers.CleverReply as PluginNative<typeof import("./native")>;

const autoReplyUsers = new Set<string>();
const autoReplyChannels = new Set<string>();

function saveAutoReplyUsers() {
    settings.store.autoReplyUserIds = JSON.stringify([...autoReplyUsers]);
}

function loadAutoReplyUsers() {
    try {
        const ids: string[] = JSON.parse(settings.store.autoReplyUserIds);
        for (const id of ids) autoReplyUsers.add(id);
    } catch { }
}

function saveAutoReplyChannels() {
    settings.store.autoReplyChannelIds = JSON.stringify([...autoReplyChannels]);
}

function loadAutoReplyChannels() {
    try {
        const ids: string[] = JSON.parse(settings.store.autoReplyChannelIds);
        for (const id of ids) autoReplyChannels.add(id);
    } catch { }
}

const PendingReplyStore = findByPropsLazy("getPendingReply");
const MessageActions = findByPropsLazy("getSendMessageOptionsForReply");
const replyingChannels = new Set<string>();
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
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.15);
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
    replyToReplies: {
        type: OptionType.BOOLEAN,
        description: "Auto-reply when someone replies to your messages",
        default: false,
    },
    channelReplyChance: {
        type: OptionType.SLIDER,
        description: "Chance to reply to messages in auto-reply channels (%)",
        default: 50,
        markers: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        stickToMarkers: false,
    },
    autoReplyUserIds: {
        type: OptionType.STRING,
        description: "User IDs with auto-reply enabled (managed automatically)",
        default: "[]",
        hidden: true,
    },
    autoReplyChannelIds: {
        type: OptionType.STRING,
        description: "Channel IDs with auto-reply enabled (managed automatically)",
        default: "[]",
        hidden: true,
    },
});

// ── Styles ───────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
    marginBottom: 16,
};

const sectionTitleStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "var(--header-secondary)",
    marginBottom: 8,
};

const listStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
};

const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderRadius: 6,
    background: "var(--background-secondary)",
};

const itemNameStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
};

const primaryTextStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text-normal)",
};

const secondaryTextStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--text-muted)",
};

const removeBtnStyle: React.CSSProperties = {
    background: "var(--button-danger-background)",
    color: "white",
    border: "none",
    borderRadius: 4,
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
};

const emptyStyle: React.CSSProperties = {
    color: "var(--text-muted)",
    fontSize: 13,
    fontStyle: "italic",
    padding: "4px 0",
};

// ── Settings Panel ───────────────────────────────────────────────────────────

function AutoReplyPanel() {
    const [, forceUpdate] = useState(0);
    const rerender = () => forceUpdate(n => n + 1);

    const userIds = [...autoReplyUsers];
    const channelIds = [...autoReplyChannels];

    function removeUser(id: string) {
        autoReplyUsers.delete(id);
        saveAutoReplyUsers();
        rerender();
    }

    function removeChannel(id: string) {
        autoReplyChannels.delete(id);
        saveAutoReplyChannels();
        rerender();
    }

    function clearAllUsers() {
        autoReplyUsers.clear();
        saveAutoReplyUsers();
        rerender();
    }

    function clearAllChannels() {
        autoReplyChannels.clear();
        saveAutoReplyChannels();
        rerender();
    }

    return (
        <div style={panelStyle}>
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={sectionTitleStyle}>Auto-Reply Users ({userIds.length})</span>
                    {userIds.length > 0 && (
                        <button style={{ ...removeBtnStyle, fontSize: 11, padding: "2px 8px" }} onClick={clearAllUsers}>
                            Clear All
                        </button>
                    )}
                </div>
                <div style={listStyle}>
                    {userIds.length === 0 ? (
                        <span style={emptyStyle}>No users — right-click a user to enable auto-reply</span>
                    ) : (
                        userIds.map(id => {
                            const user = UserStore.getUser(id);
                            return (
                                <div key={id} style={itemStyle}>
                                    <div style={itemNameStyle}>
                                        <span style={primaryTextStyle}>
                                            {user ? `${user.username}${user.discriminator !== "0" ? `#${user.discriminator}` : ""}` : "Unknown User"}
                                        </span>
                                        <span style={secondaryTextStyle}>{id}</span>
                                    </div>
                                    <button style={removeBtnStyle} onClick={() => removeUser(id)}>Remove</button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={sectionTitleStyle}>Auto-Reply Channels ({channelIds.length})</span>
                    {channelIds.length > 0 && (
                        <button style={{ ...removeBtnStyle, fontSize: 11, padding: "2px 8px" }} onClick={clearAllChannels}>
                            Clear All
                        </button>
                    )}
                </div>
                <div style={listStyle}>
                    {channelIds.length === 0 ? (
                        <span style={emptyStyle}>No channels — right-click a channel to enable auto-reply</span>
                    ) : (
                        channelIds.map(id => {
                            const channel = ChannelStore.getChannel(id);
                            const guild = channel?.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
                            let name = "Unknown Channel";
                            if (channel) {
                                name = channel.name
                                    ? `#${channel.name}`
                                    : (channel.rawRecipients?.map((r: any) => r.username).join(", ") ?? "DM");
                            }
                            return (
                                <div key={id} style={itemStyle}>
                                    <div style={itemNameStyle}>
                                        <span style={primaryTextStyle}>{name}</span>
                                        <span style={secondaryTextStyle}>
                                            {guild ? guild.name : "DM"} — {id}
                                        </span>
                                    </div>
                                    <button style={removeBtnStyle} onClick={() => removeChannel(id)}>Remove</button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

const ChannelContextMenuPatch: NavContextMenuPatchCallback = (children, { channel }: { channel?: { id: string; }; }) => {
    if (!channel) return;
    const active = autoReplyChannels.has(channel.id);
    children.push(
        <Menu.MenuItem
            id="vc-cleverreply-channel-auto"
            label={active ? "Stop Channel Auto Reply" : "Auto Reply Channel (Cleverbot)"}
            action={() => {
                if (active) autoReplyChannels.delete(channel.id);
                else autoReplyChannels.add(channel.id);
                saveAutoReplyChannels();
                showToast(
                    active
                        ? "Channel auto-reply stopped"
                        : `Channel auto-reply started (${settings.store.channelReplyChance}% chance)`,
                    Toasts.Type.MESSAGE
                );
            }}
        />
    );
};

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
                saveAutoReplyUsers();
                showToast(active ? "Auto-reply stopped" : "Auto-reply started", Toasts.Type.MESSAGE);
            }}
        />
    );
};

export default definePlugin({
    name: "CleverReply",
    description: "Adds a button to reply to messages using Cleverbot",
    authors: [{ name: "CleverReply", id: 0n }],
    dependencies: ["MessageDecorationsAPI", "MemberListDecoratorsAPI"],
    settings,
    settingsAboutComponent: AutoReplyPanel,

    start() {
        loadAutoReplyUsers();
        loadAutoReplyChannels();
        addMessageDecoration("vc-cleverreply-auto", props => {
            if (!autoReplyUsers.has(props?.message?.author?.id)) return null;
            return (
                <span style={{ marginLeft: 4, display: "inline-flex", color: "var(--brand-experiment)" }} title="Auto-reply enabled">
                    <RobotIcon height={16} width={16} />
                </span>
            );
        });
        addMemberListDecorator("vc-cleverreply-auto", props => {
            if (!autoReplyUsers.has(props?.user?.id)) return null;
            return (
                <span style={{ marginLeft: 4, display: "inline-flex", color: "var(--brand-experiment)" }} title="Auto-reply enabled">
                    <RobotIcon height={16} width={16} />
                </span>
            );
        });
    },

    contextMenus: {
        "user-context": UserContextMenuPatch,
        "channel-context": ChannelContextMenuPatch,
        "gdm-context": ChannelContextMenuPatch,
    },

    flux: {
        async MESSAGE_CREATE({ message, optimistic }: { message: any; optimistic: boolean; }) {
            if (optimistic) return;
            if (message.author.id === UserStore.getCurrentUser().id) return;
            if (!message.content) return;
            if (replyingChannels.has(message.channel_id)) return;

            const isUserAutoReply = autoReplyUsers.has(message.author.id);
            const isChannelAutoReply = autoReplyChannels.has(message.channel_id);
            const isReplyToMe = settings.store.replyToReplies
                && message.referenced_message?.author?.id === UserStore.getCurrentUser().id;

            if (!isUserAutoReply && !isChannelAutoReply && !isReplyToMe) return;

            // For channel auto-reply (not user or reply-to-me), roll against the chance slider
            if (isChannelAutoReply && !isUserAutoReply && !isReplyToMe) {
                if (Math.random() * 100 >= settings.store.channelReplyChance) return;
            }

            const min = settings.store.autoReplyMinDelay;
            const max = settings.store.autoReplyMaxDelay;
            const delay = Math.round((min + Math.random() * (max - min)) * 1000);

            replyingChannels.add(message.channel_id);
            addPending();

            try {
                // Sleep in main process to avoid Chromium background-tab timer throttling
                await Native.sleep(delay);

                let reply = await queryCleverbot(message.channel_id, message.content);
                reply = applyTextSettings(reply);

                // Send as a Discord reply when triggered by someone replying to us
                if (isReplyToMe) {
                    const replyOptions = MessageActions.getSendMessageOptionsForReply({
                        type: 0,
                        message,
                        channel: ChannelStore.getChannel(message.channel_id),
                        shouldMention: true,
                    });
                    sendMessage(message.channel_id, { content: reply }, true, replyOptions);
                    FluxDispatcher.dispatch({ type: "DELETE_PENDING_REPLY", channelId: message.channel_id });
                } else {
                    sendMessage(message.channel_id, { content: reply });
                }
            } catch (e) {
                showToast(
                    `Auto-reply error: ${e instanceof Error ? e.message : String(e)}`,
                    Toasts.Type.FAILURE
                );
            } finally {
                // Brief cooldown so our own MESSAGE_CREATE doesn't re-trigger
                setTimeout(() => replyingChannels.delete(message.channel_id), 2000);
                removePending();
            }
        },
    },

    stop() {
        autoReplyUsers.clear();
        autoReplyChannels.clear();
        replyingChannels.clear();
        pendingCount = 0;
        updateIndicator();
        removeMessageDecoration("vc-cleverreply-auto");
        removeMemberListDecorator("vc-cleverreply-auto");
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
