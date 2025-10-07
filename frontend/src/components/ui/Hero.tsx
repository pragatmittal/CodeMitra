'use client';

import * as React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Code2, 
  Users, 
  Video, 
  MessageSquare, 
  Shield, 
  Zap, 
  Globe, 
  Play,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

interface HeroProps {
  onLogin: () => void;
  onRegister: () => void;
}

export function Hero({ onLogin, onRegister }: HeroProps) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const features = [
    {
      icon: Code2,
      title: 'Real-time Collaboration',
      description: 'Code together in real-time with Monaco Editor'
    },
    {
      icon: Video,
      title: 'Video Calls',
      description: 'Built-in video calling with screen sharing'
    },
    {
      icon: MessageSquare,
      title: 'Live Chat',
      description: 'Communicate instantly with your team'
    },
    {
      icon: Shield,
      title: 'Secure Execution',
      description: 'Sandboxed code execution with Docker'
    },
    {
      icon: Zap,
      title: 'Multi-language',
      description: 'Support for 10+ programming languages'
    },
    {
      icon: Globe,
      title: 'Anywhere Access',
      description: 'Code from anywhere with cloud sync'
    }
  ];

  const languages = [
    'JavaScript', 'Python', 'Java', 'C++'
  ];

  const stats = [
    { value: '4', label: 'Languages' },
    { value: '99.9%', label: 'Uptime' },
    { value: '< 2s', label: 'Execution Time' },
    { value: '256MB', label: 'Memory Limit' }
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            CodeMitra
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={onLogin}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={onRegister}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="relative z-10 container mx-auto px-6 pt-20 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6"
            >
              <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium mb-6">
                🚀 Real-time Collaborative Coding
              </span>
              
              <h1 className="text-5xl md:text-7xl font-bold mb-6">
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Code Together,
                </span>
                <br />
                <span className="text-gray-900 dark:text-gray-100">
                  Create Magic
                </span>
              </h1>
              
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
                The ultimate collaborative coding platform with real-time editing, video calls, 
                secure code execution, and seamless team communication.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-16"
            >
              <button
                onClick={onRegister}
                className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <span className="flex items-center">
                  Start Coding Now
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
              
              <button
                onClick={() => setIsVideoPlaying(true)}
                className="group px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700"
              >
                <span className="flex items-center">
                  <Play className="mr-2 w-5 h-5 text-blue-600" />
                  Watch Demo
                </span>
              </button>
            </motion.div>

            {/* Language Pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-2 mb-16"
            >
              {languages.map((language, index) => (
                <span
                  key={language}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    index % 3 === 0 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : index % 3 === 1
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                  }`}
                >
                  {language}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16"
          >
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16"
          >
            {stats.map((stat, index) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm uppercase tracking-wide">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Social Proof */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="text-center"
          >
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Trusted by developers worldwide
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
              {/* Placeholder for company logos */}
              <div className="w-24 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="w-24 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="w-24 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="w-24 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Video Modal */}
      {isVideoPlaying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="relative w-full max-w-4xl mx-4">
            <button
              onClick={() => setIsVideoPlaying(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 text-2xl"
            >
              ×
            </button>
            <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
              <div className="text-center text-white">
                <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Demo video coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
