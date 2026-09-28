/* ==========================================================
   SETTINGS
   ========================================================== */

// Escola Gênesis's WhatsApp number: digits only, starting with the country code (55) and area code.
const WHATSAPP_GENESIS = "558185922585";


/* ==========================================================
   FIXED VALUES
   ========================================================== */

// Prices are stored in cents so the math has no rounding errors.
const PRECO_EM_CENTAVOS = { com: 3500, sem: 1500 };
const NOME_DA_OPCAO = { com: "Com almoço", sem: "Sem almoço" };

const MAXIMO_DE_PARTICIPANTES = 30;

// Name under which the in-progress registration is saved for the current browser tab (sessionStorage).
const CHAVE_DO_RASCUNHO = "diaDeConvivencia2026";


/* ==========================================================
   PAGE ELEMENTS
   ========================================================== */

const formulario = document.getElementById("formulario");
const secaoInscricao = document.getElementById("inscricao");

// Step 1: guardian's details
const campoResponsavel = document.getElementById("responsavel");
const campoTelefone = document.getElementById("telefone");

// Step 2: participants
const campoNomeParticipante = document.getElementById("nome-participante");
const campoOpcaoParticipante = document.getElementById("opcao-participante");
const botaoAdicionarParticipante = document.getElementById("adicionar-participante");
const listaParticipantes = document.getElementById("lista-participantes");
const mensagemListaVazia = document.getElementById("lista-vazia");
const quantidadeComAlmoco = document.getElementById("quantidade-com-almoco");
const quantidadeSemAlmoco = document.getElementById("quantidade-sem-almoco");
const valorTotal = document.getElementById("valor-total");

// Step 3: Pix
const valorPix = document.getElementById("valor-pix");
const chavePix = document.getElementById("chave-pix");
const botaoCopiarChavePix = document.getElementById("copiar-chave-pix");

// Submitting and final instructions
const botaoEnviarInscricao = document.getElementById("enviar-inscricao");
const painelStatus = document.getElementById("status");
const linkReabrirWhatsapp = document.getElementById("reabrir-whatsapp");
const botaoCopiarMensagem = document.getElementById("copiar-mensagem");
const botaoNovaInscricao = document.getElementById("nova-inscricao");

const notificacao = document.getElementById("notificacao");

// Where each part of the form shows its error message.
const mensagensDeErro = {
  responsavel: document.getElementById("erro-responsavel"),
  telefone: document.getElementById("erro-telefone"),
  participantes: document.getElementById("erro-participantes"),
};

// Text fields that get a red border when they have an error.
const camposComErroVisivel = {
  responsavel: campoResponsavel,
  telefone: campoTelefone,
};


/* ==========================================================
   REGISTRATION STATE
   ========================================================== */

let participantes = [];              // list of { nome, opcao }, where opcao is "com" or "sem"
let ultimaMensagem = "";             // text sent to WhatsApp, reused by "Copiar mensagem"
let temporizadorDaNotificacao = null;


/* ==========================================================
   HELPERS
   ========================================================== */

// Formats an amount in cents as Brazilian currency. E.g. 3500 → "R$ 35,00".
function formatarReais(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Replaces invisible characters and WhatsApp formatting symbols (* _ ~ `) with spaces
// and collapses repeated spaces, so a name can't mess up the message that gets sent.
function limparNome(texto) {
  return texto
    .replace(/[\u0000-\u001f\u007f*_~`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Shows a short message at the bottom of the screen for a few seconds.
function mostrarNotificacao(texto) {
  notificacao.textContent = texto;
  notificacao.classList.add("visivel");
  clearTimeout(temporizadorDaNotificacao);
  temporizadorDaNotificacao = setTimeout(() => notificacao.classList.remove("visivel"), 2600);
}

// Shows the error message for one part of the form (or clears it when the message is empty).
// For text fields, it also flags the field as invalid, which gives it a red border.
function mostrarErro(parte, mensagem) {
  mensagensDeErro[parte].textContent = mensagem;
  const campo = camposComErroVisivel[parte];
  if (campo) {
    campo.setAttribute("aria-invalid", mensagem ? "true" : "false");
  }
}

// Clears every error message in the form.
function limparErros() {
  for (const parte of Object.keys(mensagensDeErro)) {
    mostrarErro(parte, "");
  }
}

// Copies text to the clipboard and tells the user whether it worked.
// Older browsers, and pages not served over HTTPS, don't support the modern clipboard API,
// so in that case it falls back to the old method (a hidden text field).
async function copiarTexto(texto, mensagemDeSucesso) {
  try {
    await navigator.clipboard.writeText(texto);
    mostrarNotificacao(mensagemDeSucesso);
  } catch (erro) {
    const campoTemporario = document.createElement("textarea");
    campoTemporario.value = texto;
    campoTemporario.style.position = "fixed";
    campoTemporario.style.opacity = "0";
    document.body.appendChild(campoTemporario);
    campoTemporario.select();

    let copiou = false;
    try {
      copiou = document.execCommand("copy");
    } catch (erroNoMetodoAntigo) {
      // That didn't work either; the user sees the message below.
    }
    campoTemporario.remove();

    if (copiou) {
      mostrarNotificacao(mensagemDeSucesso);
    } else {
      mostrarNotificacao("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }
}


/* ==========================================================
   DRAFT (data saved for the current browser tab)
   ========================================================== */

// The draft uses sessionStorage: it survives reloads and trips to WhatsApp and back,
// but is cleared when the tab is closed, so opening the link again starts a fresh form.

// Saves what has been filled in so far, so nothing is lost if the page reloads.
function salvarRascunho() {
  const rascunho = {
    responsavel: campoResponsavel.value,
    telefone: campoTelefone.value,
    participantes,
  };
  try {
    sessionStorage.setItem(CHAVE_DO_RASCUNHO, JSON.stringify(rascunho));
  } catch (erro) {
    // The browser may block storage (e.g. private browsing). The form still works without it.
  }
}

// Restores the saved draft, discarding anything invalid.
function carregarRascunho() {
  try {
    const rascunho = JSON.parse(sessionStorage.getItem(CHAVE_DO_RASCUNHO) || "null");
    if (!rascunho) {
      return;
    }

    // Trims the text to the same maximum length the fields allow.
    campoResponsavel.value = typeof rascunho.responsavel === "string"
      ? rascunho.responsavel.slice(0, campoResponsavel.maxLength)
      : "";
    campoTelefone.value = typeof rascunho.telefone === "string"
      ? rascunho.telefone.slice(0, campoTelefone.maxLength)
      : "";

    if (Array.isArray(rascunho.participantes)) {
      participantes = rascunho.participantes
        .filter(participante => participante && typeof participante.nome === "string" && PRECO_EM_CENTAVOS[participante.opcao])
        .slice(0, MAXIMO_DE_PARTICIPANTES)
        .map(participante => ({
          nome: participante.nome.slice(0, campoNomeParticipante.maxLength),
          opcao: participante.opcao,
        }));
    }
  } catch (erro) {
    // Unreadable draft: the page starts with an empty form.
  }
}

// Deletes the saved draft.
function apagarRascunho() {
  try {
    sessionStorage.removeItem(CHAVE_DO_RASCUNHO);
  } catch (erro) {
    // Nothing to do if the browser blocks storage.
  }
}


/* ==========================================================
   PARTICIPANTS
   ========================================================== */

// Counts how many participants picked each option and works out the total, in cents.
function calcularTotais() {
  const comAlmoco = participantes.filter(participante => participante.opcao === "com").length;
  const semAlmoco = participantes.length - comAlmoco;
  const total = comAlmoco * PRECO_EM_CENTAVOS.com + semAlmoco * PRECO_EM_CENTAVOS.sem;
  return { comAlmoco, semAlmoco, total };
}

// Rebuilds the participant list on screen and updates the counts and amounts.
function atualizarTela() {
  listaParticipantes.textContent = "";
  participantes.forEach((participante, posicao) => {
    listaParticipantes.appendChild(criarItemDaLista(participante, posicao));
  });
  mensagemListaVazia.classList.toggle("oculto", participantes.length > 0);

  const totais = calcularTotais();
  quantidadeComAlmoco.textContent = totais.comAlmoco;
  quantidadeSemAlmoco.textContent = totais.semAlmoco;
  valorTotal.textContent = formatarReais(totais.total);
  valorPix.textContent = formatarReais(totais.total);
}

// Builds one participant's row in the list: the name, the option picker and the "Remover" button.
function criarItemDaLista(participante, posicao) {
  const item = document.createElement("li");

  const nome = document.createElement("span");
  nome.className = "nome";
  nome.textContent = participante.nome;

  const seletorDeOpcao = document.createElement("select");
  seletorDeOpcao.setAttribute("aria-label", "Opção de " + participante.nome);
  for (const opcao of Object.keys(NOME_DA_OPCAO)) {
    const itemDoSeletor = document.createElement("option");
    itemDoSeletor.value = opcao;
    itemDoSeletor.textContent = NOME_DA_OPCAO[opcao] + " — " + formatarReais(PRECO_EM_CENTAVOS[opcao]);
    itemDoSeletor.selected = participante.opcao === opcao;
    seletorDeOpcao.appendChild(itemDoSeletor);
  }
  seletorDeOpcao.addEventListener("change", () => {
    participante.opcao = seletorDeOpcao.value;
    atualizarTela();
    salvarRascunho();
  });

  const botaoRemover = document.createElement("button");
  botaoRemover.type = "button";
  botaoRemover.className = "remover";
  botaoRemover.textContent = "Remover";
  botaoRemover.setAttribute("aria-label", "Remover " + participante.nome);
  botaoRemover.addEventListener("click", () => {
    participantes.splice(posicao, 1);
    atualizarTela();
    salvarRascunho();
  });

  const acoes = document.createElement("div");
  acoes.className = "acoes";
  acoes.append(seletorDeOpcao, botaoRemover);
  item.append(nome, acoes);
  return item;
}

// Adds the typed-in participant to the list, with the chosen option.
function adicionarParticipante() {
  const nome = limparNome(campoNomeParticipante.value);
  if (nome.length < 2) {
    mostrarErro("participantes", "Digite o nome do participante.");
    return;
  }
  if (participantes.length >= MAXIMO_DE_PARTICIPANTES) {
    mostrarErro("participantes", "Limite de " + MAXIMO_DE_PARTICIPANTES + " participantes por inscrição.");
    return;
  }

  mostrarErro("participantes", "");
  participantes.push({ nome, opcao: campoOpcaoParticipante.value });
  campoNomeParticipante.value = "";
  campoNomeParticipante.focus();
  atualizarTela();
  salvarRascunho();
}


/* ==========================================================
   SUBMITTING THE REGISTRATION
   ========================================================== */

// Checks every step of the form, shows any errors found and moves the cursor
// to the first field with a problem. Returns true if everything is valid.
function validarFormulario(responsavel, telefone) {
  limparErros();
  let primeiroCampoComErro = null;

  // Shows the error and remembers the first field with a problem.
  function marcarErro(parte, mensagem, campo) {
    mostrarErro(parte, mensagem);
    if (!primeiroCampoComErro) {
      primeiroCampoComErro = campo;
    }
  }

  const digitosDoTelefone = telefone.replace(/\D/g, "");

  if (responsavel.length < 3) {
    marcarErro("responsavel", "Informe o nome do responsável.", campoResponsavel);
  }
  if (digitosDoTelefone.length < 10 || digitosDoTelefone.length > 11) {
    marcarErro("telefone", "Informe o telefone com DDD (10 ou 11 números).", campoTelefone);
  }
  if (participantes.length === 0) {
    marcarErro("participantes", "Adicione ao menos um participante.", campoNomeParticipante);
  }

  if (primeiroCampoComErro) {
    primeiroCampoComErro.focus();
    return false;
  }
  return true;
}

// Builds the registration text that goes, ready to send, to the school's WhatsApp.
// The asterisks around the title make it bold in WhatsApp.
function montarMensagem(responsavel, telefone) {
  const totais = calcularTotais();
  const linhasDosParticipantes = participantes.map((participante, posicao) =>
    (posicao + 1) + ". " + participante.nome + " — " + NOME_DA_OPCAO[participante.opcao] + " (" + formatarReais(PRECO_EM_CENTAVOS[participante.opcao]) + ")"
  );

  return [
    "*Inscrição — Dia de Convivência 2026*",
    "Escola Gênesis e Colégio Êxodo",
    "10/10/2026, das 8h às 17h — Projeto Soli Deo Gloria, Aldeia",
    "",
    "Responsável: " + responsavel,
    "Telefone: " + telefone,
    "",
    "Participantes (" + participantes.length + "):",
    ...linhasDosParticipantes,
    "",
    "Com almoço: " + totais.comAlmoco + " × " + formatarReais(PRECO_EM_CENTAVOS.com),
    "Sem almoço: " + totais.semAlmoco + " × " + formatarReais(PRECO_EM_CENTAVOS.sem),
    "Total pago via Pix: " + formatarReais(totais.total),
    "",
    "Comprovante: vou anexar nesta conversa.",
  ].join("\n");
}

// Hides the form and shows the instructions for sending the receipt in WhatsApp.
function mostrarInstrucoesFinais() {
  formulario.classList.add("oculto");
  painelStatus.classList.remove("oculto");
  painelStatus.focus();
  painelStatus.scrollIntoView({ block: "start" });
}

// Runs on "Enviar inscrição": checks the data, builds the message and opens WhatsApp.
function enviarInscricao(evento) {
  evento.preventDefault();

  const responsavel = limparNome(campoResponsavel.value);
  const telefone = campoTelefone.value.trim();
  if (!validarFormulario(responsavel, telefone)) {
    return;
  }

  botaoEnviarInscricao.disabled = true;
  botaoEnviarInscricao.textContent = "Abrindo o WhatsApp…";

  ultimaMensagem = montarMensagem(responsavel, telefone);
  const linkDoWhatsapp = "https://wa.me/" + WHATSAPP_GENESIS + "?text=" + encodeURIComponent(ultimaMensagem);
  linkReabrirWhatsapp.href = linkDoWhatsapp;
  window.open(linkDoWhatsapp, "_blank", "noopener");

  // Waits a moment, with the button showing "Abrindo o WhatsApp…", before switching screens.
  // The page can't tell whether WhatsApp actually opened, so the hint is always shown.
  setTimeout(() => {
    botaoEnviarInscricao.disabled = false;
    botaoEnviarInscricao.textContent = "Enviar inscrição";
    mostrarInstrucoesFinais();
    mostrarNotificacao("Se o WhatsApp não abriu, toque em “Abrir o WhatsApp novamente”.");
  }, 600);
}

// Runs on "Fazer outra inscrição": deletes the data from this device and goes back to an empty form.
function comecarNovaInscricao() {
  if (!confirm("Iniciar uma nova inscrição? Os dados atuais serão apagados deste aparelho.")) {
    return;
  }

  participantes = [];
  formulario.reset();
  apagarRascunho();

  painelStatus.classList.add("oculto");
  formulario.classList.remove("oculto");
  atualizarTela();
  secaoInscricao.scrollIntoView();
}


/* ==========================================================
   IMAGES
   ========================================================== */

// Hides images that fail to load instead of showing the broken-image icon.
// In the photo gallery, it removes the photo's whole frame.
function esconderImagensQuebradas() {
  document.querySelectorAll("img").forEach(imagem => {
    const esconder = () => (imagem.closest("figure") || imagem).remove();
    // The image may have failed before this script ran; if so, hide it right away.
    if (imagem.complete && imagem.naturalWidth === 0) {
      esconder();
    } else {
      imagem.addEventListener("error", esconder);
    }
  });
}


/* ==========================================================
   EVENTS (what happens on each click or keystroke)
   ========================================================== */

botaoAdicionarParticipante.addEventListener("click", adicionarParticipante);

// Pressing Enter in the participant name adds them to the list instead of submitting the form.
campoNomeParticipante.addEventListener("keydown", evento => {
  if (evento.key === "Enter") {
    evento.preventDefault();
    adicionarParticipante();
  }
});

// Saves the draft on every keystroke in the guardian's details.
campoResponsavel.addEventListener("input", salvarRascunho);
campoTelefone.addEventListener("input", salvarRascunho);

botaoCopiarChavePix.addEventListener("click", () => copiarTexto(chavePix.textContent.trim(), "Chave Pix copiada."));
botaoCopiarMensagem.addEventListener("click", () => copiarTexto(ultimaMensagem, "Mensagem copiada."));
formulario.addEventListener("submit", enviarInscricao);
botaoNovaInscricao.addEventListener("click", comecarNovaInscricao);


/* ==========================================================
   STARTUP
   ========================================================== */

esconderImagensQuebradas();
carregarRascunho();
atualizarTela();
