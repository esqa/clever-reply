/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let cachedCookie: string | null = null;
let cookieExpiry = 0;

function getCookieUrl(): string {
    const d = new Date();
    const suffix = `${d.getFullYear()}${d.getMonth().toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`;
    return `https://www.cleverbot.com/extras/conversation-social-min.js?${suffix}`;
}

async function ensureCookie(): Promise<string> {
    if (cachedCookie && Date.now() < cookieExpiry) return cachedCookie;

    const res = await fetch(getCookieUrl(), {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });

    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) throw new Error("No cookie received from cleverbot.com");

    cachedCookie = setCookie.split(";")[0];
    cookieExpiry = Date.now() + 86400000;
    return cachedCookie;
}

export async function postCleverbot(
    _: IpcMainInvokeEvent,
    queryString: string,
    body: string
): Promise<{ status: number; data: string; }> {
    const cookie = await ensureCookie();
    const url = `https://www.cleverbot.com/webservicemin?${queryString}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 15; attempt++) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "User-Agent": USER_AGENT,
                    "Content-Type": "text/plain",
                    "Cookie": `${cookie}; _cbsid=-1`,
                },
                body,
            });

            if (res.status === 503) {
                lastError = new Error("503 Service Unavailable");
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            const data = await res.text();
            return { status: res.status, data };
        } catch (e) {
            lastError = e as Error;
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    throw lastError ?? new Error("Failed to get a response after 15 tries.");
}
