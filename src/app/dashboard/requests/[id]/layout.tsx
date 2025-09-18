import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

interface RequestLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: RequestLayoutProps): Promise<Metadata> {
  try {
    const { id } = await params
    const request = await prisma.request.findUnique({
      where: { id },
      select: {
        requestId: true,
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        direction: true,
        status: true,
      },
    })

    if (!request) {
      return {
        title: 'Заявка не найдена - CryptoCRM',
      }
    }

    return {
      title: `Заявка ${request.requestId} - CryptoCRM`,
      description: `Заявка клиента ${request.client?.firstName || ''} ${request.client?.lastName || ''}`,
    }
  } catch (error) {
    return {
      title: 'Ошибка - CryptoCRM',
    }
  }
}

export default function RequestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
