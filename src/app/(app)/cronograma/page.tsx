import { redirect } from "next/navigation";

// "Cronograma" no menu é só o título do grupo; o endereço sem atividade abre o café.
export default function CronogramaInicio() {
  redirect("/cronograma/cafe");
}
