# IBM ODM AI Assistant — Decision Center Integration

This guide explains how to embed an AI chatbot natively inside the IBM Operational Decision Manager 9.5 Decision Center Business Console as a real tab — alongside Rules, Tests, Simulations, and Deployments.

Compatible with OpenAI, Anthropic Claude, Google Gemini, and IBM WatsonX.

<img width="1917" height="991" alt="image" src="https://github.com/user-attachments/assets/69d55e93-7872-48cf-8bc0-31d3ef3b85fd" />

---

[Versao em Portugues](./README.pt-BR.md)

---

## Table of Contents

1. [Architecture](#architecture)
2. [Files Overview](#files-overview)
3. [Prerequisites](#prerequisites)
4. [Step 1 — Configure the JSP Proxy](#step-1--configure-the-jsp-proxy)
5. [Step 2 — Configure the Extension](#step-2--configure-the-extension)
6. [Step 3 — Build the files](#step-3--build-the-files)
7. [Step 4 — Deploy to the container](#step-4--deploy-to-the-container)
8. [Step 5 — Activate in Decision Center](#step-5--activate-in-decision-center)
9. [LLM Configuration Reference](#llm-configuration-reference)
10. [Features](#features)
11. [Updating](#updating)
12. [Troubleshooting](#troubleshooting)

---

## Architecture

IBM Liberty (the server running Decision Center) enforces a `Content-Security-Policy` header that blocks browser JavaScript from calling external domains. The solution routes all LLM calls through a JSP servlet running inside Liberty itself:

```
Browser (Decision Center tab)
        |
        |  POST /gpt-proxy/chat.jsp        <- same origin, no CSP restriction
        v
JSP Proxy (inside Liberty, same container)
        |
        |  curl -k (server-side HTTPS)
        v
LLM API  (OpenAI / Claude / Gemini / WatsonX)
        |
        +-------------------------------> Response back to browser
```

---

## Files Overview

```
odm-ai-assistant/
|-- README.md                        <- This file (English)
|-- README.pt-BR.md                  <- Portuguese version
|-- chat.jsp                         <- JSP proxy source — CONFIGURE HERE
|-- AIAssistantEntryPoint.js         <- Decision Center extension — CONFIGURE HERE
|-- build.py                         <- Packages both files into .war and .jar
|-- gpt-proxy.war                    <- (output) Deploy to Liberty dropins/
`-- ai-odm-assistant.jar             <- (output) Deploy to /config/customlib/
```

**Two files are deployed to the container:**

| File | Where it goes | What it does |
|------|---------------|--------------|
| `gpt-proxy.war` | `/opt/ibm/wlp/usr/servers/defaultServer/dropins/` | JSP proxy that forwards requests to the LLM API |
| `ai-odm-assistant.jar` | `/config/customlib/` | Dojo extension that adds the AI tab to Decision Center |

---

## Prerequisites

- IBM ODM 9.5 running in Docker or Podman
- Decision Center accessible (e.g., `http://localhost:9060/decisioncenter`)
- Python 3 installed locally (to run `build.py`)
- An API key for your chosen LLM provider
- `curl` installed inside the container (present in most IBM base images — verify with `docker exec <container> which curl`)

This guide starts from the point where you already have ODM running and can log into Decision Center. If you need to set up ODM from scratch, refer to the [official IBM documentation](https://www.ibm.com/docs/en/odm/9.5.0).

---

## Step 1 — Configure the JSP Proxy

Open `chat.jsp` and edit **lines 30 and 31**:

```java
final String KEY = "YOUR_API_KEY_HERE";            /* <-- CHANGE */
final String API = "https://api.openai.com/v1/chat/completions"; /* <-- CHANGE */
```

Replace `YOUR_API_KEY_HERE` with your LLM API key.
Replace the URL with the correct endpoint for your provider.

See [LLM Configuration Reference](#llm-configuration-reference) for the exact values per provider.

**For Claude only** — also update the curl headers on lines 76-82:

```java
String[] cmd = {
    "curl", "-s", "-k",
    "-X", "POST",
    "-H", "x-api-key: " + KEY,              // Claude uses x-api-key, not Authorization
    "-H", "anthropic-version: 2023-06-01",   // Required by Claude
    "-H", "Content-Type: application/json",
    "--data-binary", "@" + tmp.getAbsolutePath(),
    API
};
```

---

## Step 2 — Configure the Extension

Open `AIAssistantEntryPoint.js` and edit the following sections:

### 2a. Model name (line ~13)

```javascript
var MDL = 'gpt-4o-mini';   // CHANGE: your LLM model identifier
```

Model identifiers per provider:

| Provider | Model string |
|----------|-------------|
| OpenAI | `'gpt-4o-mini'` or `'gpt-4o'` |
| Anthropic | `'claude-sonnet-4-6'` or `'claude-haiku-4-5'` |
| Gemini | Model is set in `chat.jsp` URL, leave this as a placeholder |
| WatsonX | Model is set in `chat.jsp`, leave this as a placeholder |

### 2b. System prompt (lines ~30 to ~60)

The system prompt tells the AI about your ODM project. Edit the `SYS_BASE` array — each line is one instruction to the AI:

```javascript
var SYS_BASE = [
    'You are an IBM ODM AI Assistant embedded in IBM ODM 9.5 Decision Center.',
    '',
    // CHANGE: your project name and what it does
    'PROJECT: YOUR_PROJECT_NAME — description.',
    '',
    // CHANGE: all field names your ODM object contains
    'FIELDS: FIELD1, FIELD2, FIELD3, ...',
    '',
    // CHANGE: your ODM object name and decision result field name
    'ODM OBJECT: "your object" | RESULT FIELD: "decision" (String)',
    '',
    // CHANGE: describe each rule folder and when it runs
    'RULE FOLDERS (run in order):',
    '  01_Blocking_Policies — runs before ML: rule A, rule B',
    '  02_Credit_Analysis   — financial rules: rule C, rule D',
    '  03_Final_Decision    — uses ML output: approve / reject',
    '',
    // CHANGE: provide a real IRL example from your project
    'IRL SYNTAX:',
    'if [CONDITION]    then [ACTION] ;',
    '',
    'Always respond in the language selected by the user.',
    'Format IRL code in ```irl code blocks.',
    'Specify which folder each new rule belongs to.',
    'Analyze any screenshot the user sends.'
].join('\n');
```

The more detail you put here, the more accurate and useful the AI will be for your specific project.

### 2c. For Claude only — request body format

Claude uses a different JSON structure. In `AIAssistantEntryPoint.js`, find the `callAPI` function and replace the `body` line:

```javascript
// Default (OpenAI format):
body: JSON.stringify({model: MDL, messages: msgs, max_tokens: 1800, temperature: 0.25})

// Claude format:
body: JSON.stringify({
    model: MDL,
    max_tokens: 1800,
    messages: msgs.filter(function(m){ return m.role !== 'system'; }),
    system: msgs.find(function(m){ return m.role === 'system'; }).content
})
```

### 2d. For Gemini only — request body format and response parsing

Gemini uses `contents` instead of `messages`. Replace the body and add response parsing:

```javascript
// Gemini body:
body: JSON.stringify({
    system_instruction: { parts: [{ text: sysPrompt }] },
    contents: msgs.filter(function(m){ return m.role !== 'system'; }).map(function(m){
        return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof m.content === 'string' ? m.content : m.content[0].text }]
        };
    }),
    generationConfig: { temperature: 0.25, maxOutputTokens: 1800 }
})

// Gemini response parsing (in the .then() callback):
if (d.candidates && d.candidates[0]) {
    onOk(d.candidates[0].content.parts[0].text);
}
```

---

## Step 3 — Build the Files

Run the build script to package your edited source files into deployable artifacts:

```bash
python build.py
```

This creates two files in the current directory:
- `gpt-proxy.war`
- `ai-odm-assistant.jar`

Verify that `build.py` ran without errors before proceeding.

---

## Step 4 — Deploy to the Container

### 4a. Create the required directories

```bash
# Docker
docker exec <container_name> sh -c "mkdir -p /opt/ibm/wlp/usr/servers/defaultServer/dropins"
docker exec <container_name> sh -c "mkdir -p /config/customlib"

# Podman
podman exec <container_name> sh -c "mkdir -p /opt/ibm/wlp/usr/servers/defaultServer/dropins"
podman exec <container_name> sh -c "mkdir -p /config/customlib"
```

Replace `<container_name>` with your actual container name (e.g., `odm95`).

### 4b. Deploy the JSP proxy

```bash
# Docker
docker cp gpt-proxy.war <container_name>:/opt/ibm/wlp/usr/servers/defaultServer/dropins/gpt-proxy.war

# Podman
podman cp gpt-proxy.war <container_name>:/opt/ibm/wlp/usr/servers/defaultServer/dropins/gpt-proxy.war
```

Liberty monitors the `dropins` directory and deploys applications automatically. Wait approximately 15 seconds.

Verify the WAR is deployed — this should return a JSON error (not a 404):

```bash
curl http://localhost:9060/gpt-proxy/chat.jsp
```

### 4c. Deploy the extension JAR

```bash
# Docker
docker cp ai-odm-assistant.jar <container_name>:/config/customlib/ai-odm-assistant.jar

# Podman
podman cp ai-odm-assistant.jar <container_name>:/config/customlib/ai-odm-assistant.jar
```

Liberty scans `/config/customlib/` every 5 seconds and loads new JARs automatically. Wait 10 seconds.

---

## Step 5 — Activate in Decision Center

This step registers the extension so Decision Center loads it when opening a branch.

**5a.** Open Decision Center in your browser and click **Administration** in the top navigation.

<img width="1912" height="991" alt="image" src="https://github.com/user-attachments/assets/a39d9a87-ccfc-4fd4-a544-451da121dc69" />


**5b.** Click **Settings**, then click **Custom Settings**.

<img width="1915" height="970" alt="image" src="https://github.com/user-attachments/assets/e7a79060-17cc-4421-afd3-0d85762caae9" />


**5c.** Click the button to add a new setting (labeled "Register" or "Add", depending on your version). Fill in the fields exactly as shown:

<img width="1909" height="964" alt="image" src="https://github.com/user-attachments/assets/45f7e4b5-708d-4dc4-b3b9-a1f7f1546713" />


| Field | Value |
|-------|-------|
| Name of the setting | `decisioncenter.web.core.extensions.entrypoints` |
| Default value | *(leave empty)* |

Then click **Include** (or **Add**).

<img width="1907" height="994" alt="image" src="https://github.com/user-attachments/assets/a45b5c9f-c318-4124-b3ea-55d8e72557b6" />



**5d.** A new row appears with an editable value field. Set the value to:

```
extensions/AIAssistantEntryPoint
```

Click **Save** or press Enter.

<img width="1918" height="958" alt="image" src="https://github.com/user-attachments/assets/b06e2dd4-8c3c-4e5a-a8be-4bcce833c955" />


**5e.** In the top navigation, click **Library**. Open your project, then click any branch (e.g., `main` or `principal`).

The tab bar now shows an additional tab: **Assistente IA** (or **AI Assistant** depending on the language setting).

<img width="1919" height="990" alt="image" src="https://github.com/user-attachments/assets/2c388408-6ce0-4d23-b332-f129af8415cd" />


---

## LLM Configuration Reference

### OpenAI

```
chat.jsp line 30: final String KEY = "sk-proj-...";
chat.jsp line 31: final String API = "https://api.openai.com/v1/chat/completions";
AIAssistantEntryPoint.js line 13: var MDL = 'gpt-4o-mini';
```

API key format: `sk-proj-...` (project keys) or `sk-...` (legacy).
Get your key at: https://platform.openai.com/api-keys

---

### Anthropic Claude

```
chat.jsp line 30: final String KEY = "sk-ant-api03-...";
chat.jsp line 31: final String API = "https://api.anthropic.com/v1/messages";
AIAssistantEntryPoint.js line 13: var MDL = 'claude-sonnet-4-6';
```

Also update `chat.jsp` curl headers (lines 76-82) — replace `Authorization: Bearer` with `x-api-key` and add `anthropic-version`.

Also update the request body format in `AIAssistantEntryPoint.js` as described in Step 2c.

API key format: `sk-ant-...`
Get your key at: https://console.anthropic.com

---

### Google Gemini (free tier available)

```
chat.jsp line 30: final String KEY = "AIzaSy...";
chat.jsp line 31: final String API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + KEY;
AIAssistantEntryPoint.js line 13: var MDL = 'gemini-1.5-flash'; (informational only — model is set in the URL)
```

Also update the request body and response parsing in `AIAssistantEntryPoint.js` as described in Step 2d.

Free tier: 15 requests/minute, 1 million tokens/day — no payment required.
Get your key at: https://aistudio.google.com

---

### IBM WatsonX.ai

WatsonX requires a two-step authentication: exchange your IBM Cloud API key for a Bearer token, then call the model.

Add this to `chat.jsp` before the main curl call:

```java
// Step 1: get IAM token
final String IAM_KEY = "YOUR_IBM_CLOUD_API_KEY";
String[] tokenCmd = {"curl","-s","-k","-X","POST",
    "https://iam.cloud.ibm.com/identity/token",
    "-H","Content-Type: application/x-www-form-urlencoded",
    "-d","grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=" + IAM_KEY};
Process tokenProc = new ProcessBuilder(tokenCmd).start();
// read output, parse the access_token field with a JSON library or simple substring
String bearer = "..."; // extracted access_token

// Step 2: call the model
final String API = "https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29";
// Use bearer as the Authorization header value
```

Get your API key at: https://cloud.ibm.com — Manage -> Access -> API Keys

---

## Features

- Native tab in Decision Center — no external windows or browser extensions
- Multi-language UI — English, Portuguese (Brazil), French — switch with a dropdown button
- Conversation history — saved to browser localStorage, searchable, restorable
- Image attachment — attach screenshots via the paperclip button or Ctrl+V paste
- Export — download any conversation as a .txt file
- Dark and light mode
- Regenerate — re-run the last AI response
- Copy button on every message and code block
- Compatible with OpenAI, Claude, Gemini, and WatsonX

---

## Updating

When you change `chat.jsp` or `AIAssistantEntryPoint.js`, rebuild and redeploy:

```bash
# 1. Rebuild
python build.py

# 2. Delete old WAR first (forces JSP recompilation — important!)
docker exec <container_name> rm /opt/ibm/wlp/usr/servers/defaultServer/dropins/gpt-proxy.war

# 3. Wait 3 seconds
sleep 3

# 4. Deploy new versions
docker cp gpt-proxy.war        <container_name>:/opt/ibm/wlp/usr/servers/defaultServer/dropins/gpt-proxy.war
docker cp ai-odm-assistant.jar <container_name>:/config/customlib/ai-odm-assistant.jar
```

Always delete the old WAR before copying the new one. Liberty caches compiled JSPs and will not recompile if the file is simply overwritten in place.

---

## Troubleshooting

### The AI tab appears white or blank

The extension JavaScript has an error that crashes Dojo's module loader. Open browser DevTools (F12) and check the Console tab for red error messages.

If you edited `AIAssistantEntryPoint.js`, verify its syntax:

```bash
node --check AIAssistantEntryPoint.js
```

Fix any reported errors, rebuild, and redeploy.

### "Failed to fetch" error in the chat

The JSP proxy is not responding. Check:

1. Is the WAR deployed and running?

```bash
curl http://localhost:9060/gpt-proxy/chat.jsp
# Should return JSON, not a 404 page
```

2. Check Liberty logs for deployment errors:

```bash
docker logs <container_name> --tail 30
```

3. Did you delete the old WAR before deploying the new one?

### API error 401 — Unauthorized

Your API key is wrong, expired, or was not set in `chat.jsp` line 30. Test the key directly:

```bash
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_KEY" | head -c 200
```

### SSL certificate error (PKIX path building failed)

The IBM JVM inside the container does not trust the LLM provider's SSL certificate. The `chat.jsp` proxy uses `curl -k` to bypass this. Make sure the `-k` flag is present in the curl command array on line 77 of `chat.jsp`.

### The chat stops responding and shows a spinning indicator forever

The API call is throwing an exception before the fetch completes. Most common cause: a JavaScript error in the `callAPI` function, often from an incorrect request body format for the chosen LLM. Open DevTools (F12) -> Console and look for TypeErrors or syntax errors. Check that your model identifier and request body format match your LLM provider (see Step 2).

### The Custom Settings entry is not showing the AI tab

Make sure the value is set to exactly:

```
extensions/AIAssistantEntryPoint
```

No spaces, no quotes, no trailing characters. Also confirm that the JAR is deployed to `/config/customlib/` inside the container and that Liberty finished loading it (wait 10 seconds after copying).

---

## License

MIT
