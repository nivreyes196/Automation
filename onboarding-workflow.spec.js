const { chromium } = require('playwright');
const readline = require('readline');
const fs = require('fs');

(async () => {
  const randomID = `marvin${Date.now()}`;
  const email = `${randomID}@yopmail.com`;
  const logFile = `logs/${randomID}.log`;
  const log = msg => {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
  };

  try {
    if (!fs.existsSync('logs')) fs.mkdirSync('logs');

    log(`📧 Using email: ${email}`);
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    log('🌐 Opening OnePulse signup...');
    await page.goto('https://v3-ui.onepulse.com/welcome', { timeout: 30000 });
    await page.getByText('Send surveys and get insights').click();
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', email);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForTimeout(3000);
    log('📨 Submitted email to OnePulse');

    // 🛑 Pause for CAPTCHA
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise(resolve => {
      rl.question('🛑 Solve CAPTCHA in browser, then press ENTER to continue...', () => {
        rl.close();
        resolve();
      });
    });

    // 📬 Check Yopmail
    const yop = await context.newPage();
    await yop.goto('https://yopmail.com/en/', { timeout: 30000 });
    await yop.fill('#login', randomID);
    await yop.keyboard.press('Enter');
    log('📬 Checking inbox...');

    let verificationLink = null;
    const maxAttempts = 15;
    const delay = 5000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      log(`🔄 Attempt ${attempt} to find email...`);
      try {
        const inboxFrame = await yop.frame({ name: 'ifinbox' });
        await inboxFrame.reload();

        const emailItems = await inboxFrame.$$eval('div.m', divs =>
          divs.map(div => div.textContent)
        );

        const emailFound = emailItems.find(item => item.toLowerCase().includes('onepulse'));
        if (emailFound) {
          log('📥 Email received! Opening...');
          await inboxFrame.click('div.m');
          break;
        }
      } catch (e) {
        log(`⚠️ Inbox frame not ready (attempt ${attempt}): ${e.message}`);
      }
      await new Promise(res => setTimeout(res, delay));
    }

    // Try to extract verification link
    const msgFrame = await yop.frame({ name: 'ifmail' });
    try {
      await msgFrame.waitForSelector('a[href*="onepulse.com/setup"]', { timeout: 15000 });
      verificationLink = await msgFrame.$eval('a[href*="onepulse.com/setup"]', a => a.href);
      log(`🔗 Found verification link: ${verificationLink}`);
    } catch {
      throw new Error('❌ Failed to find verification link in the email.');
    }

    // 🧭 Onboarding process
    const onboard = await context.newPage();
    await onboard.goto(verificationLink, { timeout: 30000 });
    log('✅ Opened onboarding link');

    await onboard.waitForSelector('#full-name', { timeout: 15000 });
    await onboard.fill('#full-name', 'Marvin');
    await onboard.fill('#last-name', 'Reyes');

    // log('🎯 Phone number skip...');
    // await onboard.locator('#mui-2').toBeVisible()

    log('🎯 Selecting reason...');
    await onboard.click('#reason_for_registering');
    await onboard.click('li[role="option"][data-value="RESEARCH"]');

    log('🎯 Selecting usage...');
    await onboard.click('#client_platform_usage');
    await onboard.click('li[role="option"][data-value="mi"]');

    // log('🎯 Selecting reason...');
    // await page.selectOption('select#reason_for_registering', { value: 'LOOKING' });

    // log('🎯 Selecting usage...');
    // await page.selectOption('select#client_platform_usage', { value: 'mi' });

    await onboard.getByText('I have read and agree the Terms & Conditions').click();
    await onboard.getByRole('button', { name: 'Next step' }).click();
    await onboard.waitForTimeout(2000);
    await onboard.screenshot({ path: 'step1-finished.png' });
    log('📸 Step 1 complete');

    await completeStep2(onboard, log);

    await browser.close();
    log('🎉 Done! Fully created OnePulse account.');

  } catch (err) {
    console.error('❌ Script failed:', err.message);
    fs.appendFileSync(logFile, `❌ ERROR: ${err.message}\n`);
  }
})();

// ✅ Onboarding Step 2 with logging
async function completeStep2(page, log) {
  log('✅ Starting Step 2...');
  await page.waitForSelector('text=Step 2 of 2', { timeout: 15000 });

  await page.fill('#company-name', 'MARVIN ONEPULSE');

  log('🎯 Selecting department...');
  await page.click('#department');
  await page.click('li[role="option"][data-value="MARKETING"]');

  log('🎯 Selecting brand/agency...');
  await page.click('#departmentType');
  await page.click('li[role="option"][data-value="BRAND"]');

  log('🎯 Selecting seniority...');
  await page.click('#job_seniority');
  await page.click('li[role="option"][data-value="ENTRY"]');

  log('🚀 Clicking "Create Account"...');
  await page.click('button:has-text("Create Account")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'step2-complete.png' });
  log('📸 Screenshot saved: step2-complete.png');
  log('✅ Step 2 complete! Account created 🎉');
}
