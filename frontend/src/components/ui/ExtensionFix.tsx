'use client';

import { useEffect } from 'react';

export function ExtensionFix() {
  useEffect(() => {
    // Prevent async message channel errors from browser extensions
    if (typeof window !== 'undefined') {
      // Override chrome.runtime if it exists (from extensions)
      if (window.chrome && window.chrome.runtime && window.chrome.runtime.onMessage) {
        const originalAddListener = window.chrome.runtime.onMessage.addListener;
        window.chrome.runtime.onMessage.addListener = function(listener) {
          const wrappedListener = function(message: any, sender: any, sendResponse: any) {
            try {
              const result = listener(message, sender, sendResponse);
              // If listener returns true but doesn't call sendResponse, handle it
              if (result === true) {
                // Set a timeout to call sendResponse if it hasn't been called
                setTimeout(() => {
                  try {
                    sendResponse({ success: true });
                  } catch (e) {
                    // Ignore errors if channel is already closed
                  }
                }, 0);
              }
              return result;
            } catch (error) {
              console.warn('Extension message listener error:', error);
              return false;
            }
          };
          return originalAddListener.call(this, wrappedListener);
        };
      }

      // Handle unhandled promise rejections that might come from extensions
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        if (event.reason && event.reason.message && 
            (event.reason.message.includes('message channel closed') ||
             event.reason.message.includes('Extension context invalidated'))) {
          event.preventDefault();
          console.warn('Suppressed extension-related error:', event.reason.message);
        }
      };

      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      // Cleanup
      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
  }, []);

  return null;
}

// Type declaration for chrome API
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        onMessage?: {
          addListener: (listener: Function) => void;
        };
      };
    };
  }
}
