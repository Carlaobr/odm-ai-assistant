
# IBM ODM AI Assistant — Integracao com o Decision Center

Este guia explica como incorporar um chatbot de IA nativamente dentro do IBM ODM 9.5 Decision Center Business Console como uma aba real — ao lado de Regras, Testes, Simulacoes e Implementacoes.

Compativel com OpenAI, Anthropic Claude, Google Gemini e IBM WatsonX.
<img width="1917" height="991" alt="image" src="https://github.com/user-attachments/assets/8a220907-0eb0-444f-8beb-ed5aca40bf27" />

---

[English version](./README.md)

---

## Indice

1. [Arquitetura](#arquitetura)
2. [Visao geral dos arquivos](#visao-geral-dos-arquivos)
3. [Pre-requisitos](#pre-requisitos)
4. [Passo 1 — Configurar o Proxy JSP](#passo-1--configurar-o-proxy-jsp)
5. [Passo 2 — Configurar a Extensao](#passo-2--configurar-a-extensao)
6. [Passo 3 — Gerar os arquivos](#passo-3--gerar-os-arquivos)
7. [Passo 4 — Implantar no container](#passo-4--implantar-no-container)
8. [Passo 5 — Ativar no Decision Center](#passo-5--ativar-no-decision-center)
9. [Referencia de configuracao por LLM](#referencia-de-configuracao-por-llm)
10. [Funcionalidades](#funcionalidades)
11. [Atualizando](#atualizando)
12. [Solucao de problemas](#solucao-de-problemas)

---

## Arquitetura

O IBM Liberty (servidor que executa o Decision Center) aplica um cabecalho `Content-Security-Policy` que impede o JavaScript do browser de chamar dominios externos. A solucao roteia todas as chamadas ao LLM por um servlet JSP rodando dentro do proprio Liberty:

```
Browser (aba do Decision Center)
        |
        |  POST /gpt-proxy/chat.jsp        <- mesma origem, sem restricao de CSP
        v
Proxy JSP (dentro do Liberty, mesmo container)
        |
        |  curl -k (HTTPS, lado servidor)
        v
API do LLM  (OpenAI / Claude / Gemini / WatsonX)
        |
        +-------------------------------> Resposta de volta ao browser
```

---

## Visao geral dos arquivos

```
odm-ai-assistant/
|-- README.md                        <- Versao em ingles
|-- README.pt-BR.md                  <- Este arquivo (Portugues)
|-- chat.jsp                         <- Proxy JSP — CONFIGURAR AQUI
|-- AIAssistantEntryPoint.js         <- Extensao do Decision Center — CONFIGURAR AQUI
|-- build.py                         <- Empacota os dois arquivos em .war e .jar
|-- gpt-proxy.war                    <- (saida) Implantar em Liberty dropins/
`-- ai-odm-assistant.jar             <- (saida) Implantar em /config/customlib/
```

**Dois arquivos sao implantados no container:**

| Arquivo | Onde vai | O que faz |
|---------|----------|-----------|
| `gpt-proxy.war` | `/opt/ibm/wlp/usr/servers/defaultServer/dropins/` | Proxy JSP que encaminha requisicoes para a API do LLM |
| `ai-odm-assistant.jar` | `/config/customlib/` | Extensao Dojo que adiciona a aba de IA ao Decision Center |

---

## Pre-requisitos

- IBM ODM 9.5 rodando em Docker ou Podman
- Decision Center acessivel (ex.: `http://localhost:9060/decisioncenter`)
- Python 3 instalado localmente (para rodar o `build.py`)
- Uma chave de API para o provedor de LLM escolhido
- `curl` instalado dentro do container (presente na maioria das imagens IBM — verifique com `docker exec <container> which curl`)

Este guia comeca do ponto onde voce ja tem o ODM rodando e consegue fazer login no Decision Center.

---

## Passo 1 — Configurar o Proxy JSP

Abra `chat.jsp` e edite as **linhas 30 e 31**:

```java
final String KEY = "SUA_CHAVE_API_AQUI";            /* <-- ALTERE */
final String API = "https://api.openai.com/v1/chat/completions"; /* <-- ALTERE */
```

Substitua `SUA_CHAVE_API_AQUI` pela sua chave de API.
Substitua a URL pelo endpoint correto do seu provedor.

Consulte [Referencia de configuracao por LLM](#referencia-de-configuracao-por-llm) para os valores exatos de cada provedor.

**Somente para Claude** — atualize tambem os cabecalhos curl nas linhas 76-82:

```java
String[] cmd = {
    "curl", "-s", "-k",
    "-X", "POST",
    "-H", "x-api-key: " + KEY,              // Claude usa x-api-key, nao Authorization
    "-H", "anthropic-version: 2023-06-01",   // Obrigatorio no Claude
    "-H", "Content-Type: application/json",
    "--data-binary", "@" + tmp.getAbsolutePath(),
    API
};
```

---

## Passo 2 — Configurar a Extensao

Abra `AIAssistantEntryPoint.js` e edite as seguintes secoes:

### 2a. Nome do modelo (linha ~13)

```javascript
var MDL = 'gpt-4o-mini';   // ALTERE: identificador do modelo do seu LLM
```

Identificadores por provedor:

| Provedor | String do modelo |
|----------|----------------|
| OpenAI | `'gpt-4o-mini'` ou `'gpt-4o'` |
| Anthropic | `'claude-sonnet-4-6'` ou `'claude-haiku-4-5'` |
| Gemini | Modelo definido na URL do `chat.jsp`, nao aqui |
| WatsonX | Modelo definido no `chat.jsp`, nao aqui |

### 2b. Prompt do sistema (linhas ~30 a ~60)

O prompt do sistema informa a IA sobre o seu projeto ODM. Edite o array `SYS_BASE`:

```javascript
var SYS_BASE = [
    'You are an IBM ODM AI Assistant embedded in IBM ODM 9.5 Decision Center.',
    '',
    // ALTERE: nome do seu projeto e o que ele faz
    'PROJECT: NOME_DO_PROJETO — descricao.',
    '',
    // ALTERE: todos os campos do seu objeto ODM
    'FIELDS: CAMPO1, CAMPO2, CAMPO3, ...',
    '',
    // ALTERE: nome do objeto ODM e campo de resultado
    'ODM OBJECT: "o scoring" | RESULT FIELD: "decisao" (String)',
    '',
    // ALTERE: descreva cada pasta de regras e quando ela executa
    'RULE FOLDERS (run in order):',
    '  01_Politicas_de_Bloqueio — antes do ML: regra A, regra B',
    '  02_Analise_de_Credito   — regras financeiras: regra C, regra D',
    '  03_Decisao_Final        — usa saida do ML: aprovar / reprovar',
    '',
    // ALTERE: forneca um exemplo IRL real do seu projeto
    'IRL SYNTAX (pt_BR):',
    'se [CONDICAO]    entao [ACAO] ;',
    '',
    'Sempre responda no idioma selecionado pelo usuario.',
    'Formate codigo IRL em blocos ```irl.',
    'Especifique em qual pasta cada nova regra pertence.',
    'Analise qualquer captura de tela que o usuario enviar.'
].join('\n');
```

Quanto mais detalhes voce incluir, mais preciso e util sera o assistente para o seu projeto especifico.

### 2c. Somente para Claude — formato do corpo da requisicao

Claude usa uma estrutura JSON diferente. Encontre a funcao `callAPI` em `AIAssistantEntryPoint.js` e substitua a linha `body`:

```javascript
// Formato padrao (OpenAI):
body: JSON.stringify({model: MDL, messages: msgs, max_tokens: 1800, temperature: 0.25})

// Formato Claude:
body: JSON.stringify({
    model: MDL,
    max_tokens: 1800,
    messages: msgs.filter(function(m){ return m.role !== 'system'; }),
    system: msgs.find(function(m){ return m.role === 'system'; }).content
})
```

### 2d. Somente para Gemini — formato do corpo e parsing da resposta

```javascript
// Corpo Gemini:
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

// Parsing da resposta Gemini (no callback .then()):
if (d.candidates && d.candidates[0]) {
    onOk(d.candidates[0].content.parts[0].text);
}
```

---

## Passo 3 — Gerar os arquivos

Execute o script de build para empacotar os arquivos fonte editados:

```bash
python build.py
```

Isso cria dois arquivos no diretorio atual:
- `gpt-proxy.war`
- `ai-odm-assistant.jar`

---

## Passo 4 — Implantar no container

### 4a. Criar os diretorios necessarios

```bash
# Docker
docker exec <nome_container> sh -c "mkdir -p /opt/ibm/wlp/usr/servers/defaultServer/dropins"
docker exec <nome_container> sh -c "mkdir -p /config/customlib"

# Podman
podman exec <nome_container> sh -c "mkdir -p /opt/ibm/wlp/usr/servers/defaultServer/dropins"
podman exec <nome_container> sh -c "mkdir -p /config/customlib"
```

Substitua `<nome_container>` pelo nome real do seu container (ex.: `odm95`).

### 4b. Implantar o proxy JSP

```bash
# Docker
docker cp gpt-proxy.war <nome_container>:/opt/ibm/wlp/usr/servers/defaultServer/dropins/gpt-proxy.war

# Podman
podman cp gpt-proxy.war <nome_container>:/opt/ibm/wlp/usr/servers/defaultServer/dropins/gpt-proxy.war
```

O Liberty monitora o diretorio `dropins` e implanta aplicacoes automaticamente. Aguarde aproximadamente 15 segundos.

Verifique se o WAR foi implantado — este comando deve retornar JSON, nao uma pagina 404:

```bash
curl http://localhost:9060/gpt-proxy/chat.jsp
```

### 4c. Implantar o JAR de extensao

```bash
# Docker
docker cp ai-odm-assistant.jar <nome_container>:/config/customlib/ai-odm-assistant.jar

# Podman
podman cp ai-odm-assistant.jar <nome_container>:/config/customlib/ai-odm-assistant.jar
```

O Liberty verifica `/config/customlib/` a cada 5 segundos e carrega novos JARs automaticamente. Aguarde 10 segundos.

---

## Passo 5 — Ativar no Decision Center

Este passo registra a extensao para que o Decision Center a carregue ao abrir uma ramificacao.

**5a.** Abra o Decision Center no browser e clique em **Administracao** na navegacao superior.

<img width="956" height="496" alt="Captura de tela 2026-06-25 202906" src="https://github.com/user-attachments/assets/e34877e5-c5a6-4c89-b82d-a67ba62a05d2" />


**5b.** Clique em **Configuracoes**, depois em **Configuracoes Personalizadas**.

<img width="958" height="485" alt="image" src="https://github.com/user-attachments/assets/a4e996fa-dd51-4888-b8fa-a8dade1f85d7" />


**5c.** Clique no botao para adicionar uma nova configuracao (rotulado "Registrar" ou "Incluir", dependendo da versao). Preencha os campos exatamente como mostrado:
<img width="955" height="482" alt="image" src="https://github.com/user-attachments/assets/bffc2401-5354-4441-bd94-39ab1c3b473b" />

| Campo | Valor |
|-------|-------|
| Nome da configuracao | `decisioncenter.web.core.extensions.entrypoints` |
| Valor padrao | *(deixe em branco)* |

Depois clique em **Incluir**.

> [Captura de tela: dialogo de Configuracoes Personalizadas com o campo nome preenchido]

**5d.** Uma nova linha aparece com um campo de valor editavel. Defina o valor como:

```
extensions/AIAssistantEntryPoint
```

Clique em **Salvar** ou pressione Enter.

> [Captura de tela: lista de Configuracoes Personalizadas mostrando a entrada com seu valor definido]

**5e.** Na navegacao superior, clique em **Biblioteca**. Abra seu projeto e clique em qualquer ramificacao (ex.: `principal`).

A barra de abas agora mostra uma aba adicional: **Assistente IA**.

> [Captura de tela: visao de branch do Decision Center mostrando a aba Assistente IA ao lado de Regras, Testes, Simulacoes e Implementacoes]

---

## Referencia de configuracao por LLM

### OpenAI

```
chat.jsp linha 30: final String KEY = "sk-proj-...";
chat.jsp linha 31: final String API = "https://api.openai.com/v1/chat/completions";
AIAssistantEntryPoint.js linha 13: var MDL = 'gpt-4o-mini';
```

Formato da chave: `sk-proj-...` ou `sk-...` (legado).
Obtenha sua chave em: https://platform.openai.com/api-keys

---

### Anthropic Claude

```
chat.jsp linha 30: final String KEY = "sk-ant-api03-...";
chat.jsp linha 31: final String API = "https://api.anthropic.com/v1/messages";
AIAssistantEntryPoint.js linha 13: var MDL = 'claude-sonnet-4-6';
```

Tambem atualize os cabecalhos curl do `chat.jsp` (linhas 76-82) e o formato do corpo em `AIAssistantEntryPoint.js` conforme descrito no Passo 2c.

Formato da chave: `sk-ant-...`
Obtenha sua chave em: https://console.anthropic.com

---

### Google Gemini (nivel gratuito disponivel)

```
chat.jsp linha 30: final String KEY = "AIzaSy...";
chat.jsp linha 31: final String API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + KEY;
AIAssistantEntryPoint.js linha 13: var MDL = 'gemini-1.5-flash'; (apenas informativo)
```

Tambem atualize o formato do corpo e o parsing da resposta conforme descrito no Passo 2d.

Nivel gratuito: 15 requisicoes/minuto, 1 milhao de tokens/dia — sem necessidade de pagamento.
Obtenha sua chave em: https://aistudio.google.com

---

### IBM WatsonX.ai

O WatsonX requer autenticacao em duas etapas. Adicione ao `chat.jsp` antes do curl principal:

```java
// Passo 1: obter token IAM
final String IAM_KEY = "SUA_CHAVE_IBM_CLOUD";
String[] tokenCmd = {"curl","-s","-k","-X","POST",
    "https://iam.cloud.ibm.com/identity/token",
    "-H","Content-Type: application/x-www-form-urlencoded",
    "-d","grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=" + IAM_KEY};
Process tokenProc = new ProcessBuilder(tokenCmd).start();
// leia a saida, extraia o campo access_token
String bearer = "..."; // access_token extraido

// Passo 2: chamar o modelo
final String API = "https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29";
// Use bearer como valor do cabecalho Authorization
```

Obtenha sua chave em: https://cloud.ibm.com — Gerenciar -> Acesso -> Chaves de API

---

## Funcionalidades

- Aba nativa no Decision Center — sem janelas externas ou extensoes de browser
- Interface em multiplos idiomas — Ingles, Portugues (Brasil), Frances — troca com um menu dropdown
- Historico de conversas — salvo no localStorage do browser, com busca e restauracao
- Anexar imagens — via botao de clipe ou colar com Ctrl+V
- Exportar — baixe qualquer conversa como arquivo .txt
- Modo escuro e claro
- Regenerar — re-execute a ultima resposta da IA
- Botao de copiar em cada mensagem e bloco de codigo
- Compativel com OpenAI, Claude, Gemini e WatsonX

---

## Atualizando

Quando alterar `chat.jsp` ou `AIAssistantEntryPoint.js`, reconstrua e reimplante:

```bash
# 1. Reconstruir
python build.py

# 2. Deletar o WAR antigo (forcas recompilacao do JSP — importante!)
docker exec <nome_container> rm /opt/ibm/wlp/usr/servers/defaultServer/dropins/gpt-proxy.war

# 3. Aguardar 3 segundos
sleep 3

# 4. Implantar as novas versoes
docker cp gpt-proxy.war        <nome_container>:/opt/ibm/wlp/usr/servers/defaultServer/dropins/gpt-proxy.war
docker cp ai-odm-assistant.jar <nome_container>:/config/customlib/ai-odm-assistant.jar
```

Sempre delete o WAR antigo antes de copiar o novo. O Liberty armazena em cache os JSPs compilados e nao recompilara se o arquivo for simplesmente sobrescrito.

---

## Solucao de problemas

### A aba de IA aparece branca ou em branco

O JavaScript da extensao tem um erro que derruba o carregador de modulos do Dojo. Abra as Ferramentas do Desenvolvedor (F12) e verifique o Console.

Se voce editou `AIAssistantEntryPoint.js`, verifique a sintaxe:

```bash
node --check AIAssistantEntryPoint.js
```

### Erro "Failed to fetch" no chat

O proxy JSP nao esta respondendo. Verifique:

```bash
curl http://localhost:9060/gpt-proxy/chat.jsp
# Deve retornar JSON, nao uma pagina 404
```

```bash
docker logs <nome_container> --tail 30
```

O WAR antigo foi deletado antes de implantar o novo?

### Erro de API 401 — Unauthorized

Sua chave de API esta errada, expirada ou nao foi definida na linha 30 do `chat.jsp`. Teste a chave diretamente:

```bash
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer SUA_CHAVE" | head -c 200
```

### Erro de certificado SSL (PKIX path building failed)

O IBM JVM dentro do container nao confia no certificado SSL do provedor de LLM. O proxy `chat.jsp` usa `curl -k` para contornar isso. Certifique-se de que o flag `-k` esteja presente no array de comandos curl na linha 77 do `chat.jsp`.

### O chat para de responder e fica com o indicador girando

Ocorreu um erro de JavaScript no `callAPI` antes do fetch ser completado. Verifique o Console do DevTools (F12) em busca de TypeErrors. Cause mais comum: formato incorreto do corpo da requisicao para o LLM escolhido. Verifique o Passo 2.

### A aba de IA nao aparece apos configurar o Custom Settings

Confirme que o valor esta definido exatamente como:

```
extensions/AIAssistantEntryPoint
```

Sem espacos, sem aspas, sem caracteres extras. Tambem confirme que o JAR esta em `/config/customlib/` dentro do container e que o Liberty terminou de carrega-lo (aguarde 10 segundos apos copiar).

---

## Licenca

MIT
