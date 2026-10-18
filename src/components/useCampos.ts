import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

type Elemento = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Campos controlados para formulários com `<form action>`: o React limpa campos não controlados
 * depois de cada envio, inclusive quando a ação devolve erro, e o usuário perderia o que digitou.
 * `vincular(nome)` devolve `name`, `value` e `onChange`; `limpar()` volta aos valores iniciais.
 */
export function useCampos<T extends Record<string, string>>(iniciais: T | (() => T)) {
  const [valores, setValores] = useState(iniciais);
  const primeiros = useRef(valores);
  const vincular = (nome: keyof T & string) => ({
    name: nome,
    value: valores[nome],
    onChange: (e: ChangeEvent<Elemento>) => setValores((v) => ({ ...v, [nome]: e.target.value })),
  });
  const limpar = () => setValores(primeiros.current);
  return { valores, vincular, limpar };
}

/**
 * `onReset` para formulários com `<select>` controlado: depois do reset automático o React restaura
 * o valor dos `<input>` controlados, mas não o dos `<select>`, que voltam para a primeira opção na tela.
 * Cancelar o evento evita o reset; a limpeza após sucesso fica a cargo de `limpar()`.
 */
export const cancelarReset = (e: FormEvent<HTMLFormElement>) => e.preventDefault();
