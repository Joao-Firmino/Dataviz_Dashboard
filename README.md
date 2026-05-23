# Dataviz Dashboard - Jornada do Estudante

Dashboard independente criado a partir da aba de trajetória do dashboard antigo.
Usa os mesmos CSVs locais copiados para a pasta `data/` e roda sem depender do projeto original.

## Estrutura

- `index.html`: entrada principal do dashboard.
- `styles/main.css`: estilos da página, header e visualização.
- `js/main.js`: bootstrap da aplicação.
- `js/poc/studentJourneyPoc.js`: tratamento de dados e renderização da jornada.
- `js/poc/loadDashboardData.js`: carregamento dos CSVs.
- `data/`: cópia dos dados usados pela PoC.
- `js/vendor/lodash.js`: biblioteca local copiada do projeto original.

## Como rodar

Sirva a pasta com um servidor HTTP local e abra `index.html`.

Exemplo:

```bash
python -m http.server 8000
```
