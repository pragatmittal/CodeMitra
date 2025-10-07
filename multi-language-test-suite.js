const { io } = require('socket.io-client');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

console.log('🌐 Starting Multi-Language Test Suite for CodeMitra...');

// Test Configuration
const TEST_CONFIG = {
  backendUrl: 'http://localhost:5001',
  frontendUrl: 'http://localhost:3000',
  testUsers: 5,
  testTimeout: 180000, // 3 minutes
  screenshotDir: './test-screenshots-multi-lang',
  logFile: './multi-language-test-results.log'
};

// Language-specific test configurations
const LANGUAGE_TESTS = {
  java: {
    name: 'Java Test Room',
    language: 'java',
    initialCode: `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello from User1");
    }
}`,
    user2Addition: `        System.out.println("Hello from User2");`,
    user3Modification: 'Modified by User3',
    expectedOutput: 'Hello from User1'
  },
  python: {
    name: 'Python Test Room',
    language: 'python',
    initialCode: `print("Hello from User1")
def greet(name):
    return f"Hello {name}!"`,
    user2Addition: `print(greet("User2"))`,
    user3Modification: 'Modified by User3',
    expectedOutput: 'Hello from User1'
  },
  cpp: {
    name: 'C++ Test Room',
    language: 'cpp',
    initialCode: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello from User1" << endl;
    return 0;
}`,
    user2Addition: `    cout << "Hello from User2" << endl;`,
    user3Modification: 'Modified by User3',
    expectedOutput: 'Hello from User1'
  },
  javascript: {
    name: 'JavaScript Test Room',
    language: 'javascript',
    initialCode: `console.log("Hello from User1");

function greet(name) {
    return \`Hello \${name}!\`;
}`,
    user2Addition: `console.log(greet("User2"));`,
    user3Modification: 'Modified by User3',
    expectedOutput: 'Hello from User1'
  }
};

// Test Results Storage
const testResults = {
  startTime: new Date(),
  languages: {},
  errors: [],
  performance: {},
  summary: {}
};

// Test Users Data
const testUsers = [];
const userSockets = [];

// Logger
class MultiLanguageLogger {
  constructor() {
    this.logs = [];
    this.startTime = Date.now();
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      elapsed: Date.now() - this.startTime
    };
    
    this.logs.push(logEntry);
    
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    if (data) {
      console.log(logMessage, JSON.stringify(data, null, 2));
    } else {
      console.log(logMessage);
    }
    
    // Write to file
    fs.appendFileSync(TEST_CONFIG.logFile, logMessage + '\n');
  }

  info(message, data = null) {
    this.log('INFO', message, data);
  }

  success(message, data = null) {
    this.log('SUCCESS', message, data);
  }

  error(message, data = null) {
    this.log('ERROR', message, data);
    testResults.errors.push({ message, data, timestamp: new Date() });
  }

  debug(message, data = null) {
    this.log('DEBUG', message, data);
  }

  performance(metric, value) {
    this.log('PERFORMANCE', `${metric}: ${value}ms`, { metric, value });
    if (!testResults.performance[metric]) {
      testResults.performance[metric] = [];
    }
    testResults.performance[metric].push(value);
  }
}

const logger = new MultiLanguageLogger();

// Utility Functions
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
  try {
    const screenshotPath = path.join(TEST_CONFIG.screenshotDir, `${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.debug(`Screenshot saved: ${screenshotPath}`);
  } catch (error) {
    logger.error(`Failed to take screenshot: ${name}`, error);
  }
}

// User Registration Helper
async function registerTestUser(browser, userIndex) {
  const userEmail = `testuser${userIndex}@test.com`;
  const userName = `TestUser${userIndex}`;
  const password = 'testpass123';

  try {
    const page = await browser.newPage();
    
    // Navigate to registration page
    await page.goto(`${TEST_CONFIG.frontendUrl}/register`);
    await sleep(1000);
    
    // Fill registration form
    await page.type('input[name="name"]', userName);
    await page.type('input[name="email"]', userEmail);
    await page.type('input[name="password"]', password);
    await page.type('input[name="confirmPassword"]', password);
    
    // Submit form
    await page.click('button[type="submit"]');
    await sleep(2000);
    
    // Check if registration was successful
    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard')) {
      logger.success(`User ${userIndex} registration successful: ${userEmail}`);
      
      // Get auth token from localStorage
      const token = await page.evaluate(() => localStorage.getItem('token'));
      
      testUsers.push({
        index: userIndex,
        email: userEmail,
        name: userName,
        password: password,
        token: token,
        page: page
      });
      
      return { success: true, token, page };
    } else {
      logger.error(`User ${userIndex} registration failed: ${userEmail}`);
      return { success: false, error: 'Registration failed' };
    }
  } catch (error) {
    logger.error(`User ${userIndex} registration error`, error);
    return { success: false, error: error.message };
  }
}

// Socket.IO Connection Helper
async function connectUserSocket(userIndex, token) {
  try {
    const socket = io(TEST_CONFIG.backendUrl, {
      auth: { token },
      timeout: 10000,
      retries: 3,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 10000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        logger.success(`User ${userIndex} Socket.IO connected: ${socket.id}`);
        userSockets.push({ userIndex, socket });
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        logger.error(`User ${userIndex} Socket.IO connection error`, error);
        reject(error);
      });
    });
  } catch (error) {
    logger.error(`User ${userIndex} Socket.IO setup error`, error);
    throw error;
  }
}

// Room Creation Helper for specific language
async function createLanguageRoom(userIndex, languageConfig) {
  try {
    const user = testUsers[userIndex];
    const page = user.page;
    
    // Navigate to dashboard
    await page.goto(`${TEST_CONFIG.frontendUrl}/dashboard`);
    await sleep(1000);
    
    // Click create room button
    await page.click('button[data-testid="create-room"]');
    await sleep(1000);
    
    // Fill room creation form
    await page.type('input[name="name"]', languageConfig.name);
    await page.type('textarea[name="description"]', `Automated test room for ${languageConfig.language} collaboration`);
    await page.select('select[name="language"]', languageConfig.language);
    
    // Submit form
    await page.click('button[type="submit"]');
    await sleep(2000);
    
    // Get room ID from URL
    const currentUrl = page.url();
    const roomIdMatch = currentUrl.match(/\/room\/([^\/]+)/);
    
    if (roomIdMatch) {
      const roomId = roomIdMatch[1];
      logger.success(`${languageConfig.language} room created successfully by User ${userIndex}`, { roomId });
      
      // Take screenshot
      await takeScreenshot(page, `${languageConfig.language}-room-creation-user-${userIndex}`);
      
      return { success: true, roomId };
    } else {
      logger.error(`Failed to get room ID for User ${userIndex} - ${languageConfig.language}`);
      return { success: false, error: 'Room ID not found' };
    }
  } catch (error) {
    logger.error(`Room creation error for User ${userIndex} - ${languageConfig.language}`, error);
    return { success: false, error: error.message };
  }
}

// Room Joining Helper
async function joinRoom(userIndex, roomId, language) {
  try {
    const user = testUsers[userIndex];
    const page = user.page;
    
    // Navigate to room
    await page.goto(`${TEST_CONFIG.frontendUrl}/room/${roomId}`);
    await sleep(2000);
    
    // Check if successfully joined
    const connectedUsersElement = await page.$('[data-testid="connected-users"]');
    if (connectedUsersElement) {
      const userCount = await page.evaluate(el => el.textContent);
      logger.success(`User ${userIndex} joined ${language} room successfully`, { roomId, userCount });
      
      // Take screenshot
      await takeScreenshot(page, `${language}-room-joined-user-${userIndex}`);
      
      return { success: true, userCount };
    } else {
      logger.error(`User ${userIndex} failed to join ${language} room`, { roomId });
      return { success: false, error: 'Join failed' };
    }
  } catch (error) {
    logger.error(`Room joining error for User ${userIndex} - ${language}`, error);
    return { success: false, error: error.message };
  }
}

// Language-specific code synchronization test
async function testLanguageCodeSynchronization(roomId, languageConfig) {
  logger.info(`🧪 Starting ${languageConfig.language} Code Synchronization Test...`);
  
  try {
    const startTime = Date.now();
    
    // User1 types initial code
    const user1 = testUsers[0];
    const page1 = user1.page;
    
    await page1.goto(`${TEST_CONFIG.frontendUrl}/room/${roomId}`);
    await sleep(1000);
    
    // Clear editor and type language-specific code
    await page1.click('[data-testid="code-editor"]');
    await page1.keyboard.down('Control');
    await page1.keyboard.press('a');
    await page1.keyboard.up('Control');
    await page1.keyboard.press('Backspace');
    
    await page1.keyboard.type(languageConfig.initialCode);
    await sleep(1000);
    
    logger.success(`User1 typed initial ${languageConfig.language} code`);
    await takeScreenshot(page1, `${languageConfig.language}-code-sync-user1-initial`);
    
    // Wait for code sync
    await sleep(2000);
    
    // User2 joins and checks if code is synced
    const user2 = testUsers[1];
    const page2 = user2.page;
    
    await page2.goto(`${TEST_CONFIG.frontendUrl}/room/${roomId}`);
    await sleep(2000);
    
    // Check if code is synchronized
    const editorContent = await page2.evaluate(() => {
      const editor = document.querySelector('[data-testid="code-editor"]');
      return editor ? editor.textContent : '';
    });
    
    if (editorContent.includes(languageConfig.expectedOutput)) {
      logger.success(`${languageConfig.language} code synchronization working: User2 sees User1's code`);
      await takeScreenshot(page2, `${languageConfig.language}-code-sync-user2-received`);
    } else {
      logger.error(`${languageConfig.language} code synchronization failed: User2 does not see User1's code`);
      return false;
    }
    
    // User2 adds more code
    await page2.click('[data-testid="code-editor"]');
    await page2.keyboard.press('End');
    await page2.keyboard.press('Enter');
    await page2.keyboard.type(languageConfig.user2Addition);
    await sleep(1000);
    
    logger.success(`User2 added additional ${languageConfig.language} code`);
    await takeScreenshot(page2, `${languageConfig.language}-code-sync-user2-added`);
    
    // Wait for sync and check User1
    await sleep(2000);
    
    const user1UpdatedContent = await page1.evaluate(() => {
      const editor = document.querySelector('[data-testid="code-editor"]');
      return editor ? editor.textContent : '';
    });
    
    if (user1UpdatedContent.includes(languageConfig.user2Addition)) {
      logger.success(`${languageConfig.language} bidirectional code synchronization working`);
      await takeScreenshot(page1, `${languageConfig.language}-code-sync-user1-received-update`);
      
      const syncTime = Date.now() - startTime;
      logger.performance(`${languageConfig.language}_code_sync`, syncTime);
      
      return true;
    } else {
      logger.error(`${languageConfig.language} bidirectional code synchronization failed`);
      return false;
    }
    
  } catch (error) {
    logger.error(`${languageConfig.language} code synchronization test error`, error);
    return false;
  }
}

// Test all languages
async function testAllLanguages() {
  logger.info('🌐 Starting Multi-Language Test Suite...');
  
  const results = {};
  
  for (const [language, config] of Object.entries(LANGUAGE_TESTS)) {
    logger.info(`🧪 Testing ${language.toUpperCase()} language...`);
    
    try {
      // Create room for this language
      const roomCreation = await createLanguageRoom(0, config);
      if (!roomCreation.success) {
        logger.error(`${language} room creation failed`);
        results[language] = { success: false, error: 'Room creation failed' };
        continue;
      }
      
      const roomId = roomCreation.roomId;
      
      // All users join the room
      for (let i = 1; i < testUsers.length; i++) {
        const result = await joinRoom(i, roomId, language);
        if (!result.success) {
          logger.error(`User ${i + 1} failed to join ${language} room`);
          results[language] = { success: false, error: `User ${i + 1} join failed` };
          continue;
        }
        await sleep(1000);
      }
      
      // Test code synchronization
      const codeSyncTest = await testLanguageCodeSynchronization(roomId, config);
      
      results[language] = {
        success: codeSyncTest,
        roomId: roomId,
        codeSync: codeSyncTest
      };
      
      logger.success(`${language} language test completed`, results[language]);
      
      // Wait before testing next language
      await sleep(2000);
      
    } catch (error) {
      logger.error(`${language} language test error`, error);
      results[language] = { success: false, error: error.message };
    }
  }
  
  return results;
}

// Main Test Execution
async function runMultiLanguageTests() {
  logger.info('🚀 Starting Multi-Language Test Suite...');
  
  try {
    // Create screenshots directory
    if (!fs.existsSync(TEST_CONFIG.screenshotDir)) {
      fs.mkdirSync(TEST_CONFIG.screenshotDir, { recursive: true });
    }
    
    // Initialize browser
    const browser = await puppeteer.launch({
      headless: false, // Set to true for headless testing
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    logger.success('Browser launched successfully');
    
    // Test Scenario 1: User Registration
    logger.info('📝 Test Scenario 1: User Registration');
    for (let i = 0; i < TEST_CONFIG.testUsers; i++) {
      const result = await registerTestUser(browser, i + 1);
      if (!result.success) {
        logger.error(`User ${i + 1} registration failed, stopping tests`);
        return;
      }
      await sleep(1000);
    }
    
    // Test Scenario 2: Socket.IO Connections
    logger.info('🔌 Test Scenario 2: Socket.IO Connections');
    for (let i = 0; i < testUsers.length; i++) {
      try {
        await connectUserSocket(i + 1, testUsers[i].token);
        await sleep(500);
      } catch (error) {
        logger.error(`Socket connection failed for User ${i + 1}`, error);
        return;
      }
    }
    
    // Test Scenario 3: Multi-Language Testing
    logger.info('🌐 Test Scenario 3: Multi-Language Testing');
    const languageResults = await testAllLanguages();
    
    // Generate Test Report
    logger.info('📊 Generating Multi-Language Test Report...');
    
    testResults.languages = languageResults;
    testResults.summary = {
      totalUsers: testUsers.length,
      totalLanguages: Object.keys(LANGUAGE_TESTS).length,
      languageResults: languageResults,
      totalTests: Object.keys(languageResults).length,
      passedTests: Object.values(languageResults).filter(r => r.success).length
    };
    
    // Save detailed results
    const resultsPath = './multi-language-test-results-detailed.json';
    fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
    
    logger.success('Multi-Language Test Suite Completed', testResults.summary);
    logger.info(`Detailed results saved to: ${resultsPath}`);
    
    // Cleanup
    await browser.close();
    
  } catch (error) {
    logger.error('Multi-language test suite execution error', error);
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
});

// Run tests
if (require.main === module) {
  runMultiLanguageTests().then(() => {
    logger.info('Multi-language test suite finished');
    process.exit(0);
  }).catch((error) => {
    logger.error('Multi-language test suite failed', error);
    process.exit(1);
  });
}

module.exports = {
  runMultiLanguageTests,
  MultiLanguageLogger,
  testResults,
  LANGUAGE_TESTS
};
