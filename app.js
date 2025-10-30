const apiKey = '342aa484';
const searchUrl = query => `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(query.trim())}`;
const titleUrl = id => `https://www.omdbapi.com/?apikey=${apiKey}&i=${encodeURIComponent(id)}`;

const $ = selector => document.querySelector(selector);

const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };
}

const cacheSearch = new Map();
const cacheTitle = new Map();
let currentAbort = null;
let currentQuery = '';

const inputEl = $('#q');
const clearBtn = $('#clear');
const searchStatus = $('#search-status');
const resultList = $('#results');

const setStatus = (msg = '') => (searchStatus.textContent = msg);

const getPlaceholderPoster = () => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 450'><rect width='100%' height='100%' fill='%23e5e7eb'/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const renderResults = items => {
  resultList.innerHTML = '';
  const template = document.getElementById('card-template');

  items.forEach(item => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.imdbid = item.imdbID;

    const posterImg = card.querySelector('.poster');
    posterImg.alt = `${item.Title} poster`;
    posterImg.loading = 'lazy';
    posterImg.onerror = () => (posterImg.src = getPlaceholderPoster());
    posterImg.src = item.Poster && item.Poster !== 'N/A' ? item.Poster : getPlaceholderPoster();

    card.querySelector('.title').textContent = item.Title;
    card.querySelector('.type').textContent = item.Type;
    card.querySelector('.year').textContent = item.Year;

    const detailsEl = card.querySelector('.details');

    const showDetails = async () => {
      detailsEl.hidden = false;
      detailsEl.textContent = 'Carregando...';
      try {
        const data = await getTitle(item.imdbID);
        detailsEl.textContent =
          `${data.Plot && data.Plot !== 'N/A' ? data.Plot : 'Sem sinopse.'}\n` +
          `IMDb: ${data.imdbRating ?? 'N/A'} | Duração: ${data.Runtime ?? '—'} | Gênero: ${data.Genre ?? '—'}`;
      } catch {
        detailsEl.textContent = 'Erro ao carregar detalhes.';
      }
    };

    const hideDetails = () => (detailsEl.hidden = true);

    card.addEventListener('mouseenter', showDetails);
    card.addEventListener('focusin', showDetails);
    card.addEventListener('mouseleave', hideDetails);
    card.addEventListener('focusout', hideDetails);
    card.addEventListener('click', () => (detailsEl.hidden ? showDetails() : hideDetails()));

    resultList.appendChild(card);
  });
};

const getSearchResults = async query => {
  if (!query) return [];
  if (cacheSearch.has(query)) return cacheSearch.get(query);
  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  const res = await fetch(searchUrl(query), { signal: currentAbort.signal });
  const json = await res.json();
  const items = json.Response === 'True' ? (json.Search || []).slice(0, 12) : [];
  cacheSearch.set(query, items);
  return items;
};

const getTitle = async id => {
  if (cacheTitle.has(id)) return cacheTitle.get(id);
  const res = await fetch(titleUrl(id));
  const json = await res.json();
  if (json.Response !== 'True') throw new Error('Título não encontrado');
  cacheTitle.set(id, json);
  return json;
};

const runSearch = debounce(async () => {
  const query = inputEl.value.trim();
  currentQuery = query;
  if (!query) {
    resultList.innerHTML = '';
    setStatus('');
    return;
  }

  setStatus('Buscando...');
  try {
    const items = await getSearchResults(query);
    if (query !== currentQuery) return;
    if (items.length === 0) {
      resultList.innerHTML = '';
      setStatus('Nenhum resultado.');
      return;
    }
    renderResults(items);
    setStatus(`${items.length} resultado(s).`);
  } catch (e) {
    if (e.name !== 'AbortError') setStatus('Falha ao buscar.');
  }
}, 2000);

inputEl.addEventListener('input', runSearch);
document.getElementById('search-form').addEventListener('submit', e => {
  e.preventDefault();
  runSearch();
});

clearBtn.addEventListener('click', () => {
  inputEl.value = '';
  inputEl.focus();
  resultList.innerHTML = '';
  setStatus('');
});
