import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Отчеты - CryptoCRM',
  description: 'Аналитика и отчеты по работе обменного сервиса',
}

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
