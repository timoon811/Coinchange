import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useApi } from '../use-api'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useApi hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useApi())

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(typeof result.current.execute).toBe('function')
  })

  it('should handle successful API call', async () => {
    const mockResponse = { success: true, data: { id: 1, name: 'Test' } }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const { result } = renderHook(() => useApi())

    let response
    await act(async () => {
      response = await result.current.execute('/api/test')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })
    expect(response).toEqual(mockResponse)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should handle API call with custom options', async () => {
    const mockResponse = { success: true, message: 'Created' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const { result } = renderHook(() => useApi())

    await act(async () => {
      await result.current.execute('/api/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: {
          'Authorization': 'Bearer token123',
        },
      })
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123',
      },
      credentials: 'include',
    })
  })

  it('should handle API error response', async () => {
    const errorResponse = { error: 'Not found', message: 'Resource not found' }
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve(errorResponse),
    })

    const { result } = renderHook(() => useApi())

    let response
    await act(async () => {
      response = await result.current.execute('/api/test')
    })

    expect(response).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('Not found')
  })

  it('should handle network error', async () => {
    const networkError = new Error('Network error')
    mockFetch.mockRejectedValueOnce(networkError)

    const { result } = renderHook(() => useApi())

    let response
    await act(async () => {
      response = await result.current.execute('/api/test')
    })

    expect(response).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('Network error')
  })

  it('should handle invalid JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON')),
    })

    const { result } = renderHook(() => useApi())

    let response
    await act(async () => {
      response = await result.current.execute('/api/test')
    })

    expect(response).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('Invalid JSON')
  })

  it('should set loading state correctly', async () => {
    let resolvePromise
    const promise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    mockFetch.mockReturnValueOnce({
      ok: true,
      json: () => promise,
    })

    const { result } = renderHook(() => useApi())

    // Start the request
    act(() => {
      result.current.execute('/api/test')
    })

    // Should be loading initially
    expect(result.current.loading).toBe(true)

    // Resolve the promise
    act(() => {
      resolvePromise({ success: true })
    })

    // Wait for loading to finish
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('should handle multiple concurrent requests', async () => {
    const mockResponse1 = { success: true, data: 'response1' }
    const mockResponse2 = { success: true, data: 'response2' }

    let callCount = 0
    mockFetch.mockImplementation(() => {
      callCount++
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(callCount === 1 ? mockResponse1 : mockResponse2),
      })
    })

    const { result } = renderHook(() => useApi())

    let response1, response2

    await act(async () => {
      response1 = await result.current.execute('/api/test1')
      response2 = await result.current.execute('/api/test2')
    })

    expect(response1).toEqual(mockResponse1)
    expect(response2).toEqual(mockResponse2)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should reset error on new successful request', async () => {
    // First request fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    })

    // Second request succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    const { result } = renderHook(() => useApi())

    // First failed request
    await act(async () => {
      await result.current.execute('/api/test')
    })

    expect(result.current.error).toBeTruthy()

    // Second successful request
    await act(async () => {
      await result.current.execute('/api/test')
    })

    expect(result.current.error).toBe(null)
  })

  it('should handle requests without JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('No content')),
    })

    const { result } = renderHook(() => useApi())

    let response
    await act(async () => {
      response = await result.current.execute('/api/test')
    })

    expect(response).toBeNull()
    expect(result.current.error).toBe('No content')
  })
})
