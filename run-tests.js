#!/usr/bin/env node

const { runComprehensiveTests } = require('./automated-test-suite');
const { runMultiLanguageTests } = require('./multi-language-test-suite');
const fs = require('fs');

console.log('🎯 CodeMitra Test Suite Runner');
console.log('================================');

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'help';

// Test configuration
const TEST_CONFIGS = {
  'comprehensive': {
    name: 'Comprehensive Test Suite',
    description: 'Full platform testing with 6 users, Java room, and all features',
    runner: runComprehensiveTests,
    estimatedTime: '2-3 minutes'
  },
  'multi-language': {
    name: 'Multi-Language Test Suite',
    description: 'Test all 4 supported languages (Java, Python, C++, JavaScript) with 5 users',
    runner: runMultiLanguageTests,
    estimatedTime: '3-4 minutes'
  },
  'quick': {
    name: 'Quick Test Suite',
    description: 'Basic functionality test with 2 users and Java room',
    runner: () => runComprehensiveTests(2), // Limit to 2 users
    estimatedTime: '1-2 minutes'
  },
  'help': {
    name: 'Help',
    description: 'Show available test options',
    runner: null,
    estimatedTime: 'N/A'
  }
};

// Display help
function showHelp() {
  console.log('\n📋 Available Test Suites:');
  console.log('==========================');
  
  Object.entries(TEST_CONFIGS).forEach(([key, config]) => {
    if (key !== 'help') {
      console.log(`\n🔸 ${config.name}`);
      console.log(`   Command: npm test -- ${key}`);
      console.log(`   Description: ${config.description}`);
      console.log(`   Estimated Time: ${config.estimatedTime}`);
    }
  });
  
  console.log('\n📝 Usage Examples:');
  console.log('==================');
  console.log('  npm test -- comprehensive    # Run full comprehensive tests');
  console.log('  npm test -- multi-language   # Test all programming languages');
  console.log('  npm test -- quick            # Run quick basic tests');
  console.log('  npm test -- help             # Show this help message');
  
  console.log('\n⚠️  Prerequisites:');
  console.log('==================');
  console.log('  1. CodeMitra backend running on localhost:5001');
  console.log('  2. CodeMitra frontend running on localhost:3000');
  console.log('  3. All services (PostgreSQL, Redis, Worker) running');
  console.log('  4. Test dependencies installed (npm install)');
  
  console.log('\n🔧 Installation:');
  console.log('================');
  console.log('  npm install                  # Install test dependencies');
  console.log('  npm run install-deps         # Alternative installation');
  
  console.log('\n📊 Test Output:');
  console.log('================');
  console.log('  - Console logs with real-time progress');
  console.log('  - Screenshots saved to ./test-screenshots/');
  console.log('  - Detailed results in JSON format');
  console.log('  - Performance metrics and error reports');
}

// Check prerequisites
async function checkPrerequisites() {
  console.log('\n🔍 Checking Prerequisites...');
  
  const checks = [
    {
      name: 'Test Dependencies',
      check: () => {
        try {
          require.resolve('puppeteer');
          require.resolve('socket.io-client');
          return true;
        } catch (error) {
          return false;
        }
      },
      fix: 'Run: npm install'
    },
    {
      name: 'Backend Service',
      check: async () => {
        try {
          const http = require('http');
          return new Promise((resolve) => {
            const req = http.request('http://localhost:5001/healthz', { timeout: 5000 }, (res) => {
              resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => resolve(false));
            req.end();
          });
        } catch (error) {
          return false;
        }
      },
      fix: 'Start backend service: docker-compose -f docker-compose.dev.yml up backend'
    },
    {
      name: 'Frontend Service',
      check: async () => {
        try {
          const http = require('http');
          return new Promise((resolve) => {
            const req = http.request('http://localhost:3000', { timeout: 5000 }, (res) => {
              resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => resolve(false));
            req.end();
          });
        } catch (error) {
          return false;
        }
      },
      fix: 'Start frontend service: docker-compose -f docker-compose.dev.yml up frontend'
    }
  ];
  
  let allChecksPassed = true;
  
  for (const check of checks) {
    try {
      const result = await check.check();
      if (result) {
        console.log(`  ✅ ${check.name}: OK`);
      } else {
        console.log(`  ❌ ${check.name}: FAILED`);
        console.log(`     Fix: ${check.fix}`);
        allChecksPassed = false;
      }
    } catch (error) {
      console.log(`  ❌ ${check.name}: ERROR`);
      console.log(`     Fix: ${check.fix}`);
      allChecksPassed = false;
    }
  }
  
  return allChecksPassed;
}

// Main execution
async function main() {
  try {
    // Show help if requested
    if (testType === 'help') {
      showHelp();
      return;
    }
    
    // Check if test type exists
    if (!TEST_CONFIGS[testType]) {
      console.log(`❌ Unknown test type: ${testType}`);
      console.log('Run "npm test -- help" to see available options');
      process.exit(1);
    }
    
    const config = TEST_CONFIGS[testType];
    
    console.log(`\n🚀 Starting: ${config.name}`);
    console.log(`📝 Description: ${config.description}`);
    console.log(`⏱️  Estimated Time: ${config.estimatedTime}`);
    
    // Check prerequisites
    const prerequisitesOk = await checkPrerequisites();
    if (!prerequisitesOk) {
      console.log('\n❌ Prerequisites check failed. Please fix the issues above and try again.');
      process.exit(1);
    }
    
    console.log('\n✅ All prerequisites met. Starting tests...');
    console.log('==========================================\n');
    
    // Run the selected test suite
    const startTime = Date.now();
    await config.runner();
    const endTime = Date.now();
    
    console.log('\n==========================================');
    console.log(`✅ ${config.name} completed successfully!`);
    console.log(`⏱️  Total execution time: ${Math.round((endTime - startTime) / 1000)}s`);
    console.log('==========================================\n');
    
    console.log('📊 Test Results:');
    console.log('================');
    console.log('  - Check console output above for detailed results');
    console.log('  - Screenshots saved to ./test-screenshots/');
    console.log('  - Detailed results saved to JSON files');
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error('\n📋 For help, run: npm test -- help');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, checkPrerequisites, showHelp };
