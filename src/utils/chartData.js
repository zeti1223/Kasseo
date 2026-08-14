const PALETTE = ['#C8A5FC', '#A5E3FC', '#A7F49D', '#D89B3C', '#C1503A', '#8A5FBF', '#7A6248', '#5C7A99']

export function buildBalanceOverTime(transactions) {
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date))
  let balance = 0
  const labels = []
  const data = []
  for (const tx of sorted) {
    balance += tx.type === 'deposit' ? tx.amount : -tx.amount
    labels.push(tx.date)
    data.push(Number(balance.toFixed(2)))
  }
  return {
    labels,
    datasets: [
      {
        label: 'Balance',
        data,
        borderColor: '#C8A5FC',
        backgroundColor: 'rgba(200, 165, 252, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  }
}

export function buildCategoryBreakdown(transactions) {
  const totals = {}
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + t.amount
    })
  const labels = Object.keys(totals)
  return {
    labels,
    datasets: [
      {
        data: Object.values(totals),
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 0,
      },
    ],
  }
}

export function buildMemberBreakdown(transactions, members) {
  const memberIds = Object.keys(members || {})
  const deposited = memberIds.map((uid) =>
    transactions.filter((t) => t.paidBy === uid && t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  )
  const spent = memberIds.map((uid) =>
    transactions.filter((t) => t.paidBy === uid && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  )
  return {
    labels: memberIds.map((uid) => members[uid]?.displayName || 'Someone'),
    datasets: [
      { label: 'Deposited', data: deposited, backgroundColor: '#A7F49D' },
      { label: 'Spent', data: spent, backgroundColor: '#C1503A' },
    ],
  }
}
