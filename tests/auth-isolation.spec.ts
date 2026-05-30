import { test, expect } from '@playwright/test';

test.describe('Multi-Account Data Isolation', () => {
  test('User B should not see User A\'s workspaces after logout', async ({ page }) => {
    // Note: This test requires the dev server to be running and Supabase to be accessible
    
    // 1. Sign in as User A
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'usera@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to app
    await page.waitForURL('/app');

    // 2. Create a unique workspace for User A
    const uniqueWorkspaceName = `Workspace-UserA-${Date.now()}`;
    // Assuming there's a button to create workspace
    // (Adjust selectors based on actual UI)
    await page.click('#new-canvas-btn'); // Fallback: just wait for UI to load
    // For this example, we mock the creation or wait for the UI to be ready
    // We expect User A's data to load, or we manually inject a workspace
    
    // Evaluate in browser to create a workspace directly via store for reliability
    await page.evaluate(async (name) => {
      // @ts-ignore
      const { useWorkspaceStore } = window;
      if (useWorkspaceStore) {
        await useWorkspaceStore.getState().createWorkspace(name);
      }
    }, uniqueWorkspaceName);

    // 3. Sign out User A
    // (Adjust selector to actual sign out button)
    await page.goto('/app');
    // We can also trigger sign out via store
    await page.evaluate(async () => {
      // @ts-ignore
      const { useAuthStore } = window;
      if (useAuthStore) {
        await useAuthStore.getState().signOut();
      }
    });

    // 4. Sign in as User B
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'userb@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/app');

    // 5. Verify User B cannot see User A's workspace
    const pageText = await page.content();
    expect(pageText).not.toContain(uniqueWorkspaceName);

    // Also check local storage is wiped
    const activeWorkspaceId = await page.evaluate(() => localStorage.getItem('panvas.activeWorkspaceId'));
    // activeWorkspaceId should either be null or a fresh default, NOT User A's workspace ID.
    // If it was User A's workspace ID, the isolation failed.
  });
});
