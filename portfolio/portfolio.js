const GRAVA_NO_SERVIDOR = false;
let atual = { lista: [], i: 0 };

function abrirTelaCheia(lista, i) {
  atual = { lista, i };
  const tc = document.getElementById('telacheia');
  tc.querySelector('img').src = lista[i];
  tc.querySelector('.contador').textContent = `${i + 1} / ${lista.length}`;
  tc.hidden = false;
}

function fecharTelaCheia() {
  document.getElementById('telacheia').hidden = true;
}

function passar(d) {
  if (!atual.lista.length) return;
  abrirTelaCheia(atual.lista, (atual.i + d + atual.lista.length) % atual.lista.length);
}

document.addEventListener('keydown', e => {
  const tc = document.getElementById('telacheia');
  if (tc.hidden) return;
  if (e.key === 'Escape') tc.hidden = true;
  if (e.key === 'ArrowRight') passar(1);
  if (e.key === 'ArrowLeft') passar(-1);
});

if (document.getElementById('telacheia')) {
  document.getElementById('telacheia').addEventListener('click', e => {
    if (e.target.id === 'telacheia') e.currentTarget.hidden = true;
  });
}

function atualizarContadorArquivados() {
  const bloco = document.querySelector('details.arquivados');
  if (!bloco) return;
  const n = bloco.querySelectorAll('.cartao').length;
  bloco.querySelector('summary').textContent = `Arquivados (${n})`;
}

const CHAVE_NOTAS = 'apartamentos:notas';

function notasSalvas() {
  try { return JSON.parse(localStorage.getItem(CHAVE_NOTAS)) || {}; } catch (e) { return {}; }
}

// No site publicado nao ha /api/ficha: a nota fica no navegador e volta para as
// fichas pelo botao "Copiar minhas notas". No servidor local grava direto no ficha.md.
async function gravarNota(slug, nota) {
  if (GRAVA_NO_SERVIDOR) return gravarCampo(slug, 'nota', nota || '');
  const notas = notasSalvas();
  if (nota) notas[slug] = nota; else delete notas[slug];
  localStorage.setItem(CHAVE_NOTAS, JSON.stringify(notas));
}

async function gravarCampo(slug, campo, valor) {
  const r = await fetch('/api/ficha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, campo, valor }),
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo.erro || 'falha ao gravar');
  return corpo;
}

function redesenharEstrelas(cartao, nota) {
  cartao.querySelectorAll('.estrelas').forEach(span => {
    span.dataset.nota = nota;
    span.classList.toggle('vazia', !nota);
    span.querySelectorAll('.estrela').forEach(i => {
      const v = Number(i.dataset.valor);
      i.querySelector('b').style.width =
        (nota >= v ? 100 : nota >= v - 0.5 ? 50 : 0) + '%';
    });
  });
  cartao.dataset.nota = nota;
}

function moverCartaoArquivado(cartao, arquivado) {
  cartao.dataset.arquivado = arquivado ? 'sim' : 'nao';
  const botao = cartao.querySelector('.arquivar');
  if (botao) botao.textContent = arquivado ? 'Desarquivar' : 'Arquivar';
  const destino = document.querySelector(
    arquivado ? 'details.arquivados .grade' : '.grade:not(details .grade)');
  if (destino) destino.appendChild(cartao);
  atualizarContadorArquivados();
}

document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('estrela')) {
    e.preventDefault();
    e.target.click();
  }
});

document.addEventListener('click', async e => {
  const estrela = e.target.closest('.estrela');
  const cartaoDaEstrela = estrela && estrela.closest('[data-slug]');
  if (estrela && cartaoDaEstrela) {
    const cheia = Number(estrela.dataset.valor);
    // Metade esquerda da estrela = meia nota, como nos sites de avaliacao. Pelo
    // teclado nao ha ponto de clique (clientX = 0): vale a estrela inteira.
    const r = estrela.getBoundingClientRect();
    const meia = (e.clientX || e.clientY) && (e.clientX - r.left) < r.width / 2;
    let nota = meia ? cheia - 0.5 : cheia;
    if (nota === Number(cartaoDaEstrela.dataset.nota)) nota = 0;  // clicar de novo tira
    try {
      await gravarNota(cartaoDaEstrela.dataset.slug, nota);
      redesenharEstrelas(cartaoDaEstrela, nota);
      aplicarFiltros();
    } catch (err) {
      alert(err.message);
    }
    return;
  }
  const botao = e.target.closest('.arquivar');
  if (botao) {
    const cartao = botao.closest('.cartao');
    const arquivar = cartao.dataset.arquivado !== 'sim';
    try {
      await gravarCampo(cartao.dataset.slug, 'arquivado', arquivar ? 'sim' : 'nao');
      moverCartaoArquivado(cartao, arquivar);
      aplicarFiltros();
    } catch (err) {
      alert(err.message);
    }
  }
});

function aplicarFiltros() {
  const status = document.getElementById('filtro-status');
  const notaMin = document.getElementById('filtro-nota');
  const ordenacao = document.getElementById('filtro-ordenacao');
  if (!status || !notaMin || !ordenacao) return;

  document.querySelectorAll('.cartao').forEach(cartao => {
    const passaStatus = status.value === 'todos' || cartao.dataset.status === status.value;
    const passaNota = Number(cartao.dataset.nota) >= Number(notaMin.value);
    cartao.style.display = (passaStatus && passaNota) ? '' : 'none';
  });

  document.querySelectorAll('.grade').forEach(grade => {
    const cartoes = Array.from(grade.querySelectorAll('.cartao'));
    const chave = c => {
      if (ordenacao.value === 'preco') return Number(c.dataset.preco) || Infinity;
      if (ordenacao.value === 'm2') return Number(c.dataset.m2) || Infinity;
      if (ordenacao.value === 'nota') return -Number(c.dataset.nota);
      return 0;
    };
    // "Padrao" nao e "como veio": e a mesma ordem do gerador - estrelas, bairro, rua.
    // Precisa existir aqui tambem, senao dar uma nota nao remexe a grade ate regerar.
    if (ordenacao.value === 'nenhuma') {
      cartoes.sort((a, b) =>
        (Number(b.dataset.nota) - Number(a.dataset.nota)) ||
        a.dataset.bairro.localeCompare(b.dataset.bairro, 'pt-BR') ||
        a.dataset.rua.localeCompare(b.dataset.rua, 'pt-BR'));
    } else {
      cartoes.sort((a, b) => chave(a) - chave(b));
    }
    cartoes.forEach(c => grade.appendChild(c));
  });
}

document.querySelectorAll('#filtro-status, #filtro-nota, #filtro-ordenacao').forEach(el => {
  el.addEventListener('change', aplicarFiltros);
});

// Site publicado: as notas dadas neste navegador voltam para a tela a cada visita.
if (!GRAVA_NO_SERVIDOR) {
  const notas = notasSalvas();
  document.querySelectorAll('[data-slug]').forEach(el => {
    if (notas[el.dataset.slug]) redesenharEstrelas(el, notas[el.dataset.slug]);
  });
}
aplicarFiltros();

const botaoNotas = document.querySelector('.copiar-notas');
if (botaoNotas) botaoNotas.addEventListener('click', async () => {
  const notas = notasSalvas();
  const texto = Object.entries(notas).map(([s, n]) => `${s}: ${n}`).join('\n');
  if (!texto) { alert('Nenhuma nota dada neste navegador ainda.'); return; }
  try {
    await navigator.clipboard.writeText(texto);
    alert('Notas copiadas. Cole no Claude para gravar nas fichas.');
  } catch (err) {
    prompt('Copie as notas:', texto);
  }
});

const MAX_COMPARAR = 5;
const compararCaixas = document.querySelectorAll('.comparar-topo input[type=checkbox]');
let compararSelecionados = [];

function compararAplicar() {
  document.querySelectorAll('.coluna').forEach(col => {
    col.style.display = compararSelecionados.includes(col.dataset.slug) ? 'flex' : 'none';
  });
}

function compararLigar(slug) {
  compararSelecionados.push(slug);
  if (compararSelecionados.length > MAX_COMPARAR) {
    const antigo = compararSelecionados.shift();
    const caixa = Array.from(compararCaixas).find(c => c.dataset.slug === antigo);
    if (caixa) caixa.checked = false;
  }
}

compararCaixas.forEach(caixa => {
  caixa.addEventListener('change', () => {
    if (caixa.checked) compararLigar(caixa.dataset.slug);
    else compararSelecionados = compararSelecionados.filter(s => s !== caixa.dataset.slug);
    compararAplicar();
  });
  if (caixa.dataset.arquivado !== 'sim' && compararSelecionados.length < MAX_COMPARAR) {
    caixa.checked = true;
    compararSelecionados.push(caixa.dataset.slug);
  }
});
compararAplicar();
