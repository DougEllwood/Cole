# Put Cole Online — a permanent link for Kane

This gives Cole a real home on the internet. When it's done, Kane gets **one link
that never changes and always works on his phone data** — your PC doesn't need to
be on at all.

It's two parts: put the code on **GitHub** (free), then switch it on with **Render**
(free). ~15–20 minutes, all in your web browser. Take it one step at a time — if you
get stuck, tell me the step number.

Nothing secret goes online here — your ElevenLabs key is typed straight into Render
in Part B, never into the code.

---

## Part A — Put the code on GitHub (free)

1. Go to **github.com** and **Sign up** (free). Verify your email.
2. Click the **+** in the top-right → **New repository**.
3. Name it **cole**. Leave it **Public**. Click **Create repository**.
4. On the new page, click the link **"uploading an existing file"** (or **Add file → Upload files**).
5. **Unzip** the `cole-online.zip` I sent you. Open the folder.
6. Select **everything inside** it — the **src** folder plus `package.json`,
   `tsconfig.json`, `.gitignore`, `README.md` — and **drag it all** into the upload
   box on GitHub. Wait for the files to finish uploading.
7. Scroll down and click **Commit changes**.

That's the code online. (No keys are in it — safe to be public.)

---

## Part B — Switch it on with Render (free)

8. Go to **render.com** → **Get Started** → **Sign in with GitHub** (easiest — one login).
9. Click **New +** (top right) → **Web Service**.
10. Find your **cole** repo in the list → **Connect**.
11. Fill in the settings:
    - **Name:** `cole`  (this becomes your web address)
    - **Region:** pick the closest (Ohio or Virginia for Ontario)
    - **Branch:** `main`
    - **Build Command:** `npm install`
    - **Start Command:** `npm start`
    - **Instance Type:** **Free** to start (see the note below)
12. Click **Advanced** → **Add Environment Variable**, and add these two:
    - Key: `ELEVENLABS_API_KEY`  ·  Value: *your sk_… key*
    - Key: `ELEVENLABS_VOICE_ID`  ·  Value: `ZRwrL4id6j1HPGFkeCzO` *(or whatever voice you want)*
13. Click **Create Web Service**. Render builds it (2–3 minutes). When the top shows
    **"Live"**, you'll have a web address like **`https://cole-xxxx.onrender.com`**.
14. Open that address — that's Cole, live on the internet. **Send that link to Kane.**
    It's permanent. Works on his data, anywhere. The mic works too (it's a secure link).

---

## Good to know

- **Free tier "naps."** After ~15 minutes of no use, the free version sleeps, and the
  next visit takes ~30–60 seconds to wake up, then it's fast again. If that bugs you,
  switch the Instance Type to **Starter (~$7/month)** in Render and it stays instant,
  always on. You can change this anytime and cancel after the weekend.
- **Your keys are safe.** They live only in Render's settings (step 12), never in the
  public code.
- **Changing Cole later** (his voice, jokes, personality): we update the code and
  Render re-launches him automatically. We'll do that together when you want.
- **One voice tweak anytime:** in Render → your service → **Environment**, change
  `ELEVENLABS_VOICE_ID`, save — Cole restarts with the new voice. No re-deploy needed.
