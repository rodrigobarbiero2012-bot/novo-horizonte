# Novo Horizonte

Gestão financeira, contábil e de produção do Sítio Novo Horizonte (café, maracujá e pecuária). Os requisitos ficam em `H:\Claude Code\sitio-novo-horizonte\REQUISITOS.md`.

Stack: Next.js 16 + Prisma 7 + Postgres (Neon em produção, `prisma dev` local) + Vercel.

## Modelo contábil

- Partidas dobradas: um `Lancamento` tem duas ou mais `Partida`s, e a soma delas é zero. Valor positivo é débito e negativo é crédito, sempre em centavos.
- Em que linha da DRE ou do Balanço a conta cai depende da `categoria` e da `atividade` da `Conta`. Ver `src/lib/contabil/tipos.ts`.
- `src/lib/contabil/relatorios.ts` calcula a DRE anual e o Balanço com as mesmas regras da planilha.

## Telas

Login · Painel · Novo lançamento · Razão (filtros + saldo corrido por conta) · Lançamento (editar/excluir, com histórico de alterações) · DRE · Balanço · Fluxo de caixa (anual e mês a mês) · Plano de contas.

- **Login:** sessão em cookie assinado (`src/lib/sessao.ts`, `AUTH_SECRET` no `.env`). O `src/proxy.ts` barra quem não tem cookie, e cada página chama `exigirUsuario()`.
- **Usuários:** `npm run criar-usuario -- --nome "Nome" --email email@dominio`. Gera uma senha e mostra uma única vez.
- **Auditoria:** toda criação, alteração e exclusão grava `RegistroAuditoria` com o usuário e o estado antes e depois.
- **Rodar local:** `npm run dev`. O banco local precisa estar no ar (`npx prisma dev start novo-horizonte`).

## Produção

- **Site:** Vercel, com deploy automático a cada push no `main`. As variáveis `DATABASE_URL` e `AUTH_SECRET` ficam nas Environment Variables do projeto.
- **Banco:** Neon, em São Paulo (sa-east-1). Os valores locais ficam em `.env.producao`, que está fora do git.
- **Comandos de produção** (todos pela porta 443):
  - `npm run producao:migrar`: aplica migrações novas. Rodar **antes** do push que depende delas.
  - `npm run producao:importar`, `npm run producao:conferir`
  - `npm run producao:criar-usuario -- --nome "…" --email …`

## Importação da planilha histórica (2014–2026)

Os dados reais ficam em `data/import/`, que é ignorado pelo git por serem confidenciais.

```bash
npx prisma dev --name novo-horizonte --detach   # banco local; põe a URL impressa no .env
npx prisma migrate dev
npm run extrair -- "<caminho>/Sitio Novo Horizonte - Gerencial Financeiro_2.xlsx"
npm run conferir      # recalcula DRE e Balanço a partir do JSON e compara com o Excel
npm run importar      # grava no banco e confere de novo, lendo do banco
npm run conferir:banco  # a qualquer momento: banco atual × planilha
npm test
```
