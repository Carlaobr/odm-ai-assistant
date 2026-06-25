<%--
  ============================================================
  FILE: chat.jsp
  ROLE: JSP proxy — runs inside IBM Liberty, receives requests
        from the Decision Center browser tab and forwards them
        to the LLM API using curl (server-side HTTPS call).

  WHY A JSP PROXY?
  IBM Liberty enforces Content-Security-Policy on all pages it
  serves. That policy blocks browser JavaScript from calling
  external APIs directly (openai.com, anthropic.com, etc.).
  Running the HTTP call inside Liberty's JVM bypasses this
  restriction because server-to-server calls are not subject
  to browser CSP.

  HOW TO CONFIGURE:
  - Lines 30-31: set your API key and endpoint URL
  - Lines 76-82: (optional) adjust curl flags if needed

  HOW TO PACKAGE:
  After editing, run build.py to repackage into gpt-proxy.war.
  ============================================================
--%>
<%@ page import="java.io.*" contentType="application/json; charset=UTF-8" pageEncoding="UTF-8" %><%

/* ============================================================
   CORS HEADERS
   Allow the Decision Center page (same Liberty host, different
   port or context) to call this endpoint.
   ============================================================ */
response.setHeader("Access-Control-Allow-Origin",  "*");
response.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
response.setHeader("Cache-Control", "no-store");

if ("OPTIONS".equals(request.getMethod())) {
    response.setStatus(200);
    return;
}

/* ============================================================
   CONFIGURATION — EDIT THESE TWO LINES
   ============================================================
   KEY : Your LLM provider API key.
         OpenAI  → "sk-proj-..." or "sk-..."
         Claude  → "sk-ant-api03-..."
         Gemini  → "AIzaSy..."  (also appears in the URL below)
         WatsonX → IBM Cloud API key (IAM exchange required)

   API : The completions endpoint for your chosen provider.
         OpenAI  → "https://api.openai.com/v1/chat/completions"
         Claude  → "https://api.anthropic.com/v1/messages"
         Gemini  → "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + KEY
         WatsonX → "https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29"
   ============================================================ */
final String KEY = "YOUR_API_KEY_HERE";            /* <-- CHANGE */
final String API = "https://api.openai.com/v1/chat/completions"; /* <-- CHANGE */

/* ============================================================
   READ REQUEST BODY
   The browser sends a JSON payload (model + messages array).
   We read it here and forward it unchanged to the LLM API.
   ============================================================ */
BufferedReader br = request.getReader();
StringBuilder sb = new StringBuilder();
String ln;
while ((ln = br.readLine()) != null) sb.append(ln);
String body = sb.toString();

if (body.isEmpty()) {
    response.setStatus(400);
    response.getOutputStream().write("{\"error\":{\"message\":\"empty body\"}}".getBytes("UTF-8"));
    return;
}

/* ============================================================
   WRITE BODY TO TEMP FILE
   We write the JSON payload to a temp file and pass it to curl
   with --data-binary @file. This avoids shell-escaping issues
   with JSON strings that contain quotes, newlines, etc.
   ============================================================ */
File tmp = null;
try {
    tmp = File.createTempFile("llm_", ".json");
    tmp.deleteOnExit();
    FileOutputStream fos = new FileOutputStream(tmp);
    fos.write(body.getBytes("UTF-8"));
    fos.close();

    /* ============================================================
       CURL COMMAND
       -s : silent (no progress bar)
       -k : skip SSL certificate verification (required for IBM JVM,
            whose trust store does not include all public CAs)
       -X POST : HTTP method
       -H ... : request headers (Authorization, Content-Type)
       --data-binary @file : read body from temp file

       NOTE: If you are using Claude, replace the -H headers with:
         -H "x-api-key: YOUR_KEY"
         -H "anthropic-version: 2023-06-01"
         -H "content-type: application/json"
       ============================================================ */
    String[] cmd = {
        "curl", "-s", "-k",
        "-X", "POST",
        "-H", "Authorization: Bearer " + KEY,
        "-H", "Content-Type: application/json",
        "--data-binary", "@" + tmp.getAbsolutePath(),
        API
    };

    Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();

    /* Read raw bytes — avoids any charset conversion that would corrupt UTF-8 */
    InputStream is = p.getInputStream();
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    byte[] buf = new byte[4096];
    int n;
    while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
    p.waitFor();
    is.close();

    byte[] result = baos.toByteArray();
    if (result.length == 0) {
        result = ("{\"error\":{\"message\":\"curl returned empty response." +
                  " Exit code: " + p.exitValue() + "\"}}").getBytes("UTF-8");
    }

    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.getOutputStream().write(result);
    response.getOutputStream().flush();

} catch (Exception ex) {
    String msg = (ex.getMessage() == null ? "null" : ex.getMessage())
                 .replace("\"", "'").replace("\n", " ");
    response.getOutputStream()
            .write(("{\"error\":{\"message\":\"" + ex.getClass().getSimpleName()
                    + ": " + msg + "\"}}").getBytes("UTF-8"));
} finally {
    if (tmp != null) tmp.delete();
}
%>
