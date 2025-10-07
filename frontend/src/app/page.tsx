'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Hero } from '@/components/ui/Hero';
import { Features } from '@/components/ui/Features';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [showAuth, setShowAuth] = useState<'login' | 'register' | null>(null);

  useEffect(() => {
    if (user && !isLoading) {
      // Redirect to dashboard for authenticated users
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Hero onLogin={() => setShowAuth('login')} onRegister={() => setShowAuth('register')} />
      
      <Features />
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">CodeMitra</h3>
              <p className="text-gray-400">
                A real-time collaborative coding platform for developers.
              </p>
            </div>
            <div>
              <h4 className="text-md font-medium mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Real-time Code Collaboration</li>
                <li>Live Code Execution</li>
                <li>Secure Room Management</li>
                <li>Multi-language Support</li>
                <li>User Authentication</li>
              </ul>
            </div>
            <div>
              <h4 className="text-md font-medium mb-4">Technology</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Next.js & React</li>
                <li>TypeScript</li>
                <li>Socket.IO</li>
                <li>PostgreSQL</li>
                <li>Docker</li>
              </ul>
            </div>
            <div>
              <h4 className="text-md font-medium mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Documentation</li>
                <li>API Reference</li>
                <li>Community</li>
                <li>Contact</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 CodeMitra. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Auth Modals */}
      {showAuth === 'login' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Sign In</h2>
              <button
                onClick={() => setShowAuth(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <LoginForm onSuccess={() => setShowAuth(null)} />
            <p className="text-center mt-4 text-gray-600">
              Don&apos;t have an account?{' '}
              <button
                onClick={() => setShowAuth('register')}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      )}

      {showAuth === 'register' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Sign Up</h2>
              <button
                onClick={() => setShowAuth(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <RegisterForm onSuccess={() => setShowAuth(null)} />
            <p className="text-center mt-4 text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => setShowAuth('login')}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}