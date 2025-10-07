const { io } = require('socket.io-client');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Comprehensive Collaborative Coding Platform Test Suite...');

// Test Configuration
const TEST_CONFIG = {
  backendUrl: 'http://localhost:5001',
  frontendUrl: 'http://localhost:3000',
  testUsers: 6,
  testTimeout: 120000, // 2 minutes
  screenshotDir: './test-screenshots',
  logFile: './test-results.log'
};

// Test Results Storage
const testResults = {
  startTime: new Date(),
  scenarios: {},
  errors: [],
  performance: {},
  summary: {}
};

// Test Users Data
const testUsers = [];
const userSockets = [];
const browserInstances = [];

// Logger
class TestLogger {
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
      if (data instanceof Error) {
        console.log(logMessage, data.message, data.stack);
      } else {
        console.log(logMessage, JSON.stringify(data, null, 2));
      }
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

const logger = new TestLogger();

// Utility Functions
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(browser, name) {
  try {
    const screenshotPath = path.join(TEST_CONFIG.screenshotDir, `${name}.png`);
    await browser.screenshot({ path: screenshotPath, fullPage: true });
    logger.debug(`Screenshot saved: ${screenshotPath}`);
  } catch (error) {
    logger.error(`Failed to take screenshot: ${name}`, error);
  }
}

// User Registration Helper
async function registerTestUser(page, userIndex, testUsers) {
  try {
    const timestamp = Date.now();
    const userName = `TestUser${userIndex}`;
    const userEmail = `testuser${userIndex}_${timestamp}@test.com`;
    const password = 'TestPass123!';
    
    // Navigate to main page for each new user registration
    console.log(`Navigating to main page for User ${userIndex}...`);
    await page.goto(TEST_CONFIG.frontendUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    await sleep(2000);
    
    // Click the register button to open the modal
    console.log(`Clicking register button for User ${userIndex}...`);
    
    // Debug: List all buttons on the page
    const allButtons = await page.$$('button');
    console.log(`   🔍 Found ${allButtons.length} buttons on the page`);
    
    for (let i = 0; i < allButtons.length; i++) {
      try {
        const buttonText = await page.evaluate(el => el.textContent?.trim(), allButtons[i]);
        const buttonVisible = await page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && 
                 window.getComputedStyle(el).visibility !== 'hidden' &&
                 window.getComputedStyle(el).display !== 'none';
        }, allButtons[i]);
        
        console.log(`   Button ${i + 1}: "${buttonText}" (visible: ${buttonVisible})`);
      } catch (error) {
        console.log(`   Button ${i + 1}: Error reading button - ${error.message}`);
      }
    }
    
    // Try different approaches to find the register button
    let registerButton = null;
    
    // Method 1: Look for button with text content
    for (const button of allButtons) {
      const buttonText = await page.evaluate(el => el.textContent?.trim(), button);
      if (buttonText && (buttonText.toLowerCase().includes('get started') || buttonText.toLowerCase().includes('register'))) {
        registerButton = button;
        break;
      }
    }
    
    if (!registerButton) {
      throw new Error('Register button (Get Started) not found');
    }
    
    await registerButton.click();
    await sleep(2000); // Wait longer for modal to appear
    
    // Wait for the modal to appear and fill the form
    console.log(`Filling registration form for User ${userIndex}...`);
    
    // Wait for modal to be visible
    await page.waitForSelector('form', { timeout: 15000 });
    await sleep(1000);
    
    // Fill name field
    await page.waitForSelector('#name', { timeout: 15000 });
    await page.type('#name', userName);
    
    // Fill email field
    await page.waitForSelector('#email', { timeout: 15000 });
    await page.type('#email', userEmail);
    
    // Fill password field
    await page.waitForSelector('#password', { timeout: 15000 });
    await page.type('#password', password);
    
    // Fill confirm password field
    await page.waitForSelector('#confirmPassword', { timeout: 15000 });
    await page.type('#confirmPassword', password);
    
    // Check terms checkbox
    await page.waitForSelector('#terms', { timeout: 15000 });
    await page.click('#terms');
    
    // Submit form
    console.log(`Submitting registration form for User ${userIndex}...`);
    
    // Debug: Check form values before submission
    const nameValue = await page.$eval('#name', el => el.value);
    const emailValue = await page.$eval('#email', el => el.value);
    const passwordValue = await page.$eval('#password', el => el.value);
    const confirmPasswordValue = await page.$eval('#confirmPassword', el => el.value);
    const termsChecked = await page.$eval('#terms', el => el.checked);
    
    console.log(`   🔍 Form values before submission:`);
    console.log(`      Name: ${nameValue}`);
    console.log(`      Email: ${emailValue}`);
    console.log(`      Password: ${passwordValue ? '***' : 'empty'}`);
    console.log(`      Confirm Password: ${confirmPasswordValue ? '***' : 'empty'}`);
    console.log(`      Terms checked: ${termsChecked}`);
    
    // Listen for console messages
    page.on('console', msg => {
      console.log(`   📱 Console [${msg.type()}]: ${msg.text()}`);
    });
    
    // Listen for page errors
    page.on('pageerror', error => {
      console.log(`   ❌ Page Error: ${error.message}`);
    });
    
    // Listen for request failures
    page.on('requestfailed', request => {
      console.log(`   ❌ Request Failed: ${request.url()} - ${request.failure().errorText}`);
    });
    
    await page.click('button[type="submit"]');
    console.log(`   ✅ Submit button clicked`);
    
    await sleep(5000); // Wait longer for registration to complete
    
    // Take a screenshot after submission to see what happened
    await page.screenshot({ 
      path: `test-screenshots/after-submission-user-${userIndex}.png`,
      fullPage: true 
    });
    console.log(`   📸 Screenshot saved after submission for User ${userIndex}`);
    
    // Check if registration was successful by looking for redirect to dashboard
    const currentUrl = page.url();
    console.log(`   🔍 Current URL after submission: ${currentUrl}`);
    
    // Check for any error messages on the page
    const errorElements = await page.$$('[data-testid="error-message"], .text-red-600, .text-red-400, .error, .alert-error');
    if (errorElements.length > 0) {
      for (const errorEl of errorElements) {
        const errorText = await page.evaluate(el => el.textContent, errorEl);
        console.log(`   ❌ Error found: ${errorText}`);
      }
    }
    
    // Check for success messages
    const successElements = await page.$$('[data-testid="success-message"], .text-green-600, .text-green-400, .success, .alert-success');
    if (successElements.length > 0) {
      for (const successEl of successElements) {
        const successText = await page.evaluate(el => el.textContent, successEl);
        console.log(`   ✅ Success message: ${successText}`);
      }
    }
    
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
      // Check if there's an error message
      const errorElement = await page.$('[data-testid="error-message"], .text-red-600, .text-red-400');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        logger.error(`User ${userIndex} registration failed: ${errorText}`);
      } else {
        logger.error(`User ${userIndex} registration failed: ${userEmail} - URL: ${currentUrl}`);
      }
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

// Room Creation Helper
async function createJavaRoom(userIndex) {
  try {
    const user = testUsers[userIndex];
    const page = user.page;
    
    // Navigate to dashboard
    await page.goto(`${TEST_CONFIG.frontendUrl}/dashboard`, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(2000);
    
    // Click create room button to show the form
    console.log(`Opening create room form for User ${userIndex}...`);
    
    // Try different approaches to find the new room button
    let newRoomButton = null;
    
    // Method 1: Look for button with text content
    const allButtons = await page.$$('button');
    for (const button of allButtons) {
      const buttonText = await page.evaluate(el => el.textContent?.trim(), button);
      if (buttonText && (buttonText.toLowerCase().includes('new room') || buttonText.toLowerCase().includes('new'))) {
        newRoomButton = button;
        break;
      }
    }
    
    if (!newRoomButton) {
      throw new Error('New Room button not found');
    }
    
    await newRoomButton.click();
    await sleep(1000);
    
    // Wait for form to appear and fill it
    console.log(`Filling room creation form for User ${userIndex}...`);
    
    // Fill room name
    await page.waitForSelector('#room-name', { timeout: 10000 });
    await page.type('#room-name', 'Java Test Room');
    
    // Fill description
    await page.waitForSelector('#room-description', { timeout: 10000 });
    await page.type('#room-description', 'Automated test room for Java collaboration');
    
    // Select Java language
    await page.waitForSelector('#room-language', { timeout: 10000 });
    await page.select('#room-language', 'java');
    
    // Set max users (optional, keep default)
    
    // Submit form
    console.log(`Submitting room creation form for User ${userIndex}...`);
    await page.click('button[type="submit"]');
    await sleep(3000);
    
    // Check if room was created successfully
    // Look for success message or room code display
    const successElement = await page.$('[data-testid="room-created"], .text-green-600, .text-green-400');
    if (successElement) {
      const successText = await page.evaluate(el => el.textContent, successElement);
      console.log(`Room creation success message: ${successText}`);
    }
    
    // Get room ID from the created room code display
    const roomCodeElement = await page.$('input[readonly]');
    if (roomCodeElement) {
      const roomId = await page.evaluate(el => el.value, roomCodeElement);
      logger.success(`Java room created successfully by User ${userIndex}`, { roomId });
      
      // Take screenshot
      await takeScreenshot(page, `room-creation-user-${userIndex}`);
      
      return { success: true, roomId };
    } else {
      // Alternative: check if we're redirected to a room
      const currentUrl = page.url();
      const roomIdMatch = currentUrl.match(/\/room\/([^\/]+)/);
      
      if (roomIdMatch) {
        const roomId = roomIdMatch[1];
        logger.success(`Java room created successfully by User ${userIndex}`, { roomId });
        
        // Take screenshot
        await takeScreenshot(page, `room-creation-user-${userIndex}`);
        
        return { success: true, roomId };
      } else {
        logger.error(`Failed to get room ID for User ${userIndex}`);
        return { success: false, error: 'Room ID not found' };
      }
    }
  } catch (error) {
    logger.error(`Room creation error for User ${userIndex}`, error);
    return { success: false, error: error.message };
  }
}

// Room Joining Helper
async function joinRoom(userIndex, roomId) {
  try {
    const user = testUsers[userIndex];
    const page = user.page;
    
    // Navigate to room
    await page.goto(`${TEST_CONFIG.frontendUrl}/room/${roomId}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(2000);
    
    // Check if successfully joined
    const connectedUsersElement = await page.$('[data-testid="connected-users"]');
    if (connectedUsersElement) {
      const userCount = await page.evaluate(el => el.textContent);
      logger.success(`User ${userIndex} joined room successfully`, { roomId, userCount });
      
      // Take screenshot
      await takeScreenshot(page, `room-joined-user-${userIndex}`);
      
      return { success: true, userCount };
    } else {
      logger.error(`User ${userIndex} failed to join room`, { roomId });
      return { success: false, error: 'Join failed' };
    }
  } catch (error) {
    logger.error(`Room joining error for User ${userIndex}`, error);
    return { success: false, error: error.message };
  }
}

// Code Synchronization Test
async function testCodeSynchronization(roomId) {
  logger.info('🧪 Starting Code Synchronization Test...');
  
  try {
    // User1 types initial code
    const user1 = testUsers[0];
    const page1 = user1.page;
    
    await page1.goto(`${TEST_CONFIG.frontendUrl}/room/${roomId}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(1000);
    
    // Clear editor and type Java code
    await page1.click('[data-testid="code-editor"]');
    await page1.keyboard.down('Control');
    await page1.keyboard.press('a');
    await page1.keyboard.up('Control');
    await page1.keyboard.press('Backspace');
    
    const javaCode = `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello from User1");
    }
}`;
    
    await page1.keyboard.type(javaCode);
    await sleep(1000);
    
    logger.success('User1 typed initial Java code');
    await takeScreenshot(page1, 'code-sync-user1-initial');
    
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
    
    if (editorContent.includes('Hello from User1')) {
      logger.success('Code synchronization working: User2 sees User1\'s code');
      await takeScreenshot(page2, 'code-sync-user2-received');
    } else {
      logger.error('Code synchronization failed: User2 does not see User1\'s code');
      return false;
    }
    
    // User2 adds more code
    await page2.click('[data-testid="code-editor"]');
    await page2.keyboard.press('End');
    await page2.keyboard.press('Enter');
    await page2.keyboard.type('        System.out.println("Hello from User2");');
    await sleep(1000);
    
    logger.success('User2 added additional code');
    await takeScreenshot(page2, 'code-sync-user2-added');
    
    // Wait for sync and check User1
    await sleep(2000);
    
    const user1UpdatedContent = await page1.evaluate(() => {
      const editor = document.querySelector('[data-testid="code-editor"]');
      return editor ? editor.textContent : '';
    });
    
    if (user1UpdatedContent.includes('Hello from User2')) {
      logger.success('Bidirectional code synchronization working');
      await takeScreenshot(page1, 'code-sync-user1-received-update');
      return true;
    } else {
      logger.error('Bidirectional code synchronization failed');
      return false;
    }
    
  } catch (error) {
    logger.error('Code synchronization test error', error);
    return false;
  }
}

// Connected Users Count Test
async function testConnectedUsersCount(roomId) {
  logger.info('🧪 Starting Connected Users Count Test...');
  
  try {
    const results = [];
    
    // Test with each user joining
    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const page = user.page;
      
      await page.goto(`${TEST_CONFIG.frontendUrl}/room/${roomId}`, { waitUntil: 'networkidle0', timeout: 30000 });
      await sleep(2000);
      
      // Get connected users count from navbar
      // Look for the text that shows "X users" in the navbar
      let userCountElement = null;
      
      // Method 1: Look for text content containing "users"
      const allElements = await page.$$('*');
      for (const element of allElements) {
        try {
          const textContent = await page.evaluate(el => el.textContent?.trim(), element);
          if (textContent && textContent.match(/\d+\s*users/)) {
            userCountElement = element;
            break;
          }
        } catch (error) {
          // Skip elements that can't be evaluated
          continue;
        }
      }
      
      if (userCountElement) {
        const userCount = await page.evaluate(el => el.textContent, userCountElement);
        const expectedCount = i + 1;
        
        // Extract the number from the text (e.g., "5 users" -> 5)
        const countMatch = userCount.match(/(\d+)\s*users/);
        const actualCount = countMatch ? parseInt(countMatch[1]) : 0;
        
        if (actualCount === expectedCount) {
          logger.success(`User ${i + 1} joined - Connected Users: ${expectedCount}`);
          results.push({ user: i + 1, expected: expectedCount, actual: actualCount, status: 'PASS' });
        } else {
          logger.error(`User count mismatch for User ${i + 1}`, { expected: expectedCount, actual: actualCount });
          results.push({ user: i + 1, expected: expectedCount, actual: actualCount, status: 'FAIL' });
        }
        
        await takeScreenshot(page, `user-count-${i + 1}-users`);
      } else {
        // Alternative: look for the button that shows user count
        let userCountButton = null;
        const allButtons = await page.$$('button');
        for (const button of allButtons) {
          try {
            const buttonText = await page.evaluate(el => el.textContent?.trim(), button);
            if (buttonText && buttonText.match(/\d+\s*users/)) {
              userCountButton = button;
              break;
            }
          } catch (error) {
            continue;
          }
        }
        
        if (userCountButton) {
          const buttonText = await page.evaluate(el => el.textContent, userCountButton);
          const countMatch = buttonText.match(/(\d+)\s*users/);
          const actualCount = countMatch ? parseInt(countMatch[1]) : 0;
          const expectedCount = i + 1;
          
          if (actualCount === expectedCount) {
            logger.success(`User ${i + 1} joined - Connected Users: ${expectedCount}`);
            results.push({ user: i + 1, expected: expectedCount, actual: actualCount, status: 'PASS' });
          } else {
            logger.error(`User count mismatch for User ${i + 1}`, { expected: expectedCount, actual: actualCount });
            results.push({ user: i + 1, expected: expectedCount, actual: actualCount, status: 'FAIL' });
          }
          
          await takeScreenshot(page, `user-count-${i + 1}-users`);
        } else {
          logger.error(`Connected users element not found for User ${i + 1}`);
          results.push({ user: i + 1, expected: i + 1, actual: 'NOT_FOUND', status: 'FAIL' });
        }
      }
    }
    
    // Check if all users see the same count
    const allPassed = results.every(r => r.status === 'PASS');
    if (allPassed) {
      logger.success('Connected users count test passed for all users');
    } else {
      logger.error('Connected users count test failed for some users', results);
    }
    
    return allPassed;
    
  } catch (error) {
    logger.error('Connected users count test error', error);
    return false;
  }
}

// Main Test Execution
async function runComprehensiveTests() {
  logger.info('🚀 Starting Comprehensive Test Suite...');
  
  try {
    // Create screenshots directory
    if (!fs.existsSync(TEST_CONFIG.screenshotDir)) {
      fs.mkdirSync(TEST_CONFIG.screenshotDir, { recursive: true });
    }
    
    // Initialize browser
    console.log('🌐 Launching browser...');
    const browser = await puppeteer.launch({
      headless: "new", // Use new headless mode
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      ignoreDefaultArgs: ['--disable-extensions'],
      timeout: 60000
    });
    
    logger.success('Browser launched successfully');
    
    // Test Scenario 1: User Registration
    logger.info('📝 Test Scenario 1: User Registration');
    
    for (let i = 0; i < TEST_CONFIG.testUsers; i++) {
      try {
        console.log(`\n🔄 Registering User ${i + 1}...`);
        
        // Create a fresh incognito context for each user to avoid authentication state sharing
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        
        const result = await registerTestUser(page, i + 1, testUsers);
        if (!result.success) {
          logger.error(`User ${i + 1} registration failed, stopping tests`);
          console.log(`❌ Registration failed for User ${i + 1}:`, result.error);
          await context.close();
          return;
        }
        console.log(`✅ User ${i + 1} registered successfully`);
        
        // Store the page and context with the user data
        const userData = testUsers[testUsers.length - 1];
        userData.page = page;
        userData.context = context;
        
        await sleep(2000); // Wait between registrations
      } catch (error) {
        logger.error(`User ${i + 1} registration error`, error);
        console.log(`❌ Registration error for User ${i + 1}:`, error.message);
        return;
      }
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
    
    // Test Scenario 3: Room Creation
    logger.info('🏠 Test Scenario 3: Room Creation');
    const roomCreation = await createJavaRoom(0);
    if (!roomCreation.success) {
      logger.error('Room creation failed, stopping tests');
      return;
    }
    
    const roomId = roomCreation.roomId;
    
    // Test Scenario 4: Room Joining
    logger.info('🚪 Test Scenario 4: Room Joining');
    for (let i = 1; i < testUsers.length; i++) {
      const result = await joinRoom(i, roomId);
      if (!result.success) {
        logger.error(`User ${i + 1} failed to join room`);
        return;
      }
      await sleep(1000);
    }
    
    // Test Scenario 5: Connected Users Count
    logger.info('👥 Test Scenario 5: Connected Users Count');
    const userCountTest = await testConnectedUsersCount(roomId);
    
    // Test Scenario 6: Code Synchronization
    logger.info('💻 Test Scenario 6: Code Synchronization');
    const codeSyncTest = await testCodeSynchronization(roomId);
    
    // Generate Test Report
    logger.info('📊 Generating Test Report...');
    
    testResults.summary = {
      totalUsers: testUsers.length,
      roomCreation: roomCreation.success,
      userCountTest: userCountTest,
      codeSyncTest: codeSyncTest,
      totalTests: 6,
      passedTests: [roomCreation.success, userCountTest, codeSyncTest].filter(Boolean).length
    };
    
    // Save detailed results
    const resultsPath = './test-results-detailed.json';
    fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
    
    logger.success('Test Suite Completed', testResults.summary);
    logger.info(`Detailed results saved to: ${resultsPath}`);
    
    // Cleanup
    await browser.close();
    
  } catch (error) {
    logger.error('Test suite execution error', error);
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
  runComprehensiveTests().then(() => {
    logger.info('Test suite finished');
    process.exit(0);
  }).catch((error) => {
    logger.error('Test suite failed', error);
    process.exit(1);
  });
}

module.exports = {
  runComprehensiveTests,
  TestLogger,
  testResults
}; 
