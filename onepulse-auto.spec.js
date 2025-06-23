const { chromium } = require('playwright');
const axios = require('axios');

const MAIL_API = 'https://api.mail.tm';

// Create a new temporary email account
async function createTempEmail() {
    const domainsRes = await axios.get(`${MAIL_API}/domains`);
    const domain = domainsRes.data['hydra:member'][0].domain; // Get the first allowed domain
  
    const email = `test_${Date.now()}@${domain}`;
    const password = 'testpassword123';
  
    await axios.post(`${MAIL_API}/accounts`, {
      address: email,
      password
    });
  
    console.log('📧 Temp email created:', email);
    return { email, password };
  }
  

// Automate OnePulse sign-up with the temp email
async function submitOnePulseSignup(email) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://client.onepulse.com/signup');

  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', email);
  await page.click('button:has-text("Get started")');

  console.log('✅ Signup form submitted with temp email');
  await browser.close();
}

// Poll the inbox and extract the verification link
async function waitForVerificationLink(email, password) {
  const tokenRes = await axios.post(`${MAIL_API}/token`, { address: email, password });
  const token = tokenRes.data.token;

  console.log('⏳ Waiting for verification email...');
  let link = null;

  for (let i = 0; i < 30; i++) {
    const { data: messages } = await axios.get(`${MAIL_API}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const msg = messages['hydra:member'].find(m => m.from.address.includes('onepulse.com'));
    if (msg) {
      const { data: fullMsg } = await axios.get(`${MAIL_API}/messages/${msg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const match = fullMsg.text.match(/https:\/\/client\.onepulse\.com\/setup\?token=[a-zA-Z0-9]+/);
      if (match) {
        link = match[0];
        console.log('🔗 Verification link:', link);
        return link;
      }
    }
    await new Promise(res => setTimeout(res, 3000));
  }

  throw new Error('❌ Verification email not received in time.');
}

// Open verification link and complete onboarding
async function verifyAndOnboardOnePulse(verificationLink) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(verificationLink);
  console.log('🌐 Opened verification link');

  await page.waitForSelector('#full-name');
  await page.fill('#full-name', 'Marvin');
  await page.fill('#last-name', 'Reyes');
  await page.getByText('I have read and agree the Terms & Conditions').click();
  await page.getByRole('button', { name: 'Next step' }).click();

  await page.waitForTimeout(2000);
  await completeStep2(page);

  await browser.close();
}

// Step 2 automation
async function completeStep2(page) {
  await page.waitForSelector('text=Step 2 of 2');
  await page.fill('#company-name', 'OpenAI');
  await page.click('#department');
  await page.click('li[role="option"][data-value="MARKETING"]');
  await page.click('#departmentType');
  await page.click('li[role="option"][data-value="BRAND"]');
  await page.click('#job_seniority');
  await page.click('li[role="option"][data-value="ENTRY"]');
  await page.click('button:has-text("Create Account")');
  await page.waitForTimeout(2000);
  console.log('🎉 Account created and onboarding finished!');
}

// 🚀 All-in-One Runner
(async () => {
    try {
      console.log('🚀 Script started');
      const { email, password } = await createTempEmail();
      await submitOnePulseSignup(email);
      const link = await waitForVerificationLink(email, password);
      await verifyAndOnboardOnePulse(link);
    } catch (err) {
      console.error('❌ Script failed:', err.message);
    }
  })();