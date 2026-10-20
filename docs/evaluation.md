# 01Blog evaluation walkthrough

Use two ordinary accounts (A and B) and an administrator. A private browser window provides a separate session. These steps complement `python3 scripts/verify.py` and help demonstrate the assignment during peer review.

| Area | Demo / expected result |
| --- | --- |
| Structure and setup | Separate Spring Boot and Angular directories; root README contains configuration, dependencies and run/test commands. |
| Registration | Register A/B; duplicate username/email and invalid/empty fields show errors. Passwords in PostgreSQL are BCrypt hashes. |
| Authentication | Log in/out; anonymous users are redirected to login; an invalid/expired JWT is rejected by the API. |
| Permissions | User navigation hides Admin. Visiting `/admin` as a user is denied, and calling `/api/admin/**` directly returns 403. |
| Profiles and subscriptions | B opens Discover Users, follows A, refreshes and sees the persisted follow status/counts. Unfollow removes the subscription. |
| Post creation | A publishes text and an image or MP4. Preview appears before upload; title, author, timestamp and media appear afterward. Empty posts and invalid uploads are rejected. |
| Ownership | A edits/deletes their own posts. B cannot change A's posts even by calling the API directly. Editing without choosing new media preserves it. |
| Feed | B follows A before publishing; A's new post appears in B's feed after refresh. Unfollowed authors do not populate the subscription feed. |
| Likes/comments | B likes/unlikes and adds a comment. A refreshes comments to see it. B confirms comment deletion and the comment disappears. |
| Notifications | Publishing creates a notification for B. The badge refreshes through polling; the notification page supports explicit refresh and read/unread changes. |
| Reporting | B opens A's profile, enters a reason and reviews the confirmation before sending. Only Admin can list the report with its timestamp and reason. |
| Admin users | Admin reviews all users, cancels a moderation dialog, then confirms ban/unban. Banned accounts cannot log in or continue using an existing token. |
| Admin content | Admin removes an inappropriate post. Likes/comments are removed with it and its uploaded file becomes unavailable. |
| Account deletion | Admin deletes an ordinary account with posts and interactions. Related rows and the account's post media are cleaned up. Re-registering the email does not validate the old JWT. |
| Validation | Empty/overlong text, oversized/mismatched media, duplicate registrations and invalid identifiers produce client errors. |
| Rendering | A post containing an HTML tag displays it as text. File URLs return media with explicit types and byte-range support. |
| Responsive UI | At 375px width, open the mobile menu, create a post and view a profile without horizontal scrolling. Repeat the normal flow on desktop. |
| Error handling | Invalid Angular routes show a useful page; server/network failures show feedback and preserve editable drafts. |
| Multiuser stability | Separate browser sessions complete the flow; simultaneous repeated follow/like requests create only one relationship. |

The automated browser suite captures screenshots and checks page/console errors during normal workflows. Intentional rejected API requests are asserted separately. Unit tests additionally cover rollback/media cleanup and failure/retry behavior.

Reports are profile reports, as required by the project specification. Post removal is available to administrators. Real-time WebSockets and other bonus features are outside the implemented scope.

## Recorded verification

On 2026-10-20, `scripts/verify.py` completed successfully against a disposable PostgreSQL 17 database:

- Backend: 111 tests passed, no failures/errors/skips.
- Frontend: 165 tests passed across 19 test files.
- Production Angular build: passed (approximately 646 kB initial bundle, 126 kB estimated transfer).
- Playwright/Chrome: all 3 workflows passed, including desktop and 375px mobile checks, real MP4 playback, concurrent writes and admin deletion of an account with related content.
- Normal browser flows produced no captured JavaScript/console errors.

The verification runner removed its test database/uploads and stopped its servers after the run. These results cover the recorded scenarios, not every possible browser, file codec or concurrency pattern.
