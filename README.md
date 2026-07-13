# Dataviz Dashboard - Jornada do Estudante

Dashboard educacional focado em Learning Analytics e Data Storytelling para explorar trajetorias de estudantes em atividades avaliativas.

O nucleo visual da aplicacao e um grafico de trajetorias com D3.js (modelo de fluxo por passos, estilo coordenadas paralelas discretas), combinado com narrativas guiadas (estorias) que destacam padroes de comportamento, risco e conversao.

## Objetivo do projeto

Este frontend foi desenhado para responder perguntas como:

- Como os estudantes percorrem os eventos ate a entrega?
- Quais rotas concentram maior volume de alunos?
- Onde acontecem gargalos de conversao (ex.: tentou e nao entregou)?
- Quais padroes valem uma narrativa pedagogica (storytelling analitico)?

Em termos de produto, o painel combina:

- Exploração visual interativa (filtro de atividade, volume minimo e modo de narrativa)
- Destaque contextual de rotas
- Menu lateral de estorias por categoria
- Tooltip narrativo com metrica de impacto

## Stack e tecnologias

### Stack implementada nesta pasta (Dataviz_Dashboard)

- HTML5
- CSS3 (layout flex, estilos responsivos)
- JavaScript ES Modules
- D3.js v6
- Lodash
- Font Awesome (icones)

### Stack do ecossistema/alvo de evolucao

Este projeto pode ser migrado ou integrado a uma base moderna com:

- React
- Next.js
- Tailwind CSS
- Mantine

Observacao: nesta pasta especifica, a implementacao atual e vanilla (sem build step).

## Arquitetura funcional

- Entrada da aplicacao: `index.html`
- Bootstrap do frontend: `js/main.js`
- Carregamento e padronizacao de dados da API: `js/poc/loadDashboardData.js`
- Regras de negocio + renderizacao D3 + storytelling: `js/poc/studentJourneyPoc.js`
- Estilos globais e layout: `styles/main.css`

Fluxo resumido:

1. O frontend busca metadados das atividades em `/api/meta`.
2. Para cada atividade, busca timeline em `/api/timeline`.
3. Os eventos sao mapeados e agregados em rotas por usuario.
4. As rotas sao agrupadas por sequencia e volume.
5. O grafico renderiza as rotas e aplica estados de destaque/decluttering.
6. O painel lateral exibe estorias conectadas a rotas e usuarios afetados.

## Estrutura de pastas

```text
Dataviz_Dashboard/
	index.html
	styles/
		main.css
	js/
		main.js
		poc/
			loadDashboardData.js
			studentJourneyPoc.js
		vendor/
			d3.v6.min.js
			lodash.js
	data/
		...
```

## Tutorial de execucao local

## 1) Pre-requisitos

- Python 3.x ou Node.js (apenas para servir arquivos estaticos)
- API backend acessivel (ex.: `ws-mestrado/backend`) com endpoints:
	- `GET /api/meta`
	- `POST /api/timeline`

## 2) Iniciar a API (backend)

Garanta que o backend esteja ativo e respondendo em uma URL conhecida.

Exemplo comum:

- `http://localhost:8000`

## 3) Subir o frontend estatico

No diretorio `Dataviz_Dashboard`, rode:

```bash
python3 -m http.server 5500
```

Abra no navegador:

```text
http://localhost:5500
```

## 4) Configurar endpoint da API (equivalente a .env)

Este frontend nao usa `.env` nativo porque nao possui bundler. A configuracao e feita via variavel global no browser.

Por padrao, o cliente usa:

```text
http://localhost:8000
```

Para sobrescrever, declare `window.DATAVIZ_API_URL` antes do carregamento do script principal no `index.html`:

```html
<script>
	window.DATAVIZ_API_URL = "http://localhost:8000";
</script>
<script src="./js/main.js" type="module"></script>
```

Se voce estiver usando uma stack React/Next.js em outra base, ai sim a configuracao costuma ir para `.env` (ex.: `NEXT_PUBLIC_API_URL`).

## 5) Validar funcionamento

Checklist rapido:

- O seletor de atividade e preenchido
- O grafico renderiza rotas
- O filtro de volume altera a quantidade de rotas
- O modo finalizadas/nao finalizadas funciona
- O painel de estorias permite destaque de rotas

## 6) Troubleshooting

- Tela vazia ou sem rotas:
	- Verifique se a API respondeu sem erro CORS
	- Confirme se `window.DATAVIZ_API_URL` aponta para a URL correta
- Erro `API 404` ou `API 500`:
	- Confira se os endpoints `/api/meta` e `/api/timeline` existem e estao ativos
- Estilos quebrados:
	- Confirme o carregamento de `styles/main.css`
- Icones nao aparecem:
	- Verifique acesso ao CDN do Font Awesome

## Principais recursos analiticos

- Agrupamento de trajetorias por sequencia de eventos
- Simplificacao de sequencias de atividade (visualizacao, tentativa, entrega)
- Metrica de volume por rota
- Integracao de storytelling por categoria, severidade e impacto
- Destaque visual por rota selecionada, rota em hover e rota ligada a estoria

## Roadmap sugerido

- Migracao para componentes React para modularizar filtros e painel narrativo
- Uso de Next.js para deploy e roteamento
- Adoção de Tailwind/Mantine para escalabilidade de design system
- Testes de regressao visual para o grafico D3
- Telemetria de interacao (cliques, filtros, tempo em rota)

## Licenciamento e dados

- O codigo segue o padrao do repositorio principal.
- Os dados em `data/` sao de apoio historico/local e podem exigir tratamento de privacidade antes de uso externo.
