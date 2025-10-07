'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// Configure axios defaults
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.timeout = 10000;

// Add request interceptor to include auth token
axios.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if this is a validation error vs authentication error
      const errorMessage = error.response?.data?.error || '';
      
      // Don't logout for business logic errors (room validation, etc.)
      if (errorMessage.includes('Room requires a password') || 
          errorMessage.includes('Invalid room password') ||
          errorMessage.includes('Room not found') ||
          errorMessage.includes('Room is full')) {
        console.log('🔒 Business logic error, not logging out:', errorMessage);
        return Promise.reject(error);
      }
      
      // Only logout for actual authentication failures
      console.log('🚨 Authentication error, logging out:', errorMessage);
      Cookies.remove('token');
      Cookies.remove('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for existing auth on mount
    const savedToken = Cookies.get('token');
    const savedUser = Cookies.get('user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        Cookies.remove('token');
        Cookies.remove('user');
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await axios.post('/api/auth/login', {
        email,
        password,
      });

      const { token: newToken, user: newUser } = response.data;

      // Save to cookies
      Cookies.set('token', newToken, { expires: 7 });
      Cookies.set('user', JSON.stringify(newUser), { expires: 7 });

      setToken(newToken);
      setUser(newUser);

      toast.success('Login successful!');
      router.push('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.error || 'Login failed';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      const response = await axios.post('/api/auth/register', {
        email,
        password,
        name,
      });

      const { token: newToken, user: newUser } = response.data;

      // Save to cookies
      Cookies.set('token', newToken, { expires: 7 });
      Cookies.set('user', JSON.stringify(newUser), { expires: 7 });

      setToken(newToken);
      setUser(newUser);

      toast.success('Registration successful!');
      router.push('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.error || 'Registration failed';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    Cookies.remove('token');
    Cookies.remove('user');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully');
    router.push('/');
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      Cookies.set('user', JSON.stringify(updatedUser), { expires: 7 });
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// API helper functions
export const api = {
  get: async (url: string) => {
    const response = await axios.get(url);
    return response.data;
  },

  post: async (url: string, data: any) => {
    const response = await axios.post(url, data);
    return response.data;
  },

  put: async (url: string, data: any) => {
    const response = await axios.put(url, data);
    return response.data;
  },

  delete: async (url: string) => {
    const response = await axios.delete(url);
    return response.data;
  },
};

// User profile API
export const userApi = {
  getProfile: () => api.get('/api/users/profile'),
  updateProfile: (data: Partial<User>) => api.put('/api/users/profile', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/api/users/password', { currentPassword, newPassword }),
  getUserRooms: (page = 1, limit = 10) =>
    api.get(`/api/users/rooms?page=${page}&limit=${limit}`),
  getUserActivity: () => api.get('/api/users/activity'),
  deleteAccount: () => api.delete('/api/users/account'),
};
