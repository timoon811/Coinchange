import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationsDropdown } from '../notifications-dropdown'

// Mock зависимостей
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: '123',
      username: 'testuser',
      role: 'CASHIER',
    },
  }),
}))

vi.mock('@/hooks/use-api', () => ({
  useApi: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-is-mounted', () => ({
  useIsMounted: () => true,
}))

describe('NotificationsDropdown', () => {
  const mockExecute = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock useApi hook
    const mockUseApi = vi.fn().mockReturnValue({
      execute: mockExecute,
      loading: false,
    })

    vi.mocked(vi.importMock('@/hooks/use-api').useApi).mockImplementation(mockUseApi)
  })

  it('should render notification bell icon', () => {
    render(<NotificationsDropdown />)

    const bellIcon = screen.getByRole('button')
    expect(bellIcon).toBeInTheDocument()
  })

  it('should show unread count badge when there are unread notifications', async () => {
    mockExecute.mockResolvedValue({
      data: [
        {
          id: '1',
          type: 'NEW_REQUEST',
          title: 'Новая заявка',
          message: 'Поступила новая заявка',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          type: 'SYSTEM',
          title: 'Системное уведомление',
          message: 'Тестовое уведомление',
          isRead: true,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    })

    render(<NotificationsDropdown />)

    const dropdownTrigger = screen.getByRole('button')
    fireEvent.click(dropdownTrigger)

    await waitFor(() => {
      const badge = screen.getByText('1')
      expect(badge).toBeInTheDocument()
    })
  })

  it('should display notification list when dropdown is opened', async () => {
    mockExecute.mockResolvedValue({
      data: [
        {
          id: '1',
          type: 'NEW_REQUEST',
          title: 'Новая заявка',
          message: 'Поступила новая заявка от клиента Иван',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    })

    render(<NotificationsDropdown />)

    const dropdownTrigger = screen.getByRole('button')
    fireEvent.click(dropdownTrigger)

    await waitFor(() => {
      expect(screen.getByText('Новая заявка')).toBeInTheDocument()
      expect(screen.getByText('Поступила новая заявка от клиента Иван')).toBeInTheDocument()
    })
  })

  it('should show empty state when no notifications', async () => {
    mockExecute.mockResolvedValue({
      data: [],
      unreadCount: 0,
    })

    render(<NotificationsDropdown />)

    const dropdownTrigger = screen.getByRole('button')
    fireEvent.click(dropdownTrigger)

    await waitFor(() => {
      expect(screen.getByText('Нет уведомлений')).toBeInTheDocument()
    })
  })

  it('should mark notification as read when clicked', async () => {
    const mockMarkAsRead = vi.fn()
    mockExecute.mockResolvedValue({
      data: [
        {
          id: '1',
          type: 'NEW_REQUEST',
          title: 'Новая заявка',
          message: 'Поступила новая заявка',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    })

    vi.mocked(vi.importMock('@/hooks/use-api').useApi).mockReturnValue({
      execute: mockMarkAsRead,
      loading: false,
    })

    render(<NotificationsDropdown />)

    const dropdownTrigger = screen.getByRole('button')
    fireEvent.click(dropdownTrigger)

    await waitFor(() => {
      const notification = screen.getByText('Новая заявка')
      fireEvent.click(notification)

      expect(mockMarkAsRead).toHaveBeenCalledWith('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'mark_read',
          notificationIds: ['1'],
        }),
      })
    })
  })

  it('should mark all notifications as read', async () => {
    const mockMarkAllRead = vi.fn()
    mockExecute.mockResolvedValue({
      data: [
        {
          id: '1',
          type: 'NEW_REQUEST',
          title: 'Новая заявка',
          message: 'Поступила новая заявка',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    })

    vi.mocked(vi.importMock('@/hooks/use-api').useApi).mockReturnValue({
      execute: mockMarkAllRead,
      loading: false,
    })

    render(<NotificationsDropdown />)

    const dropdownTrigger = screen.getByRole('button')
    fireEvent.click(dropdownTrigger)

    await waitFor(() => {
      const markAllButton = screen.getByText('Отметить все прочитанными')
      fireEvent.click(markAllButton)

      expect(mockMarkAllRead).toHaveBeenCalledWith('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'mark_all_read',
        }),
      })
    })
  })

  it('should delete notification', async () => {
    const mockDelete = vi.fn()
    mockExecute.mockResolvedValue({
      data: [
        {
          id: '1',
          type: 'NEW_REQUEST',
          title: 'Новая заявка',
          message: 'Поступила новая заявка',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    })

    vi.mocked(vi.importMock('@/hooks/use-api').useApi).mockReturnValue({
      execute: mockDelete,
      loading: false,
    })

    render(<NotificationsDropdown />)

    const dropdownTrigger = screen.getByRole('button')
    fireEvent.click(dropdownTrigger)

    await waitFor(() => {
      const deleteButton = screen.getByLabelText('Удалить уведомление')
      fireEvent.click(deleteButton)

      expect(mockDelete).toHaveBeenCalledWith('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'delete',
          notificationIds: ['1'],
        }),
      })
    })
  })

  it('should navigate to request when notification with requestId is clicked', async () => {
    const mockRouter = { push: vi.fn() }
    vi.mocked(vi.importMock('next/navigation').useRouter).mockReturnValue(mockRouter)

    mockExecute.mockResolvedValue({
      data: [
        {
          id: '1',
          type: 'NEW_REQUEST',
          title: 'Новая заявка',
          message: 'Поступила новая заявка',
          isRead: false,
          createdAt: new Date().toISOString(),
          payload: {
            requestId: 'req123',
          },
        },
      ],
      unreadCount: 1,
    })

    render(<NotificationsDropdown />)

    const dropdownTrigger = screen.getByRole('button')
    fireEvent.click(dropdownTrigger)

    await waitFor(() => {
      const notification = screen.getByText('Новая заявка')
      fireEvent.click(notification)

      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/requests/req123')
    })
  })

  it('should not render when user is not authenticated', () => {
    vi.mocked(vi.importMock('@/components/auth-provider').useAuth).mockReturnValue({
      user: null,
    })

    const { container } = render(<NotificationsDropdown />)
    expect(container.firstChild).toBeNull()
  })
})
