import { Suspense } from "react";
import { Carregando } from "./Carregando";

/**
 * Todas as páginas dependem do login e do banco. Envolver o conteúdo aqui (e
 * não só no loading.tsx do grupo) faz a navegação entre páginas mostrar o
 * esqueleto na hora, em vez de esperar o servidor.
 */
export function Pagina({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Carregando />}>{children}</Suspense>;
}
