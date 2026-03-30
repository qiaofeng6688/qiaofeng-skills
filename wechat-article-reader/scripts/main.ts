#!/usr/bin/env bun
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

// Types
type CdpSendOptions = {
  sessionId?: string;
  timeoutMs?: number;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
};

type ArticleData = {
  title: string;
  author: string;
  account: string;
  publishDate: string;
  coverImage: string;
  content: string;
  url: string;
};

type Args = {
  url: string;
  browserMode: "auto" | "headless" | "headed";
  wait: boolean;
  timeout: number;
};

// Constants
const CHROME_CANDIDATES: Record<string, string[]> = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
  default: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ],
};

const CDP_CONNECT_TIMEOUT_MS = 15_000;
const NETWORK_IDLE_TIMEOUT_MS = 1_500;
const POST_LOAD_DELAY_MS = 800;
const SCROLL_STEP_WAIT_MS = 600;
const SCROLL_MAX_STEPS = 8;

const PROFILE_DIR = (() => {
  const override = process.env.WECHAT_CHROME_PROFILE_DIR?.trim();
  if (override) return path.resolve(override);
  const base = process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Application Support")
    : process.platform === "win32"
      ? (process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"))
      : (process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"));
  return path.join(base, "wechat-article-reader", "chrome-profile");
})();

// Utility functions

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findChrome(): string {
  const override = process.env.WECHAT_CHROME_PATH?.trim();
  if (override && fs.existsSync(override)) return override;
  const platform = process.platform as string;
  const candidates = CHROME_CANDIDATES[platform] ?? CHROME_CANDIDATES.default;
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error("Chrome 未找到。请安装 Chrome 或设置 WECHAT_CHROME_PATH 环境变量。");
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close(() => reject(new Error("无法分配端口")));
        return;
      }
      const port = addr.port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

// CdpConnection class

class CdpConnection {
  private ws: WebSocket;
  private nextId = 0;
  private pending = new Map<number, PendingRequest>();
  private eventHandlers = new Map<string, Set<(params: unknown) => void>>();
  private defaultTimeoutMs: number;

  private constructor(ws: WebSocket, defaultTimeoutMs = 15_000) {
    this.ws = ws;
    this.defaultTimeoutMs = defaultTimeoutMs;

    this.ws.addEventListener("message", (event) => {
      try {
        const data = typeof event.data === "string"
          ? event.data
          : new TextDecoder().decode(event.data as ArrayBuffer);
        const msg = JSON.parse(data) as {
          id?: number;
          method?: string;
          params?: unknown;
          result?: unknown;
          error?: { message?: string };
        };
        if (msg.method) {
          this.eventHandlers.get(msg.method)?.forEach((h) => h(msg.params));
        }
        if (msg.id) {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            if (p.timer) clearTimeout(p.timer);
            if (msg.error?.message) p.reject(new Error(msg.error.message));
            else p.resolve(msg.result);
          }
        }
      } catch {}
    });

    this.ws.addEventListener("close", () => {
      for (const [id, p] of this.pending.entries()) {
        this.pending.delete(id);
        if (p.timer) clearTimeout(p.timer);
        p.reject(new Error("CDP 连接已关闭"));
      }
    });
  }

  static async connect(url: string, timeoutMs: number): Promise<CdpConnection> {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP 连接超时")), timeoutMs);
      ws.addEventListener("open", () => { clearTimeout(timer); resolve(); });
      ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP 连接失败")); });
    });
    return new CdpConnection(ws);
  }

  on(method: string, handler: (params: unknown) => void): void {
    if (!this.eventHandlers.has(method)) this.eventHandlers.set(method, new Set());
    this.eventHandlers.get(method)!.add(handler);
  }

  off(method: string, handler: (params: unknown) => void): void {
    this.eventHandlers.get(method)?.delete(handler);
  }

  async send<T = unknown>(method: string, params?: Record<string, unknown>, options?: CdpSendOptions): Promise<T> {
    const id = ++this.nextId;
    const msg: Record<string, unknown> = { id, method };
    if (params) msg.params = params;
    if (options?.sessionId) msg.sessionId = options.sessionId;
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const result = await new Promise<unknown>((resolve, reject) => {
      const timer = timeoutMs > 0
        ? setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP 超时: ${method}`)); }, timeoutMs)
        : null;
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify(msg));
    });
    return result as T;
  }

  close(): void {
    try { this.ws.close(); } catch {}
  }
}

// Chrome lifecycle and page helpers

async function launchChrome(url: string, port: number, headless: boolean): Promise<ChildProcess> {
  const chromePath = findChrome();
  await fs.promises.mkdir(PROFILE_DIR, { recursive: true });
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${PROFILE_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
  ];
  if (headless) args.push("--headless=new");
  args.push(url);
  return spawn(chromePath, args, { stdio: "ignore" });
}

function killChrome(chrome: ChildProcess): void {
  try { chrome.kill("SIGTERM"); } catch {}
  setTimeout(() => {
    if (!chrome.killed) try { chrome.kill("SIGKILL"); } catch {}
  }, 2_000).unref?.();
}

async function waitForDebugPort(port: number, timeoutMs: number): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(3_000),
      });
      const data = await res.json() as { webSocketDebuggerUrl?: string };
      if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error("Chrome 调试端口未就绪");
}

async function findExistingPort(): Promise<number | null> {
  const portFile = path.join(PROFILE_DIR, "DevToolsActivePort");
  try {
    const content = fs.readFileSync(portFile, "utf-8");
    const port = Number.parseInt(content.split(/\r?\n/)[0]?.trim() ?? "", 10);
    if (port > 0) {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(3_000),
      });
      const data = await res.json() as { webSocketDebuggerUrl?: string };
      if (data.webSocketDebuggerUrl) return port;
    }
  } catch {}
  return null;
}

async function waitForPageLoad(cdp: CdpConnection, sessionId: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { cdp.off("Page.loadEventFired", handler); resolve(); }, timeoutMs);
    const handler = () => { clearTimeout(timer); cdp.off("Page.loadEventFired", handler); resolve(); };
    cdp.on("Page.loadEventFired", handler);
  });
}

async function waitForNetworkIdle(cdp: CdpConnection, sessionId: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending = 0;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      cdp.off("Network.requestWillBeSent", onReq);
      cdp.off("Network.loadingFinished", onDone);
      cdp.off("Network.loadingFailed", onDone);
    };
    const done = () => { cleanup(); resolve(); };
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(done, timeoutMs);
    };
    const onReq = () => { pending++; resetTimer(); };
    const onDone = () => { pending = Math.max(0, pending - 1); if (pending <= 2) resetTimer(); };
    cdp.on("Network.requestWillBeSent", onReq);
    cdp.on("Network.loadingFinished", onDone);
    cdp.on("Network.loadingFailed", onDone);
    resetTimer();
  });
}

async function evaluateScript<T>(cdp: CdpConnection, sessionId: string, expression: string, timeoutMs = 30_000): Promise<T> {
  const result = await cdp.send<{ result: { value?: T } }>(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    { sessionId, timeoutMs },
  );
  return result.result.value as T;
}

async function autoScroll(cdp: CdpConnection, sessionId: string): Promise<void> {
  let lastHeight = await evaluateScript<number>(cdp, sessionId, "document.body.scrollHeight");
  for (let i = 0; i < SCROLL_MAX_STEPS; i++) {
    await evaluateScript<void>(cdp, sessionId, "window.scrollTo(0, document.body.scrollHeight)");
    await sleep(SCROLL_STEP_WAIT_MS);
    const newHeight = await evaluateScript<number>(cdp, sessionId, "document.body.scrollHeight");
    if (newHeight === lastHeight) break;
    lastHeight = newHeight;
  }
  await evaluateScript<void>(cdp, sessionId, "window.scrollTo(0, 0)");
}

function waitForUserSignal(): Promise<void> {
  console.log("请在浏览器中完成验证，然后按 Enter 继续...");
  return new Promise((resolve) => {
    process.stdin.once("data", () => resolve());
    process.stdin.resume();
  });
}

// WeChat article extraction script (injected into browser)

const FENCE = "```";

const wechatExtractScript = String.raw`
(function() {
  // Handle lazy-loaded images
  document.querySelectorAll("img[data-src]").forEach(el => {
    const ds = el.getAttribute("data-src");
    if (ds && (!el.getAttribute("src") || el.getAttribute("src") === "" || el.getAttribute("src")?.startsWith("data:"))) {
      el.setAttribute("src", ds);
    }
  });

  const getText = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : "";
  };

  const getMeta = (prop) => {
    const el = document.querySelector('meta[property="' + prop + '"]') || document.querySelector('meta[name="' + prop + '"]');
    return el ? el.getAttribute("content")?.trim() || "" : "";
  };

  const title = getText("#activity-name") || getMeta("og:title") || document.title || "";
  const author = getText("#js_author_name") || getText(".rich_media_meta_text") || getMeta("author") || "";
  const account = getText("#js_name") || getText("#profileBt") || getMeta("og:site_name") || "";

  let publishDate = getText("#publish_time") || getMeta("article:published_time") || "";
  if (!publishDate) {
    const dateEl = document.querySelector("em#publish_time");
    if (dateEl) publishDate = dateEl.textContent.trim();
  }

  const coverImage = getMeta("og:image") || "";

  const contentEl = document.querySelector("#js_content");
  if (!contentEl) {
    return { error: "未找到文章正文（#js_content），文章可能已被删除或需要验证。" };
  }

  const removeSelectors = [
    ".qr_code_pc",
    "#js_pc_qr_code",
    ".rich_media_tool",
    "#js_tags",
    ".reward_area",
    "#content_bottom_area",
  ];
  const clone = contentEl.cloneNode(true);
  removeSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  function htmlToText(node) {
    let result = "";
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        result += child.textContent;
      } else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();
        if (tag === "br") {
          result += "\n";
        } else if (tag === "p" || tag === "div" || tag === "section") {
          const inner = htmlToText(child).trim();
          if (inner) result += "\n\n" + inner;
        } else if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
          const level = "#".repeat(parseInt(tag[1]));
          const inner = htmlToText(child).trim();
          if (inner) result += "\n\n" + level + " " + inner;
        } else if (tag === "strong" || tag === "b") {
          const inner = htmlToText(child).trim();
          if (inner) result += "**" + inner + "**";
        } else if (tag === "em" || tag === "i") {
          const inner = htmlToText(child).trim();
          if (inner) result += "*" + inner + "*";
        } else if (tag === "li") {
          const inner = htmlToText(child).trim();
          if (inner) result += "\n- " + inner;
        } else if (tag === "ul" || tag === "ol") {
          result += "\n" + htmlToText(child);
        } else if (tag === "blockquote") {
          const inner = htmlToText(child).trim();
          if (inner) result += "\n\n> " + inner.replace(/\n/g, "\n> ");
        } else if (tag === "img") {
          const src = child.getAttribute("data-src") || child.getAttribute("src") || "";
          const alt = child.getAttribute("alt") || "图片";
          if (src) result += "\n\n![" + alt + "](" + src + ")";
        } else if (tag === "a") {
          const href = child.getAttribute("href") || "";
          const inner = htmlToText(child).trim();
          if (inner && href) result += "[" + inner + "](" + href + ")";
          else if (inner) result += inner;
        } else if (tag === "table") {
          result += "\n\n" + extractTable(child);
        } else if (tag === "pre" || tag === "code") {
          const inner = child.textContent.trim();
          if (inner) result += "\n\n[代码]\n" + inner + "\n[/代码]";
        } else if (tag === "hr") {
          result += "\n\n---";
        } else if (tag !== "script" && tag !== "style" && tag !== "noscript") {
          result += htmlToText(child);
        }
      }
    }
    return result;
  }

  function extractTable(table) {
    const rows = table.querySelectorAll("tr");
    if (!rows.length) return "";
    let md = "";
    rows.forEach((row, i) => {
      const cells = row.querySelectorAll("td, th");
      const line = Array.from(cells).map(c => c.textContent.trim()).join(" | ");
      md += "| " + line + " |\n";
      if (i === 0) {
        md += "| " + Array.from(cells).map(() => "---").join(" | ") + " |\n";
      }
    });
    return md;
  }

  const content = htmlToText(clone).replace(/\n{3,}/g, "\n\n").trim();

  if (content.length < 50 && (document.body.textContent || "").includes("环境异常")) {
    return { error: "ANTI_CRAWL" };
  }

  return { title, author, account, publishDate, coverImage, content, url: location.href };
})()
`;

// Capture flow

type CaptureResult = ArticleData | { error: string };

async function captureOnce(args: Args, headless: boolean, wait: boolean, existingPort?: number): Promise<CaptureResult> {
  const reusing = existingPort !== undefined;
  const port = existingPort ?? await getFreePort();
  const chrome = reusing ? null : await launchChrome(args.url, port, headless);

  console.log(reusing ? `复用已有 Chrome (端口 ${port})` : `启动 Chrome (${headless ? "headless" : "headed"})...`);

  let cdp: CdpConnection | null = null;
  let targetId: string | null = null;

  try {
    const wsUrl = await waitForDebugPort(port, 30_000);
    cdp = await CdpConnection.connect(wsUrl, CDP_CONNECT_TIMEOUT_MS);

    let sessionId: string;
    if (reusing) {
      const created = await cdp.send<{ targetId: string }>("Target.createTarget", { url: args.url });
      targetId = created.targetId;
      const attached = await cdp.send<{ sessionId: string }>("Target.attachToTarget", { targetId, flatten: true });
      sessionId = attached.sessionId;
    } else {
      const targets = await cdp.send<{ targetInfos: Array<{ targetId: string; type: string; url: string }> }>("Target.getTargets");
      const page = targets.targetInfos.find(t => t.type === "page" && t.url.startsWith("http"));
      if (!page) throw new Error("未找到页面目标");
      targetId = page.targetId;
      const attached = await cdp.send<{ sessionId: string }>("Target.attachToTarget", { targetId, flatten: true });
      sessionId = attached.sessionId;
    }

    await cdp.send("Network.enable", {}, { sessionId });
    await cdp.send("Page.enable", {}, { sessionId });

    if (wait) {
      await waitForUserSignal();
    } else {
      console.log("等待页面加载...");
      await Promise.race([
        waitForPageLoad(cdp, sessionId, 15_000),
        sleep(8_000),
      ]);
      await waitForNetworkIdle(cdp, sessionId, NETWORK_IDLE_TIMEOUT_MS);
      await sleep(POST_LOAD_DELAY_MS);
      console.log("滚动页面触发懒加载...");
      await autoScroll(cdp, sessionId);
      await sleep(POST_LOAD_DELAY_MS);
    }

    console.log("提取文章内容...");
    const result = await evaluateScript<CaptureResult>(cdp, sessionId, wechatExtractScript, args.timeout);
    return result;
  } finally {
    if (reusing) {
      if (cdp && targetId) try { await cdp.send("Target.closeTarget", { targetId }, { timeoutMs: 5_000 }); } catch {}
      if (cdp) cdp.close();
    } else {
      if (cdp) {
        try { await cdp.send("Browser.close", {}, { timeoutMs: 5_000 }); } catch {}
        cdp.close();
      }
      if (chrome) killChrome(chrome);
    }
  }
}

async function capture(args: Args): Promise<ArticleData> {
  const existingPort = await findExistingPort();
  if (existingPort !== null) {
    console.log("发现已有 Chrome 会话，复用中...");
    const result = await captureOnce(args, false, args.wait, existingPort);
    if ("error" in result) {
      if (result.error === "ANTI_CRAWL") {
        console.log("检测到反爬验证，切换到 headed + wait 模式...");
        return capture({ ...args, browserMode: "headed", wait: true });
      }
      throw new Error(result.error);
    }
    return result;
  }

  if (args.wait) {
    const result = await captureOnce(args, false, true);
    if ("error" in result && result.error !== "ANTI_CRAWL") throw new Error(result.error);
    if ("error" in result) throw new Error("即使手动验证后仍无法获取文章内容");
    return result;
  }

  if (args.browserMode === "headed") {
    const result = await captureOnce(args, false, false);
    if ("error" in result) throw new Error(result.error);
    return result;
  }

  if (args.browserMode === "headless") {
    const result = await captureOnce(args, true, false);
    if ("error" in result) throw new Error(result.error);
    return result;
  }

  // auto mode: headless → headed → headed+wait
  try {
    const result = await captureOnce(args, true, false);
    if ("error" in result) {
      if (result.error === "ANTI_CRAWL") {
        console.log("检测到反爬验证，切换到可见浏览器 + 等待模式...");
        const retryResult = await captureOnce(args, false, true);
        if ("error" in retryResult) throw new Error(retryResult.error);
        return retryResult;
      }
      throw new Error(result.error);
    }
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`Headless 抓取失败: ${msg}`);
    console.log("重试：切换到可见浏览器...");
    const result = await captureOnce(args, false, false);
    if ("error" in result) {
      if (result.error === "ANTI_CRAWL") {
        console.log("检测到反爬验证，请在浏览器中完成验证...");
        const waitResult = await captureOnce(args, false, true);
        if ("error" in waitResult) throw new Error(waitResult.error);
        return waitResult;
      }
      throw new Error(result.error);
    }
    return result;
  }
}

// CLI entry point

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let url = "";
  let browserMode: "auto" | "headless" | "headed" = "auto";
  let wait = false;
  let timeout = 30_000;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--browser" && argv[i + 1]) {
      browserMode = argv[++i] as "auto" | "headless" | "headed";
    } else if (arg === "--headless") {
      browserMode = "headless";
    } else if (arg === "--headed") {
      browserMode = "headed";
    } else if (arg === "--wait") {
      wait = true;
    } else if (arg === "--timeout" && argv[i + 1]) {
      timeout = Number.parseInt(argv[++i], 10);
    } else if (!arg.startsWith("-") && !url) {
      url = arg;
    }
  }

  if (!url) {
    console.error("用法: main.ts <微信文章URL> [--browser auto|headless|headed] [--wait] [--timeout ms]");
    process.exit(1);
  }

  if (!url.includes("mp.weixin.qq.com")) {
    console.error("错误: 仅支持微信公众号文章链接 (mp.weixin.qq.com)");
    process.exit(1);
  }

  return { url, browserMode, wait, timeout };
}

async function main() {
  const args = parseArgs();
  console.log(`抓取: ${args.url}`);
  console.log(`模式: ${args.browserMode}${args.wait ? " + wait" : ""}`);

  try {
    const article = await capture(args);
    console.log("---JSON_START---");
    console.log(JSON.stringify(article, null, 2));
    console.log("---JSON_END---");
  } catch (e) {
    console.error(`抓取失败: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

main();
