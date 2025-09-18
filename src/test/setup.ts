import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Set up test environment variables
process.env.JWT_SECRET = 'a'.repeat(32) // 32 character JWT secret for tests
process.env.ENCRYPTION_KEY = 'a'.repeat(64) // 64 character encryption key for tests
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Mock Next.js router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  pathname: '/',
  query: '',
  asPath: '/',
}

vi.mock('next/router', () => ({
  useRouter: () => mockRouter,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock

// Mock fetch
global.fetch = vi.fn()

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock crypto
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(),
    createCipherGCM: vi.fn(),
    createDecipherGCM: vi.fn(),
    createHash: vi.fn(),
  },
}))
