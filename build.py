"""
build.py — packages chat.jsp into gpt-proxy.war
           and AIAssistantEntryPoint.js into ai-odm-assistant.jar

Run:  python build.py

Both output files are created in the current directory.
"""
import zipfile, os

# ── gpt-proxy.war ────────────────────────────────────────────────────────────
WEB_XML = """<?xml version="1.0" encoding="UTF-8"?>
<web-app version="3.1"
  xmlns="http://xmlns.jcp.org/xml/ns/javaee"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee
                      http://xmlns.jcp.org/xml/ns/javaee/web-app_3_1.xsd">
  <display-name>LLM Proxy for IBM ODM Decision Center</display-name>
</web-app>"""

with open("chat.jsp", "r", encoding="utf-8") as f:
    jsp_content = f.read()

with zipfile.ZipFile("gpt-proxy.war", "w", zipfile.ZIP_DEFLATED) as war:
    war.writestr("WEB-INF/web.xml", WEB_XML)
    war.writestr("chat.jsp", jsp_content)

print("Created: gpt-proxy.war")

# ── ai-odm-assistant.jar ─────────────────────────────────────────────────────
MANIFEST = "Manifest-Version: 1.0\nCreated-By: ODM AI Assistant\n"
PREFERENCES = "core.extensions.entrypoints=extensions/AIAssistantEntryPoint\n"

with open("AIAssistantEntryPoint.js", "r", encoding="utf-8") as f:
    js_content = f.read()

with zipfile.ZipFile("ai-odm-assistant.jar", "w", zipfile.ZIP_DEFLATED) as jar:
    jar.writestr("META-INF/MANIFEST.MF", MANIFEST)
    jar.writestr("extensions/AIAssistantEntryPoint.js", js_content)
    jar.writestr(
        "com/ibm/rules/decisioncenter/web/preferences.properties",
        PREFERENCES
    )

print("Created: ai-odm-assistant.jar")
print()
print("Next steps:")
print("  docker cp gpt-proxy.war         <container>:/opt/ibm/wlp/usr/servers/defaultServer/dropins/")
print("  docker cp ai-odm-assistant.jar  <container>:/config/customlib/")
