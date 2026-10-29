import Icon, { type IconName } from "../components/Icon";

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "home", title: "Início", text: "Mostra o mês fiscal atual: quanto você gastou em Despesas Gerais e no Supermercado, o saldo previsto e o orçamento do mercado. Use os cartões para ir a cada seção." },
  { icon: "target", title: "Planejamento Mensal", text: "No começo do mês, lance as receitas, as despesas fixas, os cartões de crédito e uma reserva para extras. Com parcelas, o item entra neste mês e nos seguintes. O saldo previsto é: receita − (fixas + cartões + extras). Dica: “Copiar mês anterior” evita começar do zero." },
  { icon: "list", title: "Listas de compras", text: "Crie uma lista (o nome é a data e a hora) e escolha o mercado: Nicolini ou Peruzzo. Busque os produtos, escolha a marca se quiser e ajuste a quantidade. O total estimado aparece em faixa, com base nos preços que você já pagou." },
  { icon: "cart", title: "No mercado", text: "Marque cada item ao colocar no carrinho e digite o preço da prateleira. Se pegar algo fora da lista, toque no botão da câmera e escaneie o código de barras: na primeira vez você diz qual produto e marca é, e depois ele é reconhecido sozinho. No fim, toque em “Finalizar compra”." },
  { icon: "box", title: "Produtos", text: "Veja o catálogo e os seus produtos, com o último preço pago. Em cada produto estão as marcas, os códigos de barras e o histórico de preços. Corrija um preço errado apagando-o do histórico." },
  { icon: "clock", title: "Histórico", text: "Lista as compras finalizadas, com data, mercado e total. Toque numa compra para ver os itens e os preços. Também dá para importar uma nota fiscal: pelo QR Code do cupom ou enviando o arquivo XML que o mercado manda por e-mail." },
  { icon: "wallet", title: "Despesas Gerais", text: "Contas de casa, transporte, lazer, saúde etc. Informe a descrição, o valor, a categoria e a data. O total entra no Início e no Previsto x Realizado." },
  { icon: "chart", title: "Estatísticas", text: "Gasto por setor e por produto, ticket médio, comparação dos últimos 6 meses, variação contra o mês anterior e as parcelas já comprometidas nos próximos meses. Use isso para ver onde dá para economizar." },
  { icon: "sliders", title: "Ajustes", text: "Defina o dia em que o seu mês fiscal começa (por exemplo, dia 10: o mês vai do dia 10 ao dia 9 do mês seguinte). Mudar esse dia recalcula os totais de todas as telas." },
];

export default function Tutorial() {
  return (
    <main>
      <h1>Como usar o app</h1>
      <p className="muted">Este guia explica cada seção do MeuSuper e como os cálculos funcionam.</p>
      <ul className="cards">
        {STEPS.map((s) => (
          <li key={s.title} className="tut">
            <span className="icon"><Icon name={s.icon} /></span>
            <div className="grow"><strong>{s.title}</strong><p>{s.text}</p></div>
          </li>
        ))}
      </ul>
      <section className="panel">
        <h2>Instalar no celular</h2>
        <p className="muted small">Android (Chrome): menu ⋮ → Instalar app. iPhone (Safari): botão de compartilhar → Adicionar à Tela de Início. Assim o MeuSuper abre em tela cheia, como um aplicativo.</p>
      </section>
    </main>
  );
}
