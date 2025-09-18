import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

interface ClientLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ClientLayoutProps): Promise<Metadata> {
  try {
    const resolvedParams = await params
    const client = await prisma.client.findUnique({
      where: { id: resolvedParams.id },
      select: {
        firstName: true,
        lastName: true,
        username: true,
      },
    })

    if (!client) {
      return {
        title: 'Клиент не найден - CryptoCRM',
      }
    }

    const displayName = client.firstName || client.lastName
      ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
      : client.username || 'Клиент'

    return {
      title: `${displayName} - CryptoCRM`,
      description: `Информация о клиенте ${displayName}`,
    }
  } catch (error) {
    return {
      title: 'Ошибка - CryptoCRM',
    }
  }
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
