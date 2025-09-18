import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Профиль - CryptoCRM',
  description: 'Управление личной информацией и настройками аккаунта',
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
