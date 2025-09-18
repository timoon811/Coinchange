import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Настройки - CryptoCRM',
  description: 'Админ панель управления системой',
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
