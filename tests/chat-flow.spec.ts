import { test, expect } from '@playwright/test';

test('Kapruka AI Shopping Flow', async ({ page }) => {
  // 1. Initial Load
  await page.goto('http://localhost:3000');
  
  // Ensure the page loaded successfully by checking the header
  await expect(page.getByText('KaprukaAI')).toBeVisible();
  
  // 2. First Interaction
  const inputField = page.getByPlaceholder('What are you looking for?');
  await inputField.fill('I want a gift');
  await inputField.press('Enter');
  
  // 3. Requirement Check
  // Wait for AI to reply and ask for specific details like budget, occasion, recipient
  await expect(page.getByText(/budget|occasion|recipient|who|LKR/i).first()).toBeVisible({ timeout: 15000 });
  
  // 4. Trigger Search
  await inputField.fill("It's for my mom for mother's day, budget is 10k LKR");
  await inputField.press('Enter');
  
  // 5. State Verification (Critical)
  // The input should be instantly disabled while processing/streaming
  await expect(inputField).toBeDisabled();
  
  // Assert the pulseSearch animation mounts
  await expect(page.getByText('Scanning catalog for the perfect items...')).toBeVisible({ timeout: 20000 });
  
  // 6. Carousel Verification
  // Wait for the tool result to render the carousel.
  // Since the actual catalog items might vary, we just assert that AT LEAST ONE "View Details" button mounts.
  const viewDetailsButton = page.getByRole('link', { name: /View Details/i }).first();
  await expect(viewDetailsButton).toBeVisible({ timeout: 25000 });
  
  await page.waitForTimeout(5000);
});

test('Full AI Checkout Flow - Discovery to Payment Button', async ({ page }) => {
  // 1. Initial Load
  await page.goto('http://localhost:3000');
  await expect(page.getByText('KaprukaAI')).toBeVisible();

  const inputField = page.getByPlaceholder('What are you looking for?');

  // 2. Phase 1: Initial Discovery
  await inputField.fill('I need a last-minute anniversary gift for my wife. Budget is 15k LKR.');
  await inputField.press('Enter');
  
  // Wait for the AI's initial conversational response or search trigger
  await page.waitForTimeout(5000);

  // 3. Phase 2: Product Search & Animation Assertions
  await inputField.fill("Let's go with some fresh red roses.");
  await inputField.press('Enter');

  // Assert AI responds with product cards. Wait for the Liquid Glass product cards to fully render in the DOM.
  await expect(page.getByRole('link', { name: /View Details/i }).first()).toBeVisible({ timeout: 30000 });

  // 4. Phase 3: Delivery Check & Proactive Memory
  await inputField.fill("I love the Red Roses bouquet. Can we deliver this to Kandy tomorrow?");
  await inputField.press('Enter');

  // Assert that the AI's response includes a delivery confirmation AND asks for final recipient/sender details.
  await expect(page.getByText(/recipient|name|phone/i).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Kandy/i).first()).toBeVisible({ timeout: 30000 });

  // 5. Phase 4: Order Creation & Checkout Button Validation
  await inputField.fill("Her name is Sarah, 0771122334. I'm Blake, 0719988776. Message: Happy Anniversary!");
  await inputField.press('Enter');

  // Assert that the glowing copper checkout button renders in the chat DOM.
  const checkoutButton = page.getByRole('link', { name: /Complete Order on Kapruka/i }).first();
  await expect(checkoutButton).toBeVisible({ timeout: 45000 });

  // Extract the href attribute from the checkout button and assert that it contains the Kapruka gateway domain
  const href = await checkoutButton.getAttribute('href');
  expect(href).toMatch(/kapruka\.com/i);
  
  await page.waitForTimeout(5000);
});
