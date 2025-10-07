// Comprehensive error handler for browser extension and DevTools communication issues
(function() {
  'use strict';
  
  // Suppress common extension-related errors
  window.addEventListener('error', function(event) {
    const message = event.error ? event.error.message : event.message;
    if (message && (
      message.includes('Extension context invalidated') ||
      message.includes('message channel closed') ||
      message.includes('chrome-extension://') ||
      message.includes('moz-extension://') ||
      message.includes('A listener indicated an asynchronous response')
    )) {
      event.preventDefault();
      console.warn('Suppressed extension-related error:', message);
      return true;
    }
  });

  // Suppress unhandled promise rejections from extensions
  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    if (reason && reason.message && (
      reason.message.includes('Extension context invalidated') ||
      reason.message.includes('message channel closed') ||
      reason.message.includes('chrome-extension://') ||
      reason.message.includes('moz-extension://') ||
      reason.message.includes('A listener indicated an asynchronous response')
    )) {
      event.preventDefault();
      console.warn('Suppressed extension-related promise rejection:', reason.message);
    }
  });

  // Handle DevTools communication
  if (window.chrome && window.chrome.runtime) {
    try {
      // Intercept and fix async message handling
      const originalSendMessage = window.chrome.runtime.sendMessage;
      if (originalSendMessage) {
        window.chrome.runtime.sendMessage = function(...args) {
          try {
            return originalSendMessage.apply(this, args);
          } catch (error) {
            console.warn('Chrome runtime sendMessage error:', error.message);
            return Promise.resolve();
          }
        };
      }
    } catch (e) {
      // Ignore errors if chrome.runtime is not accessible
    }
  }

  console.log('🛡️ Extension error handler initialized');
})();
