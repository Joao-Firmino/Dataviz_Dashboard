# Dataviz Dashboard - Jornada do Estudante

Dashboard independente criado a partir da aba de trajetória do dashboard antigo.
Agora ele consome a API do `ws-mestrado` para buscar metadados e timelines por atividade.

A interface mantém apenas a visão de `Jornada`, com o storytelling aplicado diretamente no timeline D3.

## Estrutura

- `index.html`: entrada principal do dashboard.
- `styles/main.css`: estilos da página, header e visualização.
- `js/main.js`: bootstrap da aplicação.
- `js/poc/studentJourneyPoc.js`: tratamento de dados e renderização da jornada com storytelling inline.
- `js/poc/loadDashboardData.js`: cliente da API e cache das timelines.
- `data/`: base histórica mantida no repositório, mas não usada pelo fluxo principal da PoC.
- `js/vendor/lodash.js`: biblioteca local copiada do projeto original.

## Como rodar

Sirva a pasta com um servidor HTTP local e abra `index.html`.

Exemplo:

```bash
python -m http.server 8000
```

Por padrão o dashboard chama a API em `http://localhost:8000`. Se precisar apontar para outro endereço, defina `window.DATAVIZ_API_URL` antes de carregar `js/main.js`.
