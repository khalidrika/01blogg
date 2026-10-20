import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { deflateSync } from 'node:zlib';

const api = 'http://localhost:8081/api';
const password = 'LearningJourney123!';
const unique = () => `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
// A real, lossless 2x2 PNG fixture, generated without external image tools.
function png(): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length); body.copy(result, 4); result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(2); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 20, 70, 220, 20, 70, 220, 0, 20, 70, 220, 20, 70, 220]))), chunk('IEND', Buffer.alloc(0))]);
}
async function register(request: APIRequestContext, prefix: string) {
  const username = prefix + unique(); const email = `${username}@verify.example`;
  const response = await request.post(`${api}/register`, { data: { username, email, password } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const user = await response.json();
  const login = await request.post(`${api}/login`, { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  return { ...user, email, username, token: session.token, headers: { Authorization: `Bearer ${session.token}` } };
}
async function login(page: Page, email: string, secret = password) {
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/feed$/);
}
function monitor(page: Page, errors: string[]) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
}

test('two users publish, follow, interact, report and an admin moderates', async ({ browser, request }, info) => {
  const alice = await register(request, 'alice'); const bob = await register(request, 'bob');
  const aliceContext = await browser.newContext(); const bobContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const a = await aliceContext.newPage(); const b = await bobContext.newPage(); const admin = await adminContext.newPage();
  const errors: string[] = []; [a, b, admin].forEach(page => monitor(page, errors));
  try {
    await login(a, alice.email); await login(b, bob.email);
    await expect(a.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);
    await b.goto(`/profile/${alice.id}`);
    await b.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(b.getByRole('button', { name: 'Unfollow', exact: true })).toBeEnabled();

    await a.goto('/create-post'); await a.getByLabel('Title', { exact: true }).fill('Learning Spring transactions');
    await a.getByLabel('Content', { exact: true }).fill('Today I learned how rollback protects related writes.');
    const bytes = png();
    await a.getByLabel('Image or video (optional)').setInputFiles({ name: 'lesson.png', mimeType: 'image/png', buffer: bytes });
    await expect(a.getByAltText('Post image preview')).toBeVisible();
    await a.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(a.getByText('Post published successfully.')).toBeVisible();
    const post = a.locator('article').filter({ hasText: 'Learning Spring transactions' });
    const id = await post.getAttribute('data-post-id');
    const imageUrl = await post.locator('img').getAttribute('src');
    const media = await request.get(imageUrl!); expect(media.ok()).toBeTruthy(); expect(await media.body()).toEqual(bytes);
    expect(media.headers()['x-content-type-options']).toBe('nosniff');

    await b.goto('/feed'); const feedPost = b.locator('article').filter({ hasText: 'Learning Spring transactions' });
    await feedPost.getByRole('button', { name: 'Like', exact: true }).click();
    await expect(feedPost.getByText('1 likes', { exact: true })).toBeVisible();
    await feedPost.getByLabel('Write a comment').fill('Thanks for sharing this lesson!');
    await feedPost.getByRole('button', { name: 'Add comment', exact: true }).click();
    await expect(feedPost.getByText('Thanks for sharing this lesson!', { exact: true })).toBeVisible();
    await feedPost.locator('.comment').getByRole('button', { name: 'Delete', exact: true }).click();
    await feedPost.getByRole('button', { name: 'Delete comment', exact: true }).click();
    await expect(feedPost.getByText('Thanks for sharing this lesson!', { exact: true })).toHaveCount(0);
    await feedPost.getByLabel('Write a comment').fill('A second comment to verify post cleanup.');
    await feedPost.getByRole('button', { name: 'Add comment', exact: true }).click();
    await expect(feedPost.getByText('A second comment to verify post cleanup.', { exact: true })).toBeVisible();

    await b.goto('/notifications');
    const notification = b.locator('article').filter({ hasText: alice.username });
    await notification.getByRole('button', { name: 'Mark as read', exact: true }).click();
    await expect(notification.getByRole('button', { name: 'Mark as unread', exact: true })).toBeEnabled();
    await notification.getByRole('button', { name: 'Mark as unread', exact: true }).click();
    await expect(notification.getByRole('button', { name: 'Mark as read', exact: true })).toBeEnabled();

    await post.getByRole('link', { name: 'Edit', exact: true }).click();
    await a.getByLabel('Title', { exact: true }).fill('Updated transaction lesson');
    await a.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(a.getByText('Post updated successfully.')).toBeVisible();
    await b.goto(`/profile/${alice.id}`);
    await b.getByLabel('Report user — reason').fill('Moderation test: please review this learning post.');
    await b.getByRole('button', { name: 'Report', exact: true }).click();
    await expect(b.getByRole('button', { name: 'Confirm report', exact: true })).toBeVisible();
    await b.getByRole('button', { name: 'Confirm report', exact: true }).click();
    await expect(b.getByText(/Report sent/)).toBeVisible();

    expect(process.env.BOOTSTRAP_ADMIN_PASSWORD, 'Set the test admin credentials before running E2E').toBeTruthy();
    await login(admin, process.env.BOOTSTRAP_ADMIN_EMAIL!, process.env.BOOTSTRAP_ADMIN_PASSWORD!);
    await admin.getByRole('link', { name: 'Admin', exact: true }).click();
    await admin.getByRole('button', { name: /^Reports/ }).click();
    await expect(admin.locator('article').filter({ hasText: alice.username }).getByText('Moderation test: please review this learning post.', { exact: false })).toBeVisible();
    await admin.getByRole('button', { name: /^Users/ }).click();
    const aliceCard = admin.locator(`[data-user-id="${alice.id}"]`);
    await aliceCard.getByRole('button', { name: 'Ban', exact: true }).click();
    await expect(admin.getByRole('dialog')).toBeVisible();
    await admin.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(aliceCard.getByText('Active', { exact: true })).toBeVisible();
    await aliceCard.getByRole('button', { name: 'Ban', exact: true }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(aliceCard.getByText('Banned', { exact: true })).toBeVisible();
    expect((await request.get(`${api}/posts`, { headers: alice.headers })).status()).toBe(403);
    await aliceCard.getByRole('button', { name: 'Unban', exact: true }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(aliceCard.getByText('Active', { exact: true })).toBeVisible();
    await admin.getByRole('button', { name: /^Posts/ }).click();
    await admin.locator(`[data-post-id="${id}"]`).getByRole('button', { name: 'Delete post', exact: true }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(admin.locator(`[data-post-id="${id}"]`)).toHaveCount(0);
    expect((await request.get(imageUrl!)).status()).toBe(404);
    expect((await request.get(`${api}/posts/${id}`, { headers: bob.headers })).status()).toBe(404);
    const remaining = await request.post(`${api}/posts`, { headers: alice.headers, multipart: {
      title: 'Post removed with its author', content: 'Verify relational cleanup',
      media: { name: 'cleanup.png', mimeType: 'image/png', buffer: bytes }
    } });
    expect(remaining.ok()).toBeTruthy(); const remainingPost = await remaining.json();
    expect((await request.put(`${api}/posts/${remainingPost.id}/likes`, { headers: bob.headers })).ok()).toBeTruthy();
    expect((await request.post(`${api}/posts/${remainingPost.id}/comments`, { headers: bob.headers, data: { content: 'Related comment' } })).ok()).toBeTruthy();
    await admin.getByRole('button', { name: /^Users/ }).click();
    await aliceCard.getByRole('button', { name: 'Delete user', exact: true }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(aliceCard).toHaveCount(0);
    expect((await request.get(`${api}/posts/${remainingPost.id}`, { headers: bob.headers })).status()).toBe(404);
    expect((await request.get(`http://localhost:8081${remainingPost.mediaUrl}`)).status()).toBe(404);
    const reused = await request.post(`${api}/register`, { data: { username: alice.username, email: alice.email, password } });
    expect(reused.ok()).toBeTruthy();
    expect((await request.get(`${api}/posts`, { headers: alice.headers })).status()).toBe(401);
    await b.goto('/feed'); await expect(b.locator(`[data-post-id="${id}"]`)).toHaveCount(0);
    await b.screenshot({ path: info.outputPath('desktop-feed.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally { await Promise.all([aliceContext.close(), bobContext.close(), adminContext.close()]); }
});

test('REST permissions, validation and concurrent idempotent interactions', async ({ request }) => {
  const owner = await register(request, 'owner'); const other = await register(request, 'other');
  expect((await request.get(`${api}/posts`)).status()).toBe(401);
  for (const path of ['users', 'posts', 'reports']) {
    expect((await request.get(`${api}/admin/${path}`, { headers: other.headers })).status()).toBe(403);
  }
  expect((await request.post(`${api}/register`, { data: { username: owner.username, email: 'new' + owner.email, password } })).status()).toBe(400);
  const racingName = 'race' + unique();
  const registrations = await Promise.all(Array.from({ length: 4 }, () => request.post(`${api}/register`, {
    data: { username: racingName, email: `${racingName}@verify.example`, password }
  })));
  expect(registrations.filter(response => response.status() === 200)).toHaveLength(1);
  expect(registrations.filter(response => response.status() === 400)).toHaveLength(3);
  expect((await request.post(`${api}/register`, { data: { username: 'oversized' + unique(), email: 'long' + owner.email, password: 'é'.repeat(40) } })).status()).toBe(400);
  expect((await request.post(`${api}/posts`, { headers: owner.headers, multipart: { title: ' ', content: 'text' } })).status()).toBe(400);
  expect((await request.post(`${api}/posts`, { headers: owner.headers, multipart: {
    title: 'Spoofed image', content: 'text', media: { name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') }
  } })).status()).toBe(400);
  const created = await request.post(`${api}/posts`, { headers: owner.headers, multipart: { title: 'Concurrent lesson', content: 'Text' } });
  expect(created.ok()).toBeTruthy(); const post = await created.json();
  expect((await request.put(`${api}/posts/${post.id}`, { headers: other.headers, multipart: { title: 'Changed', content: 'text' } })).status()).toBe(403);
  expect((await request.delete(`${api}/posts/${post.id}`, { headers: other.headers })).status()).toBe(403);
  const follow = await Promise.all(Array.from({ length: 4 }, () => request.put(`${api}/users/${owner.id}/follow`, { headers: other.headers })));
  follow.forEach(response => expect(response.ok()).toBeTruthy());
  const likes = await Promise.all(Array.from({ length: 4 }, () => request.put(`${api}/posts/${post.id}/likes`, { headers: other.headers })));
  likes.forEach(response => expect(response.ok()).toBeTruthy());
  const status = await request.get(`${api}/posts/${post.id}/likes`, { headers: other.headers });
  expect((await status.json()).count).toBe(1);
  expect((await request.post(`${api}/posts/${post.id}/comments`, { headers: other.headers, data: { content: ' ' } })).status()).toBe(400);
  expect((await request.post(`${api}/users/${owner.id}/report`, { headers: other.headers, data: { reason: ' ' } })).status()).toBe(400);
  expect((await request.get(`${api}/posts/not-a-number`, { headers: other.headers })).status()).toBe(400);
  expect((await request.delete(`${api}/posts/${post.id}`, { headers: owner.headers })).status()).toBe(204);
});

test('mobile registration, navigation, XSS-safe content and playable MP4', async ({ page, request }, info) => {
  const errors: string[] = []; monitor(page, errors);
  await page.setViewportSize({ width: 375, height: 812 });
  const username = 'mobile' + unique(); const email = `${username}@verify.example`;
  await page.goto('/register'); await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/login/); await login(page, email);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Create Post', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create a post' })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('A video lesson');
  const text = '<img src=x onerror="window.xssExecuted=true">';
  await page.getByLabel('Content', { exact: true }).fill(text);
  const video = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d')!; const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4;codecs=avc1.42001E' });
    const chunks: Blob[] = []; recorder.ondataavailable = event => chunks.push(event.data);
    const finished = new Promise<number[]>(resolve => { recorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));
    }; });
    recorder.start(); let frame = 0;
    const timer = setInterval(() => { context.fillStyle = frame++ % 2 ? '#2563eb' : '#16a34a'; context.fillRect(0, 0, 64, 64); }, 100);
    setTimeout(() => { clearInterval(timer); recorder.stop(); }, 700);
    return finished;
  });
  const bytes = Buffer.from(video);
  await page.getByLabel('Image or video (optional)').setInputFiles({ name: 'lesson.mp4', mimeType: 'video/mp4', buffer: bytes });
  await expect(page.locator('video')).toBeVisible();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Post published successfully.')).toBeVisible();
  await expect(page.locator('.post-content')).toHaveText(text);
  expect(await page.evaluate(() => (window as any).xssExecuted)).toBeUndefined();
  const uploadedVideo = page.locator('article video');
  await expect.poll(() => uploadedVideo.evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(1);
  expect(await uploadedVideo.evaluate((video: HTMLVideoElement) => video.videoWidth)).toBe(64);
  const url = await uploadedVideo.getAttribute('src');
  expect(await (await request.get(url!)).body()).toEqual(bytes);
  const range = await request.get(url!, { headers: { Range: 'bytes=0-31' } });
  expect(range.status()).toBe(206); expect(await range.body()).toEqual(bytes.subarray(0, 32));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath('mobile-profile.png'), fullPage: true });
  await page.locator('app-delete-post').getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(0);
  await page.goto('/this-route-does-not-exist'); await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  expect(errors).toEqual([]);
});
