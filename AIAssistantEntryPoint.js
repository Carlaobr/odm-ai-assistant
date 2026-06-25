
define(['dojo/_base/declare','dojo/_base/lang','dojo/dom',
        'com/ibm/rules/decisioncenter/extensions/ExtensionMixin'],
function(declare,lang,dom,ExtensionMixin){

/* ── CONFIG ── */
var MDL      = 'gpt-4o-mini';
var PROXY    = '/gpt-proxy/chat.jsp';
var SESS_KEY = 'oa-session';
var HIST_KEY = 'oa-history';
var MAX_HIST = 60;

/* ── SYSTEM PROMPT ── */
var SYS_BASE = [
    /* ============================================================
       SYSTEM PROMPT — Edit these lines to match your ODM project.

       WHAT TO CHANGE:
       - Line below: your project name and business domain
       - "FIELDS" line: all input field names your rules use
       - "FOLDERS" line: your rule folder structure and what each does
       - "IRL SYNTAX" block: example rules from your project
       - Remove or add lines as needed

       HOW THE LANGUAGE LINE WORKS:
       The last line appends the selected language automatically.
       Do not change it — the UI language selector controls it.
       ============================================================ */
    'You are an IBM ODM AI Assistant embedded in IBM ODM 9.5 Decision Center Business Console.',
    '',
    /* CHANGE: Replace with your project name and description */
    'PROJECT: YOUR_PROJECT_NAME — brief description of what the project does.',
    '',
    /* CHANGE: List all fields in your ODM object */
    'FIELDS: FIELD1, FIELD2, FIELD3, FIELD4, ...',
    '',
    /* CHANGE: Replace with your actual object name and result field */
    'ODM OBJECT: "the object" | RESULT FIELD: "decision" (String)',
    '',
    /* CHANGE: Describe your folder structure */
    'RULE FOLDERS (run in order):',
    '  01_Blocking_Policies — runs before any ML call: rule A, rule B, rule C',
    '  02_Credit_Analysis   — financial risk rules: rule D, rule E',
    '  03_Final_Decision    — uses ML prediction: approve, reject, manual review',
    '',
    /* CHANGE: Provide a real IRL syntax example from your project */
    'IRL SYNTAX (language matches your project locale):',
    'if [CONDITION]    then [ACTION] ;',
    '',
    'RULES:',
    'Always respond in the language selected by the user.',
    'Format IRL code in ```irl code blocks.',
    'Always specify which folder a new rule belongs to.',
    'When debugging a decision, trace through all folders in order.',
    'Analyze any screenshot or image the user sends.'
].join('\n');\n

/* ── TRANSLATIONS ── */
var T={
  en:{wh:'How can I help?',ws:'IRL rules and credit specialist · ODM 9.5',
    c1:'List all project rules',c2:'How does the decision flow work?',
    c3:'Create a new blocking rule',c4:'Client rejected with score 750 — why?',
    ph:'Ask about rules, IRL, credit… (Enter sends | Ctrl+V pastes image)',
    sbt:'Conversation History',nc:'+ New conversation',sr:'Search conversations…',
    tod:'Today',yes:'Yesterday',noh:'No conversations saved yet.\nStart a chat!',
    del:'Delete this conversation?',clr:'Clear current conversation? It will be saved to history.',
    cpt:'Copied!',cpb:'Copy',aph:'Photo / Image',afl:'Text file',aps:'Use Ctrl+V to paste image',
    dk:'Dark mode',lt:'Light mode',er:'Error:',exh:'ODM AI Assistant — Conversation Log',
    exn:'No messages to export.',sl:'English'},
  pt:{wh:'Como posso ajudar?',ws:'Especialista em regras IRL e credito · ODM 9.5',
    c1:'Listar todas as regras do projeto',c2:'Como funciona o fluxo de decisao?',
    c3:'Criar nova regra de bloqueio',c4:'Cliente reprovado com score 750 — por que?',
    ph:'Pergunte sobre regras, IRL, credito… (Enter envia | Ctrl+V cola imagem)',
    sbt:'Historico de Conversas',nc:'+ Nova conversa',sr:'Pesquisar conversas…',
    tod:'Hoje',yes:'Ontem',noh:'Nenhuma conversa salva ainda.\nComece um bate-papo!',
    del:'Excluir esta conversa?',clr:'Limpar conversa? Sera salva no historico.',
    cpt:'Copiado!',cpb:'Copiar',aph:'Foto / Imagem',afl:'Arquivo de texto',aps:'Use Ctrl+V para colar imagem',
    dk:'Modo escuro',lt:'Modo claro',er:'Erro:',exh:'Assistente IA ODM — Historico',
    exn:'Nenhuma mensagem para exportar.',sl:'Brazilian Portuguese'},
  fr:{wh:'Comment puis-je aider ?',ws:'Spécialiste en règles IRL et crédit · ODM 9.5',
    c1:'Lister toutes les règles du projet',c2:'Comment fonctionne le flux de décision ?',
    c3:'Créer une nouvelle règle de blocage',c4:'Client refusé avec score 750 — pourquoi ?',
    ph:'Questions sur les règles, IRL… (Entrée envoie | Ctrl+V colle une image)',
    sbt:'Historique des Conversations',nc:'+ Nouvelle conversation',sr:'Rechercher des conversations…',
    tod:"Aujourd'hui",yes:'Hier',noh:'Aucune conversation sauvegardée.\nCommencez !',
    del:'Supprimer cette conversation ?',clr:"Effacer la conversation actuelle ? Elle sera sauvegardée.",
    cpt:'Copié !',cpb:'Copier',aph:'Photo / Image',afl:'Fichier texte',aps:'Utilisez Ctrl+V pour coller une image',
    dk:'Mode sombre',lt:'Mode clair',er:'Erreur :',exh:'Assistante IA ODM — Historique',
    exn:'Aucun message à exporter.',sl:'French'}
};
var LORDER=['en','pt','fr'];
function t(k){return(T[S.lang]&&T[S.lang][k])||T.en[k]||k;}
function applyLang(lang){
  if(!T[lang])return;S.lang=lang;
  try{localStorage.setItem('oa-lang',lang);}catch(e){}
  var b=document.getElementById('oa-lang-btn');if(b)b.innerHTML=lang.toUpperCase()+' &#9662;';['en','pt','fr'].forEach(function(l){var o=document.getElementById('oa-opt-'+l);if(o)o.className='oa-lang-opt'+(l===lang?' sel':'');});
  var e;
  e=document.getElementById('oa-wlc-h');if(e)e.textContent=t('wh');
  e=document.getElementById('oa-wlc-s');if(e)e.textContent=t('ws');
  e=document.getElementById('oa-c1');if(e)e.textContent=t('c1');
  e=document.getElementById('oa-c2');if(e)e.textContent=t('c2');
  e=document.getElementById('oa-c3');if(e)e.textContent=t('c3');
  e=document.getElementById('oa-c4');if(e)e.textContent=t('c4');
  e=document.getElementById('oa-ta');if(e)e.placeholder=t('ph');
  e=document.getElementById('oa-sb-title');if(e)e.textContent=t('sbt');
  e=document.getElementById('oa-new-btn');if(e)e.textContent=t('nc');
  e=document.getElementById('oa-search-inp');if(e)e.placeholder=t('sr');
  e=document.getElementById('oa-photo');if(e)e.textContent=t('aph');
  e=document.getElementById('oa-file');if(e)e.textContent=t('afl');
  e=document.getElementById('oa-paste-btn');if(e)e.textContent=t('aps');
  e=document.getElementById('oa-theme');if(e)e.title=S.theme==='dark'?t('lt'):t('dk');
  renderSidebar();
}


/* ── ICONS ── */
var IC={
sun:'<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
moon:'<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
trash:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
copy:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
like:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
send:'<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
attach:'<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
regen:'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.41"/></svg>',
down:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
hist:'<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
export_:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
};

/* ── CSS ── */
var CSS=[
'@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap");',
'#AIAssistantTab{height:100%!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;}',
'.oa *{box-sizing:border-box;margin:0;padding:0;}',
'.oa{--p:#0f62fe;--ph:#0043ce;--ps:#edf4ff;--hdr:#243642;--ubg:#243642;--utxt:#fff;--abg:#fff;--atxt:#161616;--cbg:#f0f4f8;--ctxt:#21272a;--bg:#f4f4f4;--surf:#fff;--surf2:#f4f4f4;--txt:#161616;--txt2:#525252;--txt3:#8d8d8d;--txti:#fff;--bdr:#e0e0e0;--bdr2:#c6c6c6;--chipbg:#edf4ff;--chiptxt:#0043ce;--chipbdr:#c9deff;--ok:#24a148;--err:#da1e28;--errbg:#fff1f1;display:flex;flex-direction:column;overflow:hidden;position:relative;font-family:"IBM Plex Sans",-apple-system,"Helvetica Neue",sans-serif;font-size:14px;line-height:1.5;color:var(--txt);background:var(--bg);}',
'.oa[data-theme="dark"]{--bg:#161616;--surf:#262626;--surf2:#1e1e1e;--hdr:#0d1c26;--ubg:#0d1c26;--txt:#f4f4f4;--txt2:#c6c6c6;--txt3:#6f6f6f;--bdr:#393939;--bdr2:#525252;--abg:#262626;--atxt:#f4f4f4;--cbg:#1e2433;--ctxt:#a8c4e8;--chipbg:#001d6c;--chiptxt:#97c1ff;--chipbdr:#1e4ab0;--ps:#001d6c;--errbg:#2d0709;}',
/* HEADER */
'.oa-hdr{display:flex;align-items:center;padding:0 14px;height:46px;background:var(--hdr);color:var(--txti);gap:10px;flex-shrink:0;}',
'.oa-logo{display:flex;align-items:center;gap:7px;}',
'.oa-logo-ibm{font-weight:700;font-size:12px;color:#5b9bd5;letter-spacing:.12em;}',
'.oa-logo-sep{color:rgba(255,255,255,0.2);font-size:15px;font-weight:200;}',
'.oa-logo-name{font-size:13px;font-weight:500;color:rgba(255,255,255,0.88);}',
'.oa-proj{font-size:10px;color:rgba(255,255,255,0.38);background:rgba(255,255,255,0.07);padding:2px 7px;border-radius:3px;font-family:"IBM Plex Mono",monospace;margin-left:2px;}',
'.oa-hdr-r{display:flex;gap:2px;margin-left:auto;position:relative;}',
'.oa-ibtn{width:30px;height:30px;background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:.15s;}',
'.oa-ibtn:hover{background:rgba(255,255,255,0.1);color:#fff;}',
/* SIDEBAR */
'.oa-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.25);z-index:300;display:none;}',
'.oa-overlay.show{display:block;}',
'.oa-sidebar{position:absolute;left:0;top:0;bottom:0;width:270px;background:var(--surf);border-right:1px solid var(--bdr);z-index:400;transform:translateX(-100%);transition:transform .22s ease;display:flex;flex-direction:column;box-shadow:4px 0 20px rgba(0,0,0,0.12);}',
'.oa-sidebar.open{transform:translateX(0);}',
'.oa-sb-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--bdr);flex-shrink:0;}',
'.oa-sb-title{font-weight:600;font-size:13px;color:var(--txt);}',
'.oa-sb-hdr-btns{display:flex;gap:4px;}',
'.oa-sb-btn{background:none;border:none;cursor:pointer;color:var(--txt3);padding:3px;border-radius:4px;display:flex;align-items:center;transition:.15s;}',
'.oa-sb-btn:hover{color:var(--p);background:var(--ps);}',
'.oa-sb-close{font-size:18px;line-height:1;color:var(--txt3);background:none;border:none;cursor:pointer;}',
'.oa-sb-actions{padding:10px 12px;display:flex;flex-direction:column;gap:7px;border-bottom:1px solid var(--bdr);flex-shrink:0;}',
'.oa-new-btn{background:var(--p);color:#fff;border:none;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:12.5px;font-family:inherit;font-weight:500;transition:.15s;text-align:left;}',
'.oa-new-btn:hover{background:var(--ph);}',
'.oa-search-inp{border:1px solid var(--bdr2);border-radius:6px;padding:7px 10px;font-size:12.5px;font-family:inherit;color:var(--txt);background:var(--surf2);outline:none;width:100%;transition:.15s;}',
'.oa-search-inp:focus{border-color:var(--p);}',
'.oa-conv-list{flex:1;overflow-y:auto;padding:4px 0;}',
'.oa-conv-list::-webkit-scrollbar{width:4px;}',
'.oa-conv-list::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px;}',
'.oa-conv-group{font-size:10px;font-weight:600;color:var(--txt3);padding:8px 14px 3px;text-transform:uppercase;letter-spacing:.05em;}',
'.oa-conv-item{padding:9px 36px 9px 12px;cursor:pointer;position:relative;transition:background .1s;border-left:3px solid transparent;}',
'.oa-conv-item:hover{background:var(--surf2);}',
'.oa-conv-item.active{background:var(--ps);border-left-color:var(--p);}',
'.oa-conv-user{font-size:11px;font-weight:600;color:var(--txt3);margin-bottom:2px;}',
'.oa-conv-preview{font-size:12px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;}',
'.oa-conv-meta{font-size:10px;color:var(--txt3);}',
'.oa-conv-del{position:absolute;top:50%;right:8px;transform:translateY(-50%);background:none;border:none;color:var(--txt3);cursor:pointer;font-size:15px;padding:3px;opacity:0;transition:.15s;line-height:1;}',
'.oa-conv-item:hover .oa-conv-del{opacity:1;}',
'.oa-conv-del:hover{color:var(--err);}',
'.oa-conv-empty{text-align:center;color:var(--txt3);font-size:12px;padding:28px 16px;line-height:1.6;}',
/* CHAT */
'.oa-chat{flex:1;min-height:0;overflow-y:auto;padding:16px 16px 8px;display:flex;flex-direction:column;gap:12px;background:var(--bg);position:relative;}',
'.oa-chat::-webkit-scrollbar{width:4px;}',
'.oa-chat::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px;}',
'.oa-dn{position:absolute;bottom:10px;right:10px;width:30px;height:30px;background:var(--surf);border:1px solid var(--bdr2);border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.13);cursor:pointer;display:none;align-items:center;justify-content:center;color:var(--txt2);z-index:10;}',
'.oa-dn:hover{background:var(--p);color:#fff;border-color:var(--p);}',
'.oa-dn.show{display:flex;}',
'.oa-wlc{text-align:center;padding:18px 0 2px;}',
'.oa-wlc-h{font-size:19px;font-weight:600;color:var(--txt);letter-spacing:-.02em;}',
'.oa-wlc-s{font-size:12px;color:var(--txt3);margin-top:4px;}',
'.oa-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:2px 0 4px;}',
'.oa-chip{padding:7px 12px;border:1px solid var(--chipbdr);background:var(--chipbg);color:var(--chiptxt);border-radius:5px;cursor:pointer;font-size:11.5px;font-family:inherit;transition:.15s;}',
'.oa-chip:hover{background:var(--p);border-color:var(--p);color:#fff;}',
/* MESSAGES */
'.oa-msg{display:flex;gap:8px;max-width:92%;animation:oaIn .18s ease;}',
'@keyframes oaIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
'.oa-mu{align-self:flex-end;flex-direction:row-reverse;}',
'.oa-ma{align-self:flex-start;}',
'.oa-av{width:25px;height:25px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:3px;}',
'.oa-avu{background:var(--ubg);color:var(--utxt);}',
'.oa-ava{background:var(--hdr);color:#fff;border:1px solid rgba(255,255,255,0.12);}',
'.oa-body{flex:1;min-width:0;}',
'.oa-cnt{padding:9px 13px;border-radius:11px;word-break:break-word;font-size:13.5px;line-height:1.65;}',
'.oa-mu .oa-cnt{background:var(--ubg);color:var(--utxt);border-bottom-right-radius:3px;}',
'.oa-ma .oa-cnt{background:var(--abg);color:var(--atxt);border-bottom-left-radius:3px;border:1px solid var(--bdr);box-shadow:0 1px 3px rgba(0,0,0,0.05);}',
'.oa-foot{display:flex;align-items:center;gap:5px;margin-top:3px;padding:0 2px;}',
'.oa-time{font-size:10px;color:var(--txt3);}',
'.oa-acts{display:flex;gap:1px;opacity:0;transition:.15s;}',
'.oa-msg:hover .oa-acts{opacity:1;}',
'.oa-act{width:24px;height:24px;background:none;border:none;color:var(--txt3);cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;position:relative;transition:.15s;}',
'.oa-act:hover{background:var(--ps);color:var(--p);}',
'.oa-act.liked{color:var(--p);}',
'.oa-act.liked svg{fill:var(--p);}',
'.oa-tip{position:absolute;bottom:calc(100%+4px);left:50%;transform:translateX(-50%);background:#161616;color:#fff;font-size:10px;padding:2px 6px;border-radius:3px;white-space:nowrap;pointer-events:none;opacity:0;transition:.15s;}',
'.oa-tip.show{opacity:1;}',
'.oa-mimg{margin-bottom:5px;border-radius:7px;overflow:hidden;max-width:220px;}',
'.oa-mimg img{width:100%;display:block;}',
/* MARKDOWN */
'.oa-cnt p{margin:3px 0;}',
'.oa-cnt h3,.oa-cnt h4{font-size:13.5px;font-weight:600;margin:8px 0 3px;}',
'.oa-cnt ul,.oa-cnt ol{padding-left:16px;margin:4px 0;}',
'.oa-cnt li{margin:2px 0;}',
'.oa-cnt a{color:var(--p);text-decoration:none;}',
'.oa-cnt a:hover{text-decoration:underline;}',
'.oa-ic{font-family:"IBM Plex Mono",monospace;font-size:11.5px;background:var(--cbg);color:var(--ctxt);padding:1px 4px;border-radius:3px;}',
'.oa-mu .oa-ic{background:rgba(255,255,255,0.15);color:#fff;}',
'.oa-cb{margin:7px 0;border-radius:5px;overflow:hidden;border:1px solid var(--bdr);}',
'.oa-cbh{display:flex;align-items:center;justify-content:space-between;background:var(--cbg);padding:4px 10px;border-bottom:1px solid var(--bdr);}',
'.oa-cbl{font-size:10px;color:var(--txt2);font-family:"IBM Plex Mono",monospace;}',
'.oa-cbc{font-size:11px;color:var(--p);background:none;border:none;cursor:pointer;padding:2px 4px;border-radius:3px;font-family:inherit;transition:.15s;}',
'.oa-cbc:hover{background:var(--ps);}',
'.oa-cb pre{background:var(--surf2);padding:10px 12px;overflow-x:auto;margin:0;}',
'.oa-cb code{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--ctxt);line-height:1.55;}',
/* TYPING */
'.oa-typing{display:flex;gap:8px;align-self:flex-start;}',
'.oa-dots{background:var(--abg);border:1px solid var(--bdr);border-radius:11px;border-bottom-left-radius:3px;padding:10px 12px;display:flex;gap:4px;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,0.05);}',
'.oa-dots span{width:6px;height:6px;border-radius:50%;background:var(--p);animation:oaDot 1.2s infinite;}',
'.oa-dots span:nth-child(2){animation-delay:.2s}',
'.oa-dots span:nth-child(3){animation-delay:.4s}',
'@keyframes oaDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}',
'.oa-err{align-self:stretch;background:var(--errbg);color:var(--err);padding:8px 12px;border-radius:5px;font-size:12px;border:1px solid rgba(218,30,40,0.15);}',
/* INPUT */
'.oa-zone{padding:10px 12px 20px;background:var(--surf);flex-shrink:0;border-top:1px solid var(--bdr);position:relative;}',
'.oa-amenu{position:absolute;bottom:calc(100% - 2px);left:12px;background:var(--surf);border:1px solid var(--bdr2);border-radius:7px;box-shadow:0 4px 16px rgba(0,0,0,0.12);overflow:hidden;display:none;flex-direction:column;z-index:200;min-width:165px;}',
'.oa-aitem{padding:9px 14px;background:none;border:none;text-align:left;cursor:pointer;font-size:12.5px;color:var(--txt);font-family:inherit;transition:.1s;}',
'.oa-aitem:hover{background:var(--ps);color:var(--p);}',
'.oa-iprev{display:none;align-items:center;gap:8px;margin-bottom:7px;padding:6px 8px;background:var(--surf2);border-radius:5px;border:1px solid var(--bdr);}',
'.oa-iprev img{width:44px;height:44px;object-fit:cover;border-radius:3px;}',
'.oa-rmi{background:var(--bdr2);border:none;border-radius:50%;width:17px;height:17px;font-size:9px;cursor:pointer;color:var(--txt2);}',
'.oa-paste-hint{font-size:10px;color:var(--txt3);margin-bottom:4px;text-align:right;}',
'.oa-wrap{display:flex;align-items:flex-end;gap:6px;background:var(--surf2);border:1.5px solid var(--bdr2);border-radius:10px;padding:8px 8px 8px 10px;transition:.15s;}',
'.oa-wrap:focus-within{border-color:var(--p);box-shadow:0 0 0 3px rgba(15,98,254,0.08);}',
'.oa-abtn{background:none;border:none;color:var(--txt3);cursor:pointer;padding:0 3px;flex-shrink:0;margin-bottom:2px;display:flex;align-items:center;transition:.15s;}',
'.oa-abtn:hover{color:var(--p);}',
'.oa-ta{flex:1;border:none;outline:none;background:none;font-family:inherit;font-size:13px;color:var(--txt);resize:none;line-height:1.5;min-height:22px;max-height:110px;}',
'.oa-ta::placeholder{color:var(--txt3);}',
'.oa-send{width:32px;height:32px;background:var(--p);border:none;border-radius:7px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.15s;}',
'.oa-send:hover{background:var(--ph);}',
'.oa-send:disabled{background:var(--bdr2);cursor:not-allowed;}','.oa-lang-btn{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);border-radius:4px;padding:3px 7px;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:.05em;font-family:inherit;transition:.15s;line-height:1.4;}','.oa-lang-btn:hover{background:rgba(255,255,255,0.2);color:#fff;}','.oa-lang-menu{position:absolute;top:42px;right:0;background:var(--surf);border:1px solid var(--bdr2);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.15);overflow:hidden;z-index:500;min-width:100px;display:none;}','.oa-lang-menu.open{display:block;}','.oa-lang-opt{display:block;width:100%;padding:9px 14px;background:none;border:none;text-align:left;cursor:pointer;font-size:12px;font-family:inherit;color:var(--txt);transition:.1s;}','.oa-lang-opt:hover{background:var(--ps);color:var(--p);}','.oa-lang-opt.sel{font-weight:600;color:var(--p);}'
].join('\n');

/* ── STATE ── */
var S={lang:'en',messages:[],theme:'light',imgData:null,liked:{},convId:null,convStart:null,user:'odmAdmin'};

/* ── UTILS ── */
function css_(){if(document.getElementById('oa-css'))return;var s=document.createElement('style');s.id='oa-css';s.textContent=CSS;document.head.appendChild(s);}
function ftime(){var d=new Date();return('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
function fdate(iso){var d=new Date(iso);return('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
function esc(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function genId(){return 'c'+Date.now()+'_'+Math.random().toString(36).substr(2,4);}
function cpText(t,tip){function show(){if(tip){tip.classList.add('show');setTimeout(function(){tip.classList.remove('show');},2000);}}try{navigator.clipboard.writeText(t).then(show).catch(function(){fb(t);show();});}catch(e){fb(t);show();}function fb(x){var ta=document.createElement('textarea');ta.value=x;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}}
function detectUser(){var sels=['.userMenuLink','[class*="userMenu"]','[id*="userMenu"]','[class*="userName"]'];for(var i=0;i<sels.length;i++){var el=document.querySelector(sels[i]);if(el){var t=el.textContent.replace(/[▼▾▲\s]/g,'').trim();if(t&&t.length>1&&t.length<30)return t;}}return 'odmAdmin';}
function msgText(m){return typeof m.content==='string'?m.content:(Array.isArray(m.content)?m.content.map(function(c){return c.type==='text'?c.text:'[imagem]';}).join(' '):'');}
function stripImgs(msgs){return msgs.map(function(m){if(Array.isArray(m.content)){return{role:m.role,content:[{type:'text',text:m.content.map(function(c){return c.type==='text'?c.text:'[imagem]';}).join(' ')}]};}return{role:m.role,content:m.content};});}

/* ── STORAGE ── */
function saveSession(){try{sessionStorage.setItem(SESS_KEY,JSON.stringify({id:S.convId,start:S.convStart,msgs:stripImgs(S.messages)}));}catch(e){}}
function loadSession(){try{var r=sessionStorage.getItem(SESS_KEY);if(!r)return false;var d=JSON.parse(r);S.messages=d.msgs||[];S.convId=d.id;S.convStart=d.start;return S.messages.length>0;}catch(e){return false;}}
function loadHistory(){try{return JSON.parse(localStorage.getItem(HIST_KEY)||'[]');}catch(e){return[];}}
function saveHistory(h){try{localStorage.setItem(HIST_KEY,JSON.stringify(h));}catch(e){}}
function saveToHistory(){
  if(!S.messages.length)return;
  if(!S.convId){S.convId=genId();S.convStart=new Date().toISOString();}
  var h=loadHistory();
  var preview='';
  for(var i=0;i<S.messages.length;i++){if(S.messages[i].role==='user'){preview=msgText(S.messages[i]).substring(0,65);break;}}
  var conv={id:S.convId,user:S.user,startTime:S.convStart,messages:stripImgs(S.messages),preview:preview,msgCount:S.messages.length};
  var idx=-1;for(var j=0;j<h.length;j++){if(h[j].id===S.convId){idx=j;break;}}
  if(idx>=0)h[idx]=conv;else h.unshift(conv);
  if(h.length>MAX_HIST)h=h.slice(0,MAX_HIST);
  saveHistory(h);
}
function deleteHistConv(id){saveHistory(loadHistory().filter(function(c){return c.id!==id;}));}

/* ── EXPORT ── */
function exportConv(){
  if(!S.messages.length){return;}
  var lines=[t('exh'),'Usuario: '+S.user,'Data: '+new Date(S.convStart||Date.now()).toLocaleString('pt-BR'),'',''];
  S.messages.forEach(function(m){if(m.role==='system')return;var role=m.role==='assistant'?'[Assistente IA]':'['+S.user+']';lines.push(role);lines.push(msgText(m));lines.push('');});
  var blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='odm_conversa_'+new Date().toISOString().slice(0,19).replace(/[:.]/g,'-')+'.txt';
  a.click();URL.revokeObjectURL(a.href);
}

/* ── MARKDOWN ── */
function md(raw){
  var t=esc(raw);
  t=t.replace(/```(\w*)\n?([\s\S]*?)```/g,function(_,lang,code){var l=lang||'irl';return '<div class="oa-cb"><div class="oa-cbh"><span class="oa-cbl">'+esc(l)+'</span><button class="oa-cbc" onclick="(function(b){var c=b.closest(\'.oa-cb\').querySelector(\'code\');if(navigator.clipboard)navigator.clipboard.writeText(c.innerText).then(function(){var o=b.textContent;b.textContent=\'Copiado!\';setTimeout(function(){b.textContent=o;},2000);});})(this)">Copiar</button></div><pre><code>'+code.trim()+'</code></pre></div>';});
  t=t.replace(/`([^`]+)`/g,'<code class="oa-ic">$1</code>');
  t=t.replace(/^#{1,3} (.+)$/gm,'<h3>$1</h3>');
  t=t.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  t=t.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
  t=t.replace(/^[-*] (.+)$/gm,'<li>$1</li>');
  t=t.replace(/^\d+\. (.+)$/gm,'<li>$1</li>');
  t=t.replace(/((?:<li>[\s\S]*?<\/li>\n?)+)/g,'<ul>$1</ul>');
  t=t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
  t=t.replace(/\n\n+/g,'</p><p>');
  t=t.replace(/\n/g,'<br>');
  return '<p>'+t+'</p>';
}

/* ── API ── */
function callAPI(onOk,onErr){
  var sysPrompt=SYS_BASE+'\nIMPORTANT: Always respond in '+t('sl')+'.';var msgs=[{role:'system',content:sysPrompt}].concat(S.messages);
  fetch(PROXY,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:MDL,messages:msgs,max_tokens:1800,temperature:0.25})})
  .then(function(r){return r.json();})
  .then(function(d){if(d.choices&&d.choices[0])onOk(d.choices[0].message.content);else onErr(d.error?d.error.message:'Erro API');})
  .catch(function(e){onErr('Erro: '+e.message);});
}

/* ── DOM ── */
function mkMsgDiv(role,text,imgSrc,idx,time_){
  var div=document.createElement('div');
  div.className='oa-msg '+(role==='user'?'oa-mu':'oa-ma');div.setAttribute('data-idx',idx);
  var html=role==='ai'?md(text||''):'<p>'+esc(text||'')+'</p>';
  var imgH=imgSrc&&role==='user'?'<div class="oa-mimg"><img src="'+imgSrc+'" alt="img"/></div>':'';
  var acts=role==='ai'?'<div class="oa-acts"><button class="oa-act oa-cp" data-idx="'+idx+'" title="Copiar">'+IC.copy+'<span class="oa-tip">Copiado!</span></button><button class="oa-act oa-lk" data-idx="'+idx+'" title="Util">'+IC.like+'</button><button class="oa-act oa-rg" data-idx="'+idx+'" title="Regenerar">'+IC.regen+'</button></div>':'';
  div.innerHTML='<div class="oa-av '+(role==='user'?'oa-avu':'oa-ava')+'">'+(role==='user'?'VC':'AI')+'</div><div class="oa-body">'+imgH+'<div class="oa-cnt">'+html+'</div><div class="oa-foot"><span class="oa-time">'+(time_||ftime())+'</span>'+acts+'</div></div>';
  return div;
}

function addMsg(role,text,imgSrc){
  var idx=S.messages.length,time_=ftime();
  var apiRole=role==='ai'?'assistant':role;
  if(!S.convId){S.convId=genId();S.convStart=new Date().toISOString();}
  if(imgSrc){S.messages.push({role:apiRole,content:[{type:'text',text:text||'Analise esta imagem.'},{type:'image_url',image_url:{url:imgSrc,detail:'auto'}}]});}
  else{S.messages.push({role:apiRole,content:text});}
  if(role==='user'){var ch_=document.getElementById('oa-chips');if(ch_)ch_.style.display='none';}
  var chat=document.getElementById('oa-chat');if(!chat)return;
  var div=mkMsgDiv(role,text,imgSrc,idx,time_);
  chat.insertBefore(div,document.getElementById('oa-dn'));
  var atBot=chat.scrollHeight-chat.scrollTop-chat.clientHeight<80;
  if(atBot)chat.scrollTop=chat.scrollHeight;
  bindActs(div);
  saveSession();saveToHistory();
}

function showTyping(on){
  var t=document.getElementById('oa-typing');
  if(!t){t=document.createElement('div');t.id='oa-typing';t.className='oa-typing';t.innerHTML='<div class="oa-av oa-ava">AI</div><div class="oa-dots"><span></span><span></span><span></span></div>';var c=document.getElementById('oa-chat');if(c)c.insertBefore(t,document.getElementById('oa-dn'));}
  t.style.display=on?'flex':'none';if(on){var c=document.getElementById('oa-chat');if(c)c.scrollTop=c.scrollHeight;}
}
function setSend(d){var b=document.getElementById('oa-send'),ta=document.getElementById('oa-ta');if(b)b.disabled=d;if(ta)ta.disabled=d;}
function doSend(){
  var ta=document.getElementById('oa-ta');if(!ta)return;
  var text=ta.value.trim(),img=S.imgData;
  if(!text&&!img)return;
  ta.value='';ta.style.height='auto';
  addMsg('user',text,img);
  if(img){S.imgData=null;var p=document.getElementById('oa-iprev');if(p)p.style.display='none';}
  setSend(true);showTyping(true);
  callAPI(function(reply){showTyping(false);setSend(false);addMsg('ai',reply);},
    function(err){showTyping(false);setSend(false);var chat=document.getElementById('oa-chat');if(chat){var e=document.createElement('div');e.className='oa-err';e.textContent=t('er')+' '+err;chat.insertBefore(e,document.getElementById('oa-dn'));chat.scrollTop=chat.scrollHeight;}});
}
function bindActs(div){
  var cp=div.querySelector('.oa-cp');if(cp)cp.addEventListener('click',function(){var m=S.messages[parseInt(this.getAttribute('data-idx'))];cpText(msgText(m),this.querySelector('.oa-tip'));});
  var lk=div.querySelector('.oa-lk');if(lk)lk.addEventListener('click',function(){var i=parseInt(this.getAttribute('data-idx'));S.liked[i]=!S.liked[i];this.classList.toggle('liked',!!S.liked[i]);});
  var rg=div.querySelector('.oa-rg');if(rg)rg.addEventListener('click',function(){var idx=parseInt(this.getAttribute('data-idx'));S.messages.splice(idx,1);div.remove();saveSession();saveToHistory();setSend(true);showTyping(true);callAPI(function(r){showTyping(false);setSend(false);addMsg('ai',r);},function(){showTyping(false);setSend(false);});});
}
function applyTheme(t){var r=document.getElementById('oa-root');if(r)r.setAttribute('data-theme',t);var b=document.getElementById('oa-theme');if(b){b.innerHTML=t==='dark'?IC.sun:IC.moon;b.title=t==='dark'?'Modo claro':'Modo escuro';}}

/* ── SIDEBAR ── */
function openSidebar(){saveToHistory();renderSidebar();var sb=document.getElementById('oa-sidebar'),ov=document.getElementById('oa-overlay');if(sb)sb.classList.add('open');if(ov)ov.classList.add('show');}
function closeSidebar(){var sb=document.getElementById('oa-sidebar'),ov=document.getElementById('oa-overlay');if(sb)sb.classList.remove('open');if(ov)ov.classList.remove('show');}
function startNewChat(){
  saveToHistory();
  S.messages=[];S.liked={};S.imgData=null;S.convId=genId();S.convStart=new Date().toISOString();
  try{sessionStorage.removeItem(SESS_KEY);}catch(e){}
  var chat=document.getElementById('oa-chat');
  if(chat){var rem=chat.querySelectorAll('.oa-msg,.oa-err,.oa-typing');for(var i=0;i<rem.length;i++)rem[i].remove();var ch=document.getElementById('oa-chips');if(ch)ch.style.display='flex';}
  closeSidebar();
}
function restoreConv(conv){
  saveToHistory();
  S.messages=conv.messages||[];S.convId=conv.id;S.convStart=conv.startTime;
  var chat=document.getElementById('oa-chat');if(!chat)return;
  var rem=chat.querySelectorAll('.oa-msg,.oa-err,.oa-typing');for(var i=0;i<rem.length;i++)rem[i].remove();
  var ch=document.getElementById('oa-chips');if(ch)ch.style.display=S.messages.length?'none':'flex';
  S.messages.forEach(function(m,idx){
    if(m.role==='system')return;
    var dr=m.role==='assistant'?'ai':'user';
    var div=mkMsgDiv(dr,msgText(m),null,idx,'');
    chat.insertBefore(div,document.getElementById('oa-dn'));bindActs(div);
  });
  chat.scrollTop=chat.scrollHeight;
  closeSidebar();
}
function renderSidebar(){
  var list=document.getElementById('oa-conv-list');if(!list)return;
  var q='';var inp=document.getElementById('oa-search-inp');if(inp)q=inp.value.toLowerCase();
  var history=loadHistory();
  if(q)history=history.filter(function(c){return (c.preview||'').toLowerCase().indexOf(q)>=0;});
  if(!history.length){list.innerHTML='<div class="oa-conv-empty">'+t('noh').replace('\\n','<br>')+'</div>';return;}
  var today=new Date().toDateString();var yest=new Date(Date.now()-86400000).toDateString();
  var html='',lastGrp='';
  history.forEach(function(conv){
    var d=new Date(conv.startTime||Date.now());var ds=d.toDateString();
    var grp=ds===today?t('tod'):ds===yest?t('yes'):d.toLocaleDateString();
    if(grp!==lastGrp){html+='<div class="oa-conv-group">'+esc(grp)+'</div>';lastGrp=grp;}
    var isActive=conv.id===S.convId;
    html+='<div class="oa-conv-item'+(isActive?' active':'')+'" data-id="'+conv.id+'">'+
      '<div class="oa-conv-user">'+esc(conv.user||'odmAdmin')+'</div>'+
      '<div class="oa-conv-preview">'+esc(conv.preview||'(sem mensagem)')+'</div>'+
      '<div class="oa-conv-meta">'+fdate(conv.startTime)+' &middot; '+conv.msgCount+' msgs</div>'+
      '<button class="oa-conv-del" data-id="'+conv.id+'">&times;</button>'+
    '</div>';
  });
  list.innerHTML=html;
  list.querySelectorAll('.oa-conv-item').forEach(function(item){
    item.addEventListener('click',function(e){
      if(e.target.classList.contains('oa-conv-del'))return;
      var id=this.getAttribute('data-id');var history2=loadHistory();
      for(var i=0;i<history2.length;i++){if(history2[i].id===id){restoreConv(history2[i]);return;}}
    });
  });
  list.querySelectorAll('.oa-conv-del').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();if(!window.confirm(t('del')))return;
      deleteHistConv(this.getAttribute('data-id'));renderSidebar();
    });
  });
}
function restoreSession_(){
  if(!loadSession()||!S.messages.length)return;
  var chat=document.getElementById('oa-chat');if(!chat)return;
  var ch=document.getElementById('oa-chips');if(ch)ch.style.display='none';
  S.messages.forEach(function(m,idx){
    if(m.role==='system')return;
    var dr=m.role==='assistant'?'ai':'user';
    var div=mkMsgDiv(dr,msgText(m),null,idx,'');
    chat.insertBefore(div,document.getElementById('oa-dn'));bindActs(div);
  });
  chat.scrollTop=chat.scrollHeight;
}

/* ── HTML ── */
function buildHTML(){
  return '<div class="oa" id="oa-root">'+
    /* sidebar */
    '<div class="oa-overlay" id="oa-overlay"></div>'+
    '<div class="oa-sidebar" id="oa-sidebar">'+
      '<div class="oa-sb-hdr"><span class="oa-sb-title">Historico de Conversas</span>'+
        '<div class="oa-sb-hdr-btns">'+
          '<button class="oa-sb-btn" id="oa-export-btn" title="Exportar conversa atual">'+IC.export_+'</button>'+
          '<button class="oa-sb-close" id="oa-sb-close">&times;</button>'+
        '</div>'+
      '</div>'+
      '<div class="oa-sb-actions">'+
        '<button class="oa-new-btn" id="oa-new-btn">'+t('nc')+'</button>'+
        '<input class="oa-search-inp" id="oa-search-inp" placeholder=""/>'+
      '</div>'+
      '<div class="oa-conv-list" id="oa-conv-list"></div>'+
    '</div>'+
    /* header */
    '<div class="oa-hdr"><div class="oa-logo"><span class="oa-logo-ibm">IBM</span><span class="oa-logo-sep">|</span><span class="oa-logo-name">Assistente ODM</span></div>'+
    '<span class="oa-proj">ODM_MachineLearning_Main</span>'+
    '<div class="oa-hdr-r">'+
      '<div style="position:relative;">'+
    '<button class="oa-lang-btn" id="oa-lang-btn">EN &#9662;</button>'+
    '<div class="oa-lang-menu" id="oa-lang-menu">'+
      '<button class="oa-lang-opt sel" id="oa-opt-en" data-lang="en">English</button>'+
      '<button class="oa-lang-opt" id="oa-opt-pt" data-lang="pt">Português</button>'+
      '<button class="oa-lang-opt" id="oa-opt-fr" data-lang="fr">Français</button>'+
    '</div>'+
  '</div>'+
  '<button class="oa-ibtn" id="oa-hist-btn" title="History">'+IC.hist+'</button>'+
      '<button class="oa-ibtn" id="oa-theme">'+IC.moon+'</button>'+
      '<button class="oa-ibtn" id="oa-clear">'+IC.trash+'</button>'+
    '</div></div>'+
    /* chat */
    '<div class="oa-chat" id="oa-chat">'+
      '<div class="oa-wlc"><div class="oa-wlc-h" id="oa-wlc-h">'+t('wh')+'</div>'+
      '<div class="oa-wlc-s" id="oa-wlc-s">'+t('ws')+'</div></div>'+
      '<div class="oa-chips" id="oa-chips">'+
        '<button class="oa-chip" id="oa-c1">'+t('c1')+'</button>'+
        '<button class="oa-chip" id="oa-c2">'+t('c2')+'</button>'+
        '<button class="oa-chip" id="oa-c3">'+t('c3')+'</button>'+
        '<button class="oa-chip" id="oa-c4">'+t('c4')+'</button>'+
      '</div>'+
      '<button class="oa-dn" id="oa-dn">'+IC.down+'</button>'+
    '</div>'+
    /* input */
    '<div class="oa-zone">'+
      '<div class="oa-amenu" id="oa-amenu">'+
        '<button class="oa-aitem" id="oa-photo">'+t('aph')+'</button>'+
        '<button class="oa-aitem" id="oa-file">'+t('afl')+'</button>'+
        '<button class="oa-aitem" id="oa-paste-btn">Colar da area de transferencia</button>'+
      '</div>'+
      '<div class="oa-iprev" id="oa-iprev"><img id="oa-pimg" src="" alt="preview"/><button class="oa-rmi" id="oa-rmi">&times;</button></div>'+
      '<div class="oa-wrap">'+
        '<button class="oa-abtn" id="oa-abtn">'+IC.attach+'</button>'+
        '<textarea class="oa-ta" id="oa-ta" rows="1" placeholder="Pergunte sobre regras, IRL... (Enter envia | Ctrl+V cola imagem)"></textarea>'+
        '<button class="oa-send" id="oa-send">'+IC.send+'</button>'+
      '</div>'+
    '</div>'+
    '<input type="file" id="oa-img-inp" accept="image/*" style="display:none">'+
    '<input type="file" id="oa-doc-inp" accept=".txt,.java,.xml,.json,.properties,.md,.irl" style="display:none">'+
  '</div>';
}

function setImg(dataUrl){
  S.imgData=dataUrl;
  var p=document.getElementById('oa-iprev'),pi=document.getElementById('oa-pimg');
  if(p&&pi){pi.src=dataUrl;p.style.display='flex';}
  var ta=document.getElementById('oa-ta');if(ta)ta.focus();
}

/* ── BIND ALL ── */
function bindAll(){
  /* theme */
  var saved='light';try{saved=localStorage.getItem('oa-theme')||'light';}catch(e){}
  S.theme=saved;applyTheme(saved);
  document.getElementById('oa-theme').addEventListener('click',function(){S.theme=S.theme==='light'?'dark':'light';applyTheme(S.theme);try{localStorage.setItem('oa-theme',S.theme);}catch(e){}});
  /* clear */
  document.getElementById('oa-clear').addEventListener('click',function(){
    if(!window.confirm(t('clr')))return;
    startNewChat();
  });
  /* history */
  document.getElementById('oa-hist-btn').addEventListener('click',openSidebar);
  var langBtn=document.getElementById('oa-lang-btn');var langMenu=document.getElementById('oa-lang-menu');if(langBtn&&langMenu){  langBtn.addEventListener('click',function(e){    e.stopPropagation();    langMenu.classList.toggle('open');  });  document.addEventListener('click',function(){if(langMenu)langMenu.classList.remove('open');});  ['en','pt','fr'].forEach(function(l){    var o=document.getElementById('oa-opt-'+l);    if(o)o.addEventListener('click',function(e){      e.stopPropagation();      applyLang(this.getAttribute('data-lang'));      langMenu.classList.remove('open');    });  });}
  document.getElementById('oa-sb-close').addEventListener('click',closeSidebar);
  document.getElementById('oa-overlay').addEventListener('click',closeSidebar);
  document.getElementById('oa-new-btn').addEventListener('click',startNewChat);
  document.getElementById('oa-export-btn').addEventListener('click',exportConv);
  var si=document.getElementById('oa-search-inp');if(si)si.addEventListener('input',renderSidebar);
  /* send */
  document.getElementById('oa-send').addEventListener('click',doSend);
  var ta=document.getElementById('oa-ta');
  if(ta){
    ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}});
    ta.addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,110)+'px';});
  }
  /* chips */
  document.querySelectorAll('.oa-chip').forEach(function(c){c.addEventListener('click',(function(t){return function(){var ta2=document.getElementById('oa-ta');if(ta2){ta2.value=t;doSend();};};})(c.textContent));});
  /* attach */
  var aBtn=document.getElementById('oa-abtn'),aMenu=document.getElementById('oa-amenu');
  if(aBtn&&aMenu){
    aBtn.addEventListener('click',function(e){e.stopPropagation();aMenu.style.display=aMenu.style.display==='flex'?'none':'flex';});
    document.addEventListener('click',function(){if(aMenu)aMenu.style.display='none';});
    aMenu.addEventListener('click',function(e){e.stopPropagation();});
  }
  /* photo */
  var phBtn=document.getElementById('oa-photo'),imgInp=document.getElementById('oa-img-inp');
  if(phBtn&&imgInp){phBtn.addEventListener('click',function(){imgInp.click();if(aMenu)aMenu.style.display='none';});imgInp.addEventListener('change',function(){if(!this.files||!this.files[0])return;var r=new FileReader();r.onload=function(ev){setImg(ev.target.result);};r.readAsDataURL(this.files[0]);});}
  /* file */
  var flBtn=document.getElementById('oa-file'),docInp=document.getElementById('oa-doc-inp');
  if(flBtn&&docInp){flBtn.addEventListener('click',function(){docInp.click();if(aMenu)aMenu.style.display='none';});docInp.addEventListener('change',function(){if(!this.files||!this.files[0])return;var fname=this.files[0].name,r=new FileReader();r.onload=function(ev){var ta3=document.getElementById('oa-ta');if(ta3){ta3.value=(ta3.value?ta3.value+'\n\n':'')+'[Arquivo: '+fname+']\n'+ev.target.result.substring(0,4000);ta3.dispatchEvent(new Event('input'));}};r.readAsText(this.files[0]);});}
  /* paste from clipboard menu item */
  var pasteBtn=document.getElementById('oa-paste-btn');
  if(pasteBtn)pasteBtn.addEventListener('click',function(){
    if(aMenu)aMenu.style.display='none';
    alert('Use Ctrl+V com o cursor no campo de texto para colar uma imagem.');
  });
  /* remove img */
  var rmi=document.getElementById('oa-rmi');if(rmi)rmi.addEventListener('click',function(){S.imgData=null;var p=document.getElementById('oa-iprev');if(p)p.style.display='none';if(imgInp)imgInp.value='';});
  /* scroll down */
  var dn=document.getElementById('oa-dn');if(dn)dn.addEventListener('click',function(){var chat=document.getElementById('oa-chat');if(chat){chat.scrollTop=chat.scrollHeight;this.classList.remove('show');}});
  var chat_=document.getElementById('oa-chat');if(chat_)chat_.addEventListener('scroll',function(){var d=document.getElementById('oa-dn');if(d)d.classList.toggle('show',this.scrollHeight-this.scrollTop-this.clientHeight>80);});
  /* Ctrl+V paste image globally */
  document.addEventListener('paste',function(e){
    var root=document.getElementById('oa-root');if(!root)return;
    var items=e.clipboardData&&e.clipboardData.items;if(!items)return;
    for(var i=0;i<items.length;i++){
      if(items[i].type.indexOf('image')>=0){
        var file=items[i].getAsFile();if(!file)continue;
        var r=new FileReader();
        r.onload=function(ev){setImg(ev.target.result);};
        r.readAsDataURL(file);
        e.preventDefault();break;
      }
    }
  });
}

/* ── EXTENSION ── */
return declare([ExtensionMixin],{
  inBranchView:function(){this._add();},inReleaseView:function(){this._add();},inActivityView:function(){this._add();},
  _add:function(){this.addTab('AIAssistantTab',{title:'Assistente IA'},lang.hitch(this,this._load));},
  _load:function(){
    css_();
    var c=dom.byId('AIAssistantTab');if(!c)return;
    S.user=detectUser();try{var _sl=localStorage.getItem('oa-lang');if(_sl&&T[_sl])S.lang=_sl;}catch(e){}
    var h=Math.max(window.innerHeight-145,500);
    c.style.cssText='height:'+h+'px!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;';
    c.innerHTML=buildHTML();
    var root=c.querySelector('#oa-root');if(root)root.style.cssText='height:'+h+'px;display:flex;flex-direction:column;overflow:hidden;position:relative;';
    bindAll();
    applyLang(S.lang);
    restoreSession_();
    if(!S.convId){S.convId=genId();S.convStart=new Date().toISOString();}
    window.addEventListener('resize',function(){var h2=Math.max(window.innerHeight-145,500);c.style.height=h2+'px!important';if(root)root.style.height=h2+'px';});
  }
});
}); /* end define */
