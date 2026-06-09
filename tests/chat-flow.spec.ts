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
