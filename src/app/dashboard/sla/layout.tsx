import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SLA Мониторинг - CryptoCRM',
  description: 'Мониторинг просроченных заявок и SLA',
}

export default function SLALayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
