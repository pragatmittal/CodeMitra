const puppeteer = require('puppeteer');

// Utility function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function simpleTest() {
  console.log('🧪 Starting Simple Test Runner...');
  
  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    let browser;
    
    try {
      // Use system Chrome installation
      browser = await puppeteer.launch({
        headless: "new", // Use new headless mode
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        timeout: 30000
      });
      console.log('   ✅ Browser launched with system Chrome');
    } catch (error) {
      console.log('   ❌ Failed to launch with system Chrome:', error.message);
      throw error;
    }
    
    const page = await browser.newPage();
    
    // Test 1: Navigate to main page
    console.log('\n✅ Test 1: Navigate to main page');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait a bit for the page to fully load
    await delay(2000);
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'test-screenshots/simple-test.png',
      fullPage: true 
    });
    
    console.log('   ✅ Screenshot saved to test-screenshots/simple-test.png');
    
    // Get page title
    const title = await page.title();
    console.log(`   📄 Page title: ${title}`);
    
    // Test 2: Find and click Get Started button
    console.log('✅ Test 2: Find and click Get Started button');
    
    try {
      // Wait for any button to appear and find the Get Started button
      await page.waitForSelector('button', { timeout: 10000, visible: true });
      
      // Find the Get Started button by text content
      const buttons = await page.$$('button');
      let getStartedButton = null;
      
      for (const button of buttons) {
        const buttonText = await page.evaluate(el => el.textContent?.trim(), button);
        if (buttonText && buttonText.toLowerCase().includes('get started')) {
          getStartedButton = button;
          break;
        }
      }
      
      if (getStartedButton) {
        await getStartedButton.click();
        console.log('   ✅ Get Started button clicked');
        
        // Wait for the registration form to appear
        await delay(2000);
        
        // Take another screenshot
        await page.screenshot({ 
          path: 'test-screenshots/after-get-started.png',
          fullPage: true 
        });
        
        console.log('   ✅ Screenshot saved after clicking Get Started');
      } else {
        console.log('   ❌ Get Started button not found');
        return false;
      }
      
      return true;
    } catch (error) {
      console.log(`   ❌ Get Started button test failed: ${error.message}`);
      return false;
    }
    
    // Test 3: Check if modal appeared
    console.log('\n✅ Test 3: Check if modal appeared');
    const form = await page.$('form');
    if (form) {
      console.log('   ✅ Modal form is visible');
      
      // Test 4: Fill registration form
      console.log('\n✅ Test 4: Fill registration form');
      
      // Fill name
      const nameInput = await page.$('#name');
      if (nameInput) {
        await nameInput.type('TestUser1');
        console.log('   ✅ Filled name field');
      } else {
        console.log('   ❌ Name input not found');
      }
      
      // Fill email
      const emailInput = await page.$('#email');
      if (emailInput) {
        await emailInput.type('testuser1@test.com');
        console.log('   ✅ Filled email field');
      } else {
        console.log('   ❌ Email input not found');
      }
      
      // Fill password
      const passwordInput = await page.$('#password');
      if (passwordInput) {
        await passwordInput.type('TestPass123!');
        console.log('   ✅ Filled password field');
      } else {
        console.log('   ❌ Password input not found');
      }
      
      // Fill confirm password
      const confirmPasswordInput = await page.$('#confirmPassword');
      if (confirmPasswordInput) {
        await confirmPasswordInput.type('TestPass123!');
        console.log('   ✅ Filled confirm password field');
      } else {
        console.log('   ❌ Confirm password input not found');
      }
      
      // Check terms
      const termsCheckbox = await page.$('#terms');
      if (termsCheckbox) {
        await termsCheckbox.click();
        console.log('   ✅ Checked terms checkbox');
      } else {
        console.log('   ❌ Terms checkbox not found');
      }
      
      // Take screenshot
      await page.screenshot({ path: './simple-test-form-filled.png' });
      console.log('   📸 Screenshot saved: simple-test-form-filled.png');
      
      // Test 5: Submit form
      console.log('\n✅ Test 5: Submit form');
      const submitButton = await page.$('button[type="submit"]');
      if (submitButton) {
        console.log('   Submitting form...');
        await submitButton.click();
        await delay(5000);
        
        // Check result
        const currentUrl = page.url();
        console.log(`   Current URL: ${currentUrl}`);
        
        if (currentUrl.includes('/dashboard')) {
          console.log('   ✅ Registration successful! Redirected to dashboard');
        } else {
          console.log('   ⚠️ Registration may have failed or still processing');
        }
      } else {
        console.log('   ❌ Submit button not found');
      }
      
    } else {
      console.log('   ❌ Modal form not visible');
    }
    
    // Take final screenshot
    await page.screenshot({ path: './simple-test-final.png' });
    console.log('\n📸 Final screenshot saved: simple-test-final.png');
    
    await browser.close();
    console.log('\n🎉 Simple test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Simple test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

simpleTest();
