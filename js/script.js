/* ===== CONFIGURAÇÃO ===== */
// Número do WhatsApp da Escola Gênesis: só dígitos, com código do país e DDD.
// Exemplo de formato: 5500000000000 (não é um número real).
const WHATSAPP_GENESIS = "558185922585";
/* ======================== */

const PRECO = { com: 3500, sem: 1500 };          // em centavos
const ROTULO = { com: "Com almoço", sem: "Sem almoço" };
const CHAVE_PIX = "809aa5df-4a5b-4cb3-8efb-5303967e1f39";
const MAX_PARTICIPANTES = 30;
const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const EXT = /\.(jpe?g|png|webp|pdf)$/i;
const STORE = "diaCriancas2026";

const $ = id => document.getElementById(id);
let participantes = [];
let arquivo = null;
let ultimaMensagem = "", ultimoLink = "";

const brl = c => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numeroValido = () => /^\d{12,13}$/.test(WHATSAPP_GENESIS);

function salvar() {
  try { localStorage.setItem(STORE, JSON.stringify({ resp: $("resp").value, tel: $("tel").value, participantes })); } catch (e) {}
}
function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!d) return;
    $("resp").value = typeof d.resp === "string" ? d.resp.slice(0, 80) : "";
    $("tel").value = typeof d.tel === "string" ? d.tel.slice(0, 20) : "";
    if (Array.isArray(d.participantes)) {
      participantes = d.participantes.filter(p => p && typeof p.nome === "string" && PRECO[p.opc])
        .slice(0, MAX_PARTICIPANTES).map(p => ({ nome: p.nome.slice(0, 60), opc: p.opc }));
    }
  } catch (e) {}
}
function limparSalvo() { try { localStorage.removeItem(STORE); } catch (e) {} }

function toast(t) {
  const el = $("toast"); el.textContent = t; el.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2600);
}

function totais() {
  const com = participantes.filter(p => p.opc === "com").length;
  const sem = participantes.length - com;
  return { com, sem, total: com * PRECO.com + sem * PRECO.sem };
}

function desenhar() {
  const ul = $("lista"); ul.textContent = "";
  participantes.forEach((p, i) => {
    const li = document.createElement("li");
    const nome = document.createElement("span"); nome.className = "nome"; nome.textContent = p.nome;
    const acoes = document.createElement("div"); acoes.className = "acoes";
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", "Opção de " + p.nome);
    Object.keys(ROTULO).forEach(k => {
      const o = document.createElement("option");
      o.value = k; o.textContent = ROTULO[k] + " — " + brl(PRECO[k]); o.selected = p.opc === k;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => { participantes[i].opc = sel.value; desenhar(); salvar(); });
    const rm = document.createElement("button");
    rm.type = "button"; rm.className = "remover"; rm.textContent = "Remover";
    rm.setAttribute("aria-label", "Remover " + p.nome);
    rm.addEventListener("click", () => { participantes.splice(i, 1); desenhar(); salvar(); });
    acoes.append(sel, rm); li.append(nome, acoes); ul.appendChild(li);
  });
  $("vazio").classList.toggle("oculto", participantes.length > 0);
  const t = totais();
  $("qCom").textContent = t.com; $("qSem").textContent = t.sem;
  $("total").textContent = brl(t.total); $("valorPix").textContent = brl(t.total);
}

function limparNome(s) { return s.replace(/[\u0000-\u001f\u007f*_~`]/g, " ").replace(/\s+/g, " ").trim(); }

function erro(id, msg) {
  const el = $("e-" + id); el.textContent = msg || "";
  const campo = { resp: "resp", tel: "tel" }[id];
  if (campo) $(campo).setAttribute("aria-invalid", msg ? "true" : "false");
}

$("add").addEventListener("click", () => {
  const nome = limparNome($("pNome").value);
  if (nome.length < 2) return erro("part", "Digite o nome do participante.");
  if (participantes.length >= MAX_PARTICIPANTES) return erro("part", "Limite de " + MAX_PARTICIPANTES + " participantes por inscrição.");
  erro("part", "");
  participantes.push({ nome, opc: $("pOpc").value });
  $("pNome").value = ""; $("pNome").focus();
  desenhar(); salvar();
});
$("pNome").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("add").click(); } });
["resp", "tel"].forEach(id => $(id).addEventListener("input", salvar));

$("copiar").addEventListener("click", () => copiar(CHAVE_PIX, "Chave Pix copiada."));
$("copiarMsg").addEventListener("click", () => copiar(ultimaMensagem, "Mensagem copiada."));
async function copiar(texto, ok) {
  try { await navigator.clipboard.writeText(texto); toast(ok); }
  catch (e) {
    const ta = document.createElement("textarea"); ta.value = texto; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let feito = false; try { feito = document.execCommand("copy"); } catch (x) {}
    ta.remove(); toast(feito ? ok : "Não foi possível copiar. Selecione o texto e copie manualmente.");
  }
}

$("arq").addEventListener("change", e => {
  const f = e.target.files[0]; arquivo = null;
  if (!f) { $("nomeArquivo").textContent = "Nenhum arquivo selecionado."; return erro("arq", ""); }
  const tipoOk = TIPOS.includes(f.type) || (!f.type && EXT.test(f.name));
  if (!tipoOk || !EXT.test(f.name)) { e.target.value = ""; $("nomeArquivo").textContent = "Nenhum arquivo selecionado."; return erro("arq", "Formato não aceito. Envie uma imagem (JPG, PNG, WebP) ou PDF."); }
  if (f.size === 0) { e.target.value = ""; return erro("arq", "O arquivo está vazio."); }
  if (f.size > MAX_BYTES) { e.target.value = ""; $("nomeArquivo").textContent = "Nenhum arquivo selecionado."; return erro("arq", "Arquivo muito grande. O limite é 5 MB."); }
  arquivo = f; erro("arq", "");
  $("nomeArquivo").textContent = "Selecionado: " + f.name + " (" + (f.size / 1024 < 1024 ? Math.round(f.size / 1024) + " KB" : (f.size / 1048576).toFixed(1) + " MB") + ")";
});

function montarMensagem(resp, tel) {
  const t = totais();
  const linhas = participantes.map((p, i) => (i + 1) + ". " + p.nome + " — " + ROTULO[p.opc] + " (" + brl(PRECO[p.opc]) + ")");
  return [
    "*Inscrição — Dia das Crianças 2026*",
    "Escola Gênesis e Colégio Êxodo",
    "10/10/2026, das 8h às 17h — Projeto Soli Deo Gloria, Aldeia",
    "",
    "Responsável: " + resp,
    "Telefone: " + tel,
    "",
    "Participantes (" + participantes.length + "):",
    ...linhas,
    "",
    "Com almoço: " + t.com + " × " + brl(PRECO.com),
    "Sem almoço: " + t.sem + " × " + brl(PRECO.sem),
    "Total pago via Pix: " + brl(t.total),
    "",
    "Comprovante: vou anexar nesta conversa."
  ].join("\n");
}

$("form").addEventListener("submit", e => {
  e.preventDefault();
  const resp = limparNome($("resp").value);
  const tel = $("tel").value.trim();
  const dig = tel.replace(/\D/g, "");
  let ok = true, primeiro = null;
  const falha = (id, msg, campo) => { erro(id, msg); ok = false; if (!primeiro) primeiro = campo; };

  erro("resp", ""); erro("tel", ""); erro("arq", arquivo ? "" : $("e-arq").textContent); erro("geral", "");
  if (resp.length < 3) falha("resp", "Informe o nome do responsável.", $("resp"));
  if (dig.length < 10 || dig.length > 11) falha("tel", "Informe o telefone com DDD (10 ou 11 números).", $("tel"));
  if (participantes.length === 0) falha("part", "Adicione ao menos um participante.", $("pNome"));
  if (!arquivo) falha("arq", "Selecione o comprovante do Pix (imagem ou PDF até 5 MB).", $("arq"));
  if (!ok) { primeiro.focus(); return; }

  if (!numeroValido()) {
    erro("geral", "O número de WhatsApp da escola ainda não foi configurado neste site. Seus dados foram mantidos. Avise a escola.");
    return;
  }
  const btn = $("enviar"); btn.disabled = true; btn.textContent = "Abrindo o WhatsApp…";
  ultimaMensagem = montarMensagem(resp, tel);
  ultimoLink = "https://wa.me/" + WHATSAPP_GENESIS + "?text=" + encodeURIComponent(ultimaMensagem);
  $("reabrir").href = ultimoLink;
  $("stArq").textContent = "“" + arquivo.name + "”";
  const janela = window.open(ultimoLink, "_blank", "noopener");
  setTimeout(() => {
    btn.disabled = false; btn.textContent = "Enviar inscrição";
    $("form").classList.add("oculto");
    const st = $("status"); st.classList.remove("oculto"); st.focus(); st.scrollIntoView({ block: "start" });
    if (!janela) toast("Se o WhatsApp não abriu, toque em “Abrir o WhatsApp novamente”.");
  }, 600);
});

$("nova").addEventListener("click", () => {
  if (!confirm("Iniciar uma nova inscrição? Os dados atuais serão apagados deste aparelho.")) return;
  participantes = []; arquivo = null; $("form").reset(); limparSalvo();
  $("nomeArquivo").textContent = "Nenhum arquivo selecionado.";
  $("status").classList.add("oculto"); $("form").classList.remove("oculto");
  desenhar(); $("inscricao").scrollIntoView();
});

// Esconde imagens que não carregaram (na galeria, remove a figura inteira).
document.querySelectorAll("img").forEach(img => {
  const esconder = () => (img.closest("figure") || img).remove();
  if (img.complete && img.naturalWidth === 0) esconder();
  else img.addEventListener("error", esconder);
});

carregar(); desenhar();
