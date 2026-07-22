---
name: ultimate-browsing
description: >
  Escalation skill for blocked or hard-to-reach web access — load it when a normal
  browse/fetch is blocked (WAF, 403, Cloudflare, JS-only render, login-gated, or a
  platform a generic fetcher cannot read). Tiered router: TIER 1 headless extraction
  (curl, yt-dlp, Jina Reader, public APIs); TIER 1.5 platform-native readers (Chinese
  and social platforms via curl/gh); TIER 2 real browser interaction via agent-browser
  (preferred, CLI-native) with playwright MCP as comprehensive fallback (JS execution,
  console logs, iframe access, cookie manipulation, screenshots). Triggers: blocked
  site, bypass bot detection, cloudflare/WAF bypass, scrape, stealth browser, import
  cookies, fill form, screenshot, play youtube, xiaohongshu, douyin, weibo, bilibili,
  v2ex, wechat article, podcast transcript. NOT for simple searches or plain fetches.
---

# Ultimate Browsing

Escalation web access for tasks a normal browse or fetch cannot complete. Reach for
this skill the moment a page is blocked (WAF / 403 / Cloudflare), needs JS rendering,
hides behind a login, or lives on a platform a generic fetcher cannot read. Escalate
only when the cheaper tier cannot do the job:

**Tier 1** (headless extraction) → **Tier 1.5** (platform-native APIs) → **Tier 2**
(real browser: `agent-browser` preferred, `playwright` MCP for comprehensive needs).

## PHASE 0 — ROUTE FIRST (MANDATORY)

```
User request
  |
  +- extract text/data from a URL --------------------- TIER 1  curl/Jina
  +- URL blocked / 403 / Cloudflare / WAF ------------- TIER 1  curl + TLS
  +- YouTube/Vimeo/TikTok subtitles or metadata ------- TIER 1  yt-dlp
  +- read an article / blog / Reddit / HN / arXiv ----- TIER 1  curl/APIs
  |
  +- Chinese platform (xhs/douyin/weibo/bilibili/v2ex)  TIER 1.5 native APIs
  +- podcast transcript / stock forum ----------------- TIER 1.5 native APIs
  +- Twitter feed / LinkedIn / GitHub via CLI --------- TIER 1.5 gh/curl
  |
  +- Tier 1/1.5 returned empty or partial ------------- TIER 2  browser
  +- click / fill form / scroll / interact ------------ TIER 2  browser
  +- screenshot / render / play video ----------------- TIER 2  browser
  +- login session across pages / inject cookies ------ TIER 2  browser
  +- test web app / QA / dogfood ---------------------- TIER 2  browser
  +- execute JS / read console logs / iframes --------- TIER 2  playwright
  |
  +- simple search query ------------------------------ NOT this skill
```

## Tier 1 — Headless extraction

**When**: content extraction, blocked-URL bypass, media metadata — no browser UI needed.
**Why first**: ~10x faster than a browser, no process spin-up.

```bash
# Basic fetch with curl (try mobile UA for WAF bypass):
curl -sL -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" "https://example.com/page"

# TLS impersonation with curl_cffi (if available, bypasses Cloudflare):
python3 -c "from curl_cffi import requests; r=requests.get('https://example.com', impersonate='chrome'); print(r.text)" 2>/dev/null || curl -sL "$URL"

# Jina Reader (extracts clean text from any URL):
curl -s "https://r.jina.ai/https://example.com/article"

# YouTube subtitles / metadata (no browser):
yt-dlp --write-sub --write-auto-sub --sub-lang "en,ko" --skip-download -o "/tmp/%(id)s" "$URL"
yt-dlp --dump-json "$URL"  # metadata only

# Reddit .json API (no auth needed):
curl -s "https://www.reddit.com/r/programming/hot.json?limit=10" -H "User-Agent: Mozilla/5.0"

# HN Firebase API:
curl -s "https://hacker-news.firebaseio.com/v0/topstories.json"

# arXiv API:
curl -s "http://export.arxiv.org/api/query?search_query=all:electron&max_results=5"
```

### Escalate to Tier 1.5 or Tier 2 when
- The target is a Chinese / social platform with a native reader → Tier 1.5.
- Tier 1 returns empty/partial, or the page needs JS interaction, a screenshot,
  a persistent login, or media playback → Tier 2.

## Tier 1.5 — Platform-native readers

**When**: the target is a platform with a first-class API/CLI that beats generic fetching.

```bash
# Weibo via Jina Reader:
curl -s "https://r.jina.ai/https://weibo.com/<uid>/<pid>"

# Bilibili metadata:
yt-dlp --dump-json "<bilibili-url>"  # overseas: add --cookies-from-browser

# V2EX public API:
curl -s "https://www.v2ex.com/api/topics/hot.json"

# GitHub via gh CLI:
gh api repos/<owner>/<repo>/issues --paginate
gh api repos/<owner>/<repo>/contents/<path>

# Twitter/X syndication (public tweets):
curl -s "https://syndication.twitter.com/srv/timeline-profile/screen-name/<handle>"

# Douyin video info (via yt-dlp):
yt-dlp --dump-json "<douyin-url>"
```

## Tier 2 — Real browser interaction

**When**: real interaction is needed (clicks, forms, screenshots, video, persistent
login), or Tier 1/1.5 failed.

### TIER 2A — agent-browser (PREFERRED)

`agent-browser` is a CLI-native browser automation tool. Use it first for most
browser tasks — it's simpler, chains well in bash, and doesn't require MCP round-trips.

```bash
# Navigate and snapshot interactive elements:
agent-browser open "https://example.com/login"
agent-browser wait --load networkidle
agent-browser snapshot -i
# Output: @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Submit"

# Fill form and submit:
agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --load networkidle

# Check result:
agent-browser snapshot -i

# Screenshot:
agent-browser screenshot /tmp/result.png

# Extract text:
agent-browser text

# Close when done:
agent-browser close
```

**Key agent-browser commands:**

| Command | Purpose |
|---------|---------|
| `agent-browser open <url>` | Navigate (aliases: goto, navigate) |
| `agent-browser snapshot -i` | Interactive elements with refs (@eN) |
| `agent-browser click @eN` | Click element |
| `agent-browser fill @eN "text"` | Clear and type text |
| `agent-browser type @eN "text"` | Type without clearing |
| `agent-browser select @eN "opt"` | Select dropdown option |
| `agent-browser screenshot <path>` | Take screenshot |
| `agent-browser text` | Get visible text content |
| `agent-browser wait --load networkidle` | Wait for network idle |
| `agent-browser scroll down 500` | Scroll page |
| `agent-browser hover @eN` | Hover element |
| `agent-browser close` | Close browser |

**Command chaining** (for speed):
```bash
agent-browser open "https://example.com" && agent-browser wait --load networkidle && agent-browser snapshot -i
agent-browser fill @e1 "user@example.com" && agent-browser fill @e2 "pass" && agent-browser click @e3
```

### TIER 2B — Playwright MCP (COMPREHENSIVE FALLBACK)

Use `playwright` MCP tools when you need capabilities agent-browser lacks:
- **Execute JavaScript** in the page context
- **Read console logs** (errors, warnings, exceptions)
- **Interact with iframes** (fill elements inside iframes)
- **Upload files** to file input elements
- **Take element-specific screenshots** (CSS selector-scoped)
- **Control browser type** (chromium, firefox, webkit)
- **Set viewport size** explicitly

```bash
# Navigate (via use_tool with playwright__playwright_navigate):
#   url: "https://example.com"
#   browserType: "chromium" (default), "firefox", or "webkit"
#   headless: false (default), true for no UI
#   waitUntil: "networkidle"

# Click element (via playwright__playwright_click):
#   selector: "button#submit"

# Fill input (via playwright__playwright_fill):
#   selector: "input[name=email]"
#   value: "user@example.com"

# Screenshot (via playwright__playwright_screenshot):
#   name: "result"
#   fullPage: true  (entire page)
#   savePng: true   (save to file)
#   selector: "#content"  (element-specific)

# Get visible text (via playwright__playwright_get_visible_text):
#   (no params — returns all visible text)

# Execute JavaScript (via playwright__playwright_evaluate):
#   script: "document.title"

# Read console logs (via playwright__playwright_console_logs):
#   type: "error"  (filter to errors only)

# Upload file (via playwright__playwright_upload_file):
#   selector: "input[type=file]"
#   filePath: "/tmp/upload.csv"

# Close browser (via playwright__playwright_close):
#   (no params)
```

### When to use which Tier 2 tool

| Need | Use |
|------|-----|
| Navigate, click, fill, screenshot | `agent-browser` (simpler, CLI-native) |
| Form filling with element refs | `agent-browser` (snapshot -i gives @eN refs) |
| Quick page text extraction | `agent-browser text` |
| Execute JavaScript in page | `playwright` (`playwright_evaluate`) |
| Read console errors/logs | `playwright` (`playwright_console_logs`) |
| Interact with iframe content | `playwright` (`playwright_iframe_fill`) |
| Upload files | `playwright` (`playwright_upload_file`) |
| Element-specific screenshot | `playwright` (`playwright_screenshot` with selector) |
| Multiple browser engines | `playwright` (chromium/firefox/webkit) |
| Cookie injection via JS | `playwright` (`playwright_evaluate` with document.cookie) |

### Cookie login (cross-platform)

For login-gated content, use playwright to inject cookies via JavaScript:

```javascript
// Via playwright_evaluate:
document.cookie = "session=abc123; path=/; domain=.example.com"
// Then navigate to the gated page
```

Or use agent-browser with a pre-authenticated session:
```bash
# Open login page, fill credentials, submit, then navigate to gated content:
agent-browser open "https://example.com/login"
agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password"
agent-browser click @e3
agent-browser wait --load networkidle
# Now authenticated — navigate to the gated page:
agent-browser open "https://example.com/dashboard"
agent-browser screenshot /tmp/dashboard.png
```

## Anti-patterns

- Do NOT launch a browser for plain text extraction — use Tier 1 (curl/Jina).
- Do NOT use playwright when agent-browser suffices — agent-browser is faster to invoke.
- Do NOT forget to `close` the browser session when done (both agent-browser and playwright).
- Do NOT inject cookies without reloading the page afterward.
- Do NOT use `tmux capture-pane` for visual evidence — use `screenshot` for true color fidelity.
- Do NOT pass credentials in command-line arguments visible in process lists — use fill commands.
