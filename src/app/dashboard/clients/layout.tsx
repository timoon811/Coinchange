import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Клиенты - CryptoCRM',
  description: 'Управление клиентами и их историей операций',
}

export default function ClientsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
