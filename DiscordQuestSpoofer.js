if (window.__qs_running) {
    console.log("%c[QS]%c Session deja active. Tape window.__qs_running = false pour reset.", "color:#faa81a;font-weight:bold", "");
} else { window.__qs_running = true; (async () => { try {

const SUPPORTED = {
    WATCH_VIDEO:          { label: "VIDEO",    prio: 0, needs: "any" },
    WATCH_VIDEO_ON_MOBILE:{ label: "VIDEO",    prio: 0, needs: "any" },
    PLAY_ACTIVITY:        { label: "ACTIVITE", prio: 1, needs: "any" },
    STREAM_ON_DESKTOP:    { label: "STREAM",   prio: 2, needs: "desktop" },
    PLAY_ON_DESKTOP:      { label: "JEU",      prio: 2, needs: "desktop" },
};

const RETRY_CAP      = 3;
const PULSE_INTERVAL = 20_000;
const SAFETY_FACTOR  = 2.5;
const VIDEO_COOLDOWN = 300;

const PLATFORM = navigator.userAgent.includes("Windows") ? "win32"
    : navigator.userAgent.includes("Mac") ? "darwin" : "linux";

const COLORS = { info: "#5865f2", ok: "#3ba55c", warn: "#faa81a", err: "#ed4245" };
const emit = (msg, type = "info") => console.log(`%c[QS]%c ${msg}`, `color:${COLORS[type]};font-weight:bold`, "");

if (typeof webpackChunkdiscord_app === "undefined") {
    emit("webpackChunkdiscord_app introuvable. Ce script ne fonctionne que sur discord.com ou l'app Discord.", "err");
    throw new Error("Not Discord");
}

delete window.$;
const loader = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
webpackChunkdiscord_app.pop();
const cache = Object.values(loader.c);

function scan(test) {
    for (const m of cache) {
        if (!m?.exports) continue;
        for (const k of Object.keys(m.exports)) {
            try {
                const val = m.exports[k];
                if (val && test(val)) return val;
            } catch {}
        }
    }
    return null;
}

function proto(obj, method) {
    try { return typeof Object.getPrototypeOf(obj)?.[method] === "function"; } catch { return false; }
}

const ctx = {
    quests:     scan(e => proto(e, "getQuest")),
    http:       scan(e => typeof e.get === "function" && typeof e.post === "function" && typeof e.put === "function" && typeof e.del === "function"),
    dispatcher: scan(e => proto(e, "flushWaitQueue") && typeof e.subscribe === "function"),
    games:      scan(e => typeof e.getRunningGames === "function"),
    streams:    scan(e => proto(e, "getStreamerActiveStreamMetadata")),
    channels:   scan(e => proto(e, "getAllThreadsForParent")),
    guilds:     scan(e => typeof e.getSFWDefaultChannel === "function"),
};

if (!ctx.quests || !ctx.http) {
    emit("Modules Discord introuvables.", "err");
    console.table(Object.fromEntries(Object.entries(ctx).map(([k, v]) => [k, v ? "OK" : "ABSENT"])));
    throw new Error("Init failed");
}

const DESKTOP = !!(ctx.games && ctx.dispatcher);
emit(`Modules charges (${DESKTOP ? "desktop" : "navigateur"}, ${PLATFORM})`);

async function request(fn, tag) {
    for (let i = 1; i <= RETRY_CAP; i++) {
        try { return await fn(); }
        catch (e) {
            const status = e?.status ?? e?.body?.code;
            if (status === 429) {
                const retryAfter = (e?.body?.retry_after ?? 5) * 1000;
                emit(`Rate limit sur ${tag}, pause ${Math.ceil(retryAfter / 1000)}s...`, "warn");
                await new Promise(r => setTimeout(r, retryAfter));
                i--;
                continue;
            }
            if (i < RETRY_CAP) {
                const wait = i * 2000;
                console.warn(`[QS:RETRY] ${tag} (${status ?? "err"}) — tentative ${i + 1}/${RETRY_CAP} dans ${wait / 1000}s`);
                await new Promise(r => setTimeout(r, wait));
            } else {
                emit(`${tag} echoue (${RETRY_CAP} essais)`, "err");
                throw e;
            }
        }
    }
}

function race(promise, ms, tag) {
    return Promise.race([
        promise,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`${tag}: timeout (${Math.round(ms / 60_000)}min)`)), ms)),
    ]);
}

function bar(cur, max) {
    const pct  = Math.min(100, Math.floor(cur / max * 100));
    const full = Math.floor(pct / 5);
    const left = Math.max(0, Math.ceil((max - cur) / 60));
    return `${"█".repeat(full)}${"░".repeat(20 - full)} ${pct}% (${Math.floor(cur)}/${max}s) ~${left}min`;
}

function taskOf(q) {
    const cfg = q.config?.taskConfig ?? q.config?.taskConfigV2;
    if (!cfg?.tasks) return null;
    const name = Object.keys(SUPPORTED).find(t => cfg.tasks[t] != null);
    return name ? { cfg, name, meta: SUPPORTED[name], target: cfg.tasks[name].target } : null;
}

function nameOf(q) {
    return q.config?.messages?.questName ?? q.config?.application?.name ?? `Quest ${q.id}`;
}

const pool = [...ctx.quests.quests.values()].filter(q => {
    if (!q.userStatus?.enrolledAt || q.userStatus?.completedAt) return false;
    if (Date.parse(q.config?.expiresAt) <= Date.now()) return false;
    return taskOf(q) != null;
});

pool.sort((a, b) => {
    const ta = taskOf(a), tb = taskOf(b);
    if (ta.meta.prio !== tb.meta.prio) return ta.meta.prio - tb.meta.prio;
    const leftA = ta.target - (a.userStatus?.progress?.[ta.name]?.value ?? 0);
    const leftB = tb.target - (b.userStatus?.progress?.[tb.name]?.value ?? 0);
    return leftA - leftB;
});

if (pool.length === 0) {
    emit("Aucune quete en cours. Accepte-en d'abord.", "warn");
} else {
    emit(`${pool.length} quete(s) detectee(s):`);
    pool.forEach((q, i) => {
        const t = taskOf(q);
        const done = q.userStatus?.progress?.[t.name]?.value ?? 0;
        console.log(`  ${i + 1}. [${t.meta.label}] ${nameOf(q)} — ${Math.floor(done)}/${t.target}s`);
    });

    let wins = 0, fails = 0;

    for (const quest of pool) {
        try {
            await execute(quest);
            wins++;
        } catch (e) {
            fails++;
            emit(`${nameOf(quest)}: ${e?.message ?? e}`, "err");
        }
    }

    emit(`${wins} OK` + (fails > 0 ? ` / ${fails} echouee(s)` : ""), wins > 0 ? "ok" : "err");
}

async function execute(quest) {
    const t = taskOf(quest);
    if (!t) throw new Error("Type inconnu");

    const { name, meta, target } = t;
    const qname = nameOf(quest);
    const appId = quest.config.application.id;
    let done = quest.userStatus?.progress?.[name]?.value ?? 0;

    if (done >= target) { emit(`${qname} — deja finie`, "ok"); return; }
    if (meta.needs === "desktop" && !DESKTOP) throw new Error("Necessite l'app desktop avec les modules jeu (RunningGameStore introuvable)");

    emit(`[${meta.label}] ${qname}`);
    console.log(`  ${bar(done, target)}`);

    if (name === "WATCH_VIDEO" || name === "WATCH_VIDEO_ON_MOBILE") {
        const base = Date.parse(quest.userStatus.enrolledAt);
        const step = 7, drift = 10;

        while (done < target) {
            const budget = Math.floor((Date.now() - base) / 1000) + drift;
            const next = done + step;

            if (budget - done >= step) {
                const r = await request(
                    () => ctx.http.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: Math.min(target, next + Math.random()) } }),
                    "video",
                );
                if (r?.body?.completed_at) break;
                done = Math.min(target, next);
                console.log(`  ${bar(done, target)}`);
                if (next >= target) break;
                await new Promise(r => setTimeout(r, VIDEO_COOLDOWN));
                continue;
            }

            if (next >= target) break;
            await new Promise(r => setTimeout(r, 1000));
        }

        await request(() => ctx.http.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: target } }), "video/fin").catch(() => {});

    } else if (name === "PLAY_ON_DESKTOP") {
        if (!ctx.games || !ctx.dispatcher) throw new Error("Modules jeu absents");

        const appName = quest.config.application.name;
        let exe = appName.replace(/[\/\\:*?"<>|]/g, "");
        try {
            const appInfo = await request(() => ctx.http.get({ url: `/applications/public?application_ids=${appId}` }), "app");
            const appList = appInfo?.body ?? appInfo;
            const app = Array.isArray(appList) ? appList[0] : appList;
            const platformExe = app?.executables?.find(x => x.os === PLATFORM);
            const anyExe = app?.executables?.[0];
            if (platformExe?.name || anyExe?.name) exe = (platformExe ?? anyExe).name.replace(">", "");
        } catch {}


        const fakePid = 1000 + Math.floor(Math.random() * 30000);
        const timeout = (target - done) * 1000 * SAFETY_FACTOR;

        const ghost = {
            cmdLine: `C:\\Program Files\\${appName}\\${exe}`, exeName: exe,
            exePath: `c:/program files/${appName.toLowerCase()}/${exe}`,
            hidden: false, isLauncher: false, id: appId, name: appName,
            pid: fakePid, pidPath: [fakePid], processName: appName, start: Date.now(),
        };

        const origGames = ctx.games.getRunningGames;
        const origPID = ctx.games.getGameForPID;

        try {
            ctx.games.getRunningGames = () => [ghost];
            ctx.games.getGameForPID = p => p === fakePid ? ghost : undefined;
            ctx.dispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: origGames(), added: [ghost], games: [ghost] });

            let gameHandler = null;
            try {
                await race(new Promise(resolve => {
                    gameHandler = data => {
                        const p = quest.config.configVersion === 1
                            ? data.userStatus?.streamProgressSeconds
                            : Math.floor(data.userStatus?.progress?.PLAY_ON_DESKTOP?.value ?? 0);
                        console.log(`  ${bar(p, target)}`);
                        if (p >= target) { ctx.dispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", gameHandler); resolve(); }
                    };
                    ctx.dispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", gameHandler);
                }), timeout, qname);
            } finally {
                if (gameHandler) ctx.dispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", gameHandler);
            }
        } finally {
            ctx.games.getRunningGames = origGames;
            ctx.games.getGameForPID = origPID;
            ctx.dispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [ghost], added: [], games: [] });
        }

    } else if (name === "STREAM_ON_DESKTOP") {
        if (!ctx.streams || !ctx.dispatcher) throw new Error("Modules stream absents");

        const origMeta = ctx.streams.getStreamerActiveStreamMetadata;
        const fakePid = 1000 + Math.floor(Math.random() * 30000);
        const timeout = (target - done) * 1000 * SAFETY_FACTOR;

        console.log("  En attente de stream... (il faut 1+ personne en VC)");

        try {
            ctx.streams.getStreamerActiveStreamMetadata = () => ({ id: appId, pid: fakePid, sourceName: null });

            const pulse = setInterval(async () => {
                try { await ctx.http.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: "", terminal: false } }); } catch {}
            }, PULSE_INTERVAL);

            let streamHandler = null;
            try {
                await race(new Promise(resolve => {
                    streamHandler = data => {
                        const p = quest.config.configVersion === 1
                            ? data.userStatus?.streamProgressSeconds
                            : Math.floor(data.userStatus?.progress?.STREAM_ON_DESKTOP?.value ?? 0);
                        console.log(`  ${bar(p, target)}`);
                        if (p >= target) { ctx.dispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", streamHandler); resolve(); }
                    };
                    ctx.dispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", streamHandler);
                }), timeout, qname);
            } finally {
                clearInterval(pulse);
                if (streamHandler) ctx.dispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", streamHandler);
            }
        } finally {
            ctx.streams.getStreamerActiveStreamMetadata = origMeta;
        }

    } else if (name === "PLAY_ACTIVITY") {
        if (!ctx.channels) throw new Error("Module channels absent");

        const privates = ctx.channels.getSortedPrivateChannels?.() ?? [];
        const guildVocal = Object.values(ctx.guilds?.getAllGuilds?.() ?? {}).find(g => g?.VOCAL?.length > 0)?.VOCAL?.[0]?.channel?.id;
        const ch = privates[0]?.id ?? guildVocal;
        if (!ch) throw new Error("Aucun channel disponible (ouvre au moins 1 DM ou rejoins un serveur avec un salon vocal)");

        const key = `call:${ch}:1`;

        while (true) {
            const r = await request(
                () => ctx.http.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: key, terminal: false } }),
                "pulse",
            );
            const p = r.body?.progress?.PLAY_ACTIVITY?.value ?? 0;
            console.log(`  ${bar(p, target)}`);

            if (p >= target) {
                await request(() => ctx.http.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: key, terminal: true } }), "pulse/fin");
                break;
            }
            await new Promise(r => setTimeout(r, PULSE_INTERVAL));
        }
    }

    emit(`${qname} terminee`, "ok");
}

} finally { window.__qs_running = false; } })(); }
