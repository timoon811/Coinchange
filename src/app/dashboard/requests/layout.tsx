import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Заявки - CryptoCRM',
  description: 'Управление заявками на обмен криптовалюты',
}

export default function RequestsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
