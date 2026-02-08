/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginNative } from "@utils/types";

const Native = VencordNative.pluginHelpers.CleverReply as PluginNative<typeof import("./native")>;

// ── Inline MD5 Implementation ──────────────────────────────────────────────────

function md5(input: string): string {
    function safeAdd(x: number, y: number): number {
        const lsw = (x & 0xFFFF) + (y & 0xFFFF);
        return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xFFFF);
    }

    function bitRotateLeft(num: number, cnt: number): number {
        return (num << cnt) | (num >>> (32 - cnt));
    }

    function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
        return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
    }

    function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
        return cmn((b & c) | (~b & d), a, b, x, s, t);
    }
    function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
        return cmn((b & d) | (c & ~d), a, b, x, s, t);
    }
    function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
        return cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
        return cmn(c ^ (b | ~d), a, b, x, s, t);
    }

    function md5cycle(x: number[], k: number[]): void {
        let [a, b, c, d] = x;

        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22, 1236535329);

        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);

        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174);
        d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979);
        b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487);
        d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16, 530742520);
        b = hh(b, c, d, a, k[2], 23, -995338651);

        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787259);
        b = ii(b, c, d, a, k[9], 21, -343485551);

        x[0] = safeAdd(a, x[0]);
        x[1] = safeAdd(b, x[1]);
        x[2] = safeAdd(c, x[2]);
        x[3] = safeAdd(d, x[3]);
    }

    function md5blk(s: string): number[] {
        const blks: number[] = [];
        for (let i = 0; i < 64; i += 4) {
            blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
        }
        return blks;
    }

    let n = input.length;
    let state = [1732584193, -271733879, -1732584194, 271733878];
    let i: number;

    for (i = 64; i <= n; i += 64) {
        md5cycle(state, md5blk(input.substring(i - 64, i)));
    }

    input = input.substring(i - 64);
    const tail = Array<number>(16).fill(0);

    for (i = 0; i < input.length; i++) {
        tail[i >> 2] |= input.charCodeAt(i) << ((i % 4) << 3);
    }
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);

    if (i > 55) {
        md5cycle(state, tail);
        tail.fill(0);
    }

    tail[14] = n * 8;
    md5cycle(state, tail);

    const hex = "0123456789abcdef";
    let result = "";
    for (i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            const byte = (state[i] >> (j * 8)) & 0xFF;
            result += hex.charAt((byte >> 4) & 0xF) + hex.charAt(byte & 0xF);
        }
    }
    return result;
}

// ── Escape helper (matches JS's deprecated escape() behavior) ──────────────────

function escapeString(s: string): string {
    let result = "";
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (
            (c >= 0x30 && c <= 0x39) || // 0-9
            (c >= 0x41 && c <= 0x5A) || // A-Z
            (c >= 0x61 && c <= 0x7A) || // a-z
            c === 0x2A || c === 0x2B || c === 0x2D || c === 0x2E || // * + - .
            c === 0x2F || c === 0x40 || c === 0x5F // / @ _
        ) {
            result += s[i];
        } else if (c < 0x100) {
            result += "%" + c.toString(16).toUpperCase().padStart(2, "0");
        } else {
            result += "%u" + c.toString(16).toUpperCase().padStart(4, "0");
        }
    }
    return result;
}

function encodeStimulus(text: string): string {
    const escaped = escapeString(text);
    if (escaped.includes("%u")) {
        return escapeString(escaped.replace(/%u/g, "|"));
    }
    return escaped;
}

// ── Conversation State ─────────────────────────────────────────────────────────

interface ConversationState {
    cbsid: string;
    xai: string;
    lastResponse: string;
    context: string[];
}

const conversations = new Map<string, ConversationState>();

export function resetConversation(channelId: string): void {
    conversations.delete(channelId);
}

// ── Main Query Function ────────────────────────────────────────────────────────

export async function queryCleverbot(channelId: string, message: string): Promise<string> {
    const state = conversations.get(channelId);

    // Build POST body
    let body = `stimulus=${encodeStimulus(message)}&`;

    // Add conversation context (reversed order: most recent first)
    if (state) {
        const ctx = [...state.context].reverse();
        for (let i = 0; i < ctx.length; i++) {
            body += `vText${i + 2}=${encodeStimulus(ctx[i])}&`;
        }
    }

    body += "cb_settings_language=en&cb_settings_scripting=no&islearning=1&icognoid=wsf&icognocheck=";
    body += md5(body.substring(7, 33));

    // Build query string
    let qs = "uc=UseOfficialCleverbotAPI";

    if (state) {
        qs += `&out=${encodeURIComponent(state.lastResponse)}`;
        qs += `&in=${encodeURIComponent(message)}`;
        qs += `&bot=c&cbsid=${encodeURIComponent(state.cbsid)}`;
        qs += `&xai=${encodeURIComponent(state.xai)}`;
        qs += "&ns=2&al=&dl=&flag=&user=&mode=1&alt=0&reac=&emo=&sou=website&xed=&";
    }

    const res = await Native.postCleverbot(qs, body);

    if (res.status !== 200) {
        throw new Error(`Cleverbot returned status ${res.status}`);
    }

    const parts = res.data.split("\r");
    const reply = parts[0];

    if (!reply) {
        throw new Error("Empty response from Cleverbot");
    }

    if (parts[1] === "DENIED") {
        throw new Error("Request denied by Cleverbot (rate limited)");
    }

    const cbsid = parts[1] || "";
    const xaiSuffix = parts[2] || "";
    const xai = cbsid.substring(0, 3) + "," + xaiSuffix;

    // Update conversation state
    const context = state ? [...state.context, message, reply] : [message, reply];
    conversations.set(channelId, {
        cbsid,
        xai,
        lastResponse: reply,
        context,
    });

    return reply;
}
