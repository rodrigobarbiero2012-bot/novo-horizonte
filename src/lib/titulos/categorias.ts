import type { TipoTitulo } from "./regras";

// Em que contas um título pode ser lançado e de onde sai (ou entra) o dinheiro na baixa.

const PAGAR = ["Custeio", "Despesa Administrativa", "Despesa Financeira", "Ativo Imobilizado", "Ativo Estoque", "Passivo Empréstimo", "Passivo Fornecedor"];
const RECEBER = ["Receita", "Receita Não Operacional"];

export const categoriasDoTitulo = (tipo: TipoTitulo) => (tipo === "PAGAR" ? PAGAR : RECEBER);

/** Contas de pagamento/recebimento: bancos, aplicações e a conta-corrente do sócio. */
export const CATEGORIAS_BAIXA = ["Ativo Caixa/Banco", "Ativo Aplicação Financeira", "PL Capital Sócio"];
