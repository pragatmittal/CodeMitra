'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { 
  Code2, 
  Users, 
  Video, 
  MessageSquare, 
  Shield, 
  Zap, 
  Globe,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: Code2,
      title: 'Real-time Collaborative Editing',
      description: 'Multiple developers can edit code simultaneously with live cursor tracking, syntax highlighting, and instant synchronization.',
      benefits: ['Live cursor tracking', 'Syntax highlighting', 'Auto-completion', 'Real-time sync']
    },
    
    
    {
      icon: Shield,
      title: 'Secure Code Execution',
      description: 'Run code safely in isolated Docker containers with resource limits and security scanning.',
      benefits: ['Docker isolation', 'Resource limits', 'Security scanning', 'Safe execution']
    },
    {
      icon: Zap,
      title: 'Multi-language Support',
      description: 'Support for 10+ programming languages with intelligent syntax highlighting and language-specific features.',
      benefits: ['4 languages', 'Smart completion', 'Error detection', 'Debugging tools']
    },
    {
      icon: Globe,
      title: 'Cloud-based Platform',
      description: 'Access your code from anywhere with cloud storage, backup, and synchronization across all devices.',
      benefits: ['Cloud storage', 'Auto backup', 'Cross-device sync', 'Version control']
    }
  ];

  return (
    <section className="py-20 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium mb-6">
                ✨ Powerful Features
              </span>
              
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                Everything You Need for
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {' '}Collaborative Coding
                </span>
              </h2>
              
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                CodeMitra combines the best of code editing, communication, and collaboration tools 
                into one seamless platform designed for modern development teams.
              </p>
            </motion.div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group"
              >
                <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500">
                  {/* Icon */}
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl group-hover:scale-110 transition-transform">
                      <feature.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 ml-4">
                      {feature.title}
                    </h3>
                  </div>
                  
                  {/* Description */}
                  <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                    {feature.description}
                  </p>
                  
                  {/* Benefits */}
                  <div className="grid grid-cols-2 gap-3">
                    {feature.benefits.map((benefit, benefitIndex) => (
                      <div
                        key={benefitIndex}
                        className="flex items-center text-sm text-gray-700 dark:text-gray-300"
                      >
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            viewport={{ once: true }}
            className="text-center mt-20"
          >
            <div className="p-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl text-white">
              <h3 className="text-3xl font-bold mb-4">
                Ready to Transform Your Development Workflow?
              </h3>
              <p className="text-xl mb-8 opacity-90">
                Join thousands of developers who are already collaborating more effectively with CodeMitra.
              </p>
              <button className="group px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-all duration-300 transform hover:scale-105">
                <span className="flex items-center">
                  Start Your Free Trial
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
