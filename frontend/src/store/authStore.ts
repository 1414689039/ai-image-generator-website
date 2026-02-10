import { create } from 'zustand'
import axios from 'axios'
import { useGenerationStore } from './generationStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

interface User {
  id: number
  username: string
  email: string
  points: number
  isAdmin: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isAuthModalOpen: boolean
  authModalTab: 'login' | 'register'
  openAuthModal: (tab?: 'login' | 'register') => void
  closeAuthModal: () => void
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  fetchUserInfo: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => {
  // 从localStorage恢复token
  const savedToken = localStorage.getItem('token')
  if (savedToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
  }

  return {
    user: null,
    token: savedToken,
    isAuthenticated: !!savedToken,
    isAuthModalOpen: false,
    authModalTab: 'login',

    openAuthModal: (tab = 'login') => set({ isAuthModalOpen: true, authModalTab: tab }),
    closeAuthModal: () => set({ isAuthModalOpen: false }),

    login: async (username: string, password: string) => {
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
          username,
          password,
        })

        const { token, user } = response.data
        localStorage.setItem('token', token)
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

        set({ token, user, isAuthenticated: true })
      } catch (error: any) {
        throw new Error(error.response?.data?.error || '登录失败')
      }
    },

    register: async (username: string, email: string, password: string) => {
      try {
        await axios.post(`${API_BASE_URL}/auth/register`, {
          username,
          email,
          password,
        })
      } catch (error: any) {
        throw new Error(error.response?.data?.error || '注册失败')
      }
    },

    logout: () => {
      localStorage.removeItem('token')
      delete axios.defaults.headers.common['Authorization']
      useGenerationStore.getState().clearHistory()
      set({ token: null, user: null, isAuthenticated: false })
    },

    fetchUserInfo: async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/user/me`)
        set({ user: response.data })
      } catch (error: any) {
        // 如果获取用户信息失败，清除token
        get().logout()
      }
    },
  }
})

