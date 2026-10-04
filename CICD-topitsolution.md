# Admin CI/CD — GitHub Actions → cPanel (`admin.topitsolution.com`)

`admin` repo-তে `main`-এ push করলেই admin panel নিজে থেকে build হয়ে cPanel-এ উঠবে।

> **এটা শুধু এই repo-র (`electrode-admin`) জন্য।** Backend আর storefront-এর CI/CD তাদের নিজের repo-তে
> নিজের ফাইলে। এখানে push করলে শুধু admin deploy হবে।
>
> এতে আসল domain আছে — client-এর জন্য clone করার সময় এই ফাইল মুছে দেবেন।

---

## ০. কীভাবে কাজ করবে

Admin কোনো Node app নয় — শুধু static file। তাই এটা তিনটার মধ্যে সবচেয়ে সহজ: কোনো migration নেই,
কোনো restart নেই।

```
git push (main)
   └─ GitHub Actions (Linux runner)
        ├─ npm ci → npm test
        ├─ npm run build                 ← VITE_API_BASE_URL, VITE_STOREFRONT_URL build-এ বসে
        ├─ dist/ → admin.tar.gz → scp → ~/deploy/
        └─ ssh → ~/admin-public.new-এ extract → .htaccess কপি → folder swap
             └─ https://admin.topitsolution.com যাচাই
```

---

## ১. একবারের setup — SSH key

> **Backend বা storefront-এর জন্য key আগেই বানিয়ে থাকলে সেটাই চলবে** — §১.১–১.২ বাদ দিন।
> শুধু secret এই repo-তে আলাদা বসাতে হবে (§২)।

### ১.১ PC-তে key (Git Bash)

```bash
ssh-keygen -t ed25519 -C "github-deploy-topit" -f ~/.ssh/topit_deploy -N ""
```

### ১.২ Public key cPanel-এ (cPanel → Terminal)

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAA...topit_deploy.pub-এর পুরো লাইন...' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

পেস্টে গোলমাল হলে **cPanel → SSH Access → Import Key → Manage → Authorize**।

### ১.৩ PC থেকে পরীক্ষা

```bash
ssh -i ~/.ssh/topit_deploy -p 22 CPUSER@HOST 'echo ok; ls -la ~/admin-public/.htaccess'
```

- `HOST` = FileZilla-তে SFTP-র host। domain Cloudflare-এর পেছনে থাকলে server-এর IP/hostname।
- **`.htaccess` না পেলে** আগে `DEPLOY-topitsolution.md` §৭ থেকে বসান — workflow ওটা ছাড়া deploy করবে না।
- **`~/admin-public` না পেলে** — `DEPLOY-topitsolution.md` §২-এ subdomain বানানোর সময় document root
  ডিফল্ট রেখে দিয়েছিলেন হয়তো। **cPanel → Domains**-এ `admin.topitsolution.com`-এর document root দেখে
  `.github/workflows/deploy.yml`-এর `APP="$HOME/admin-public"` লাইনে সেটা লিখুন।

---

## ২. GitHub-এ secret আর variable — শুধু `electrode-admin` repo-তে

**GitHub → `AbdulAzizSajib/electrode-admin` → Settings → Secrets and variables → Actions**

**Secrets:**

| Secret | মান |
|---|---|
| `SSH_HOST` | §১.৩-এর `HOST` |
| `SSH_PORT` | `22` |
| `SSH_USER` | cPanel username |
| `SSH_PRIVATE_KEY` | `~/.ssh/topit_deploy`-এর পুরো লেখা, BEGIN থেকে END পর্যন্ত |
| `SSH_KNOWN_HOSTS` | `ssh-keyscan -p 22 HOST`-এর output |

**Variables** (দুটোই browser bundle-এ খোলাখুলি বসে, secret নয়):

| Variable | মান |
|---|---|
| `VITE_API_BASE_URL` | `https://api.topitsolution.com/api/v1` |
| `VITE_STOREFRONT_URL` | `https://topitsolution.com` |

`gh` CLI দিয়ে (Git Bash, **`admin/` folder থেকে** — তাহলে শুধু এই repo-তে বসবে):

```bash
gh secret set SSH_HOST        --body "HOST"
gh secret set SSH_PORT        --body "22"
gh secret set SSH_USER        --body "CPUSER"
gh secret set SSH_PRIVATE_KEY < ~/.ssh/topit_deploy
ssh-keyscan -p 22 HOST | gh secret set SSH_KNOWN_HOSTS
gh variable set VITE_API_BASE_URL   --body "https://api.topitsolution.com/api/v1"
gh variable set VITE_STOREFRONT_URL --body "https://topitsolution.com"
```

> **দুটোর একটাও বাদ পড়লে build তবুও সফল হবে** — `VITE_API_BASE_URL` ছাড়া panel নিজের origin-কে API ধরে
> সব request 404 দেয়, `VITE_STOREFRONT_URL` ছাড়া "View page" link `localhost:4000`-এ যায়
> (`DEPLOY-topitsolution.md` §৪.৩)। তাই workflow-এ build-এর আগে একটা ধাপ দুটো আছে কিনা দেখে নেয়।

---

## ৩. Workflow ফাইল

Workflow আছে [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)-এ, এখানে আর কপি রাখা হয়নি
যাতে দুটো আলাদা হয়ে না যায়। ধাপগুলো এরকম:

1. VITE variable দুটো আছে কিনা দেখে — না থাকলে build শুরুই হয় না
2. `npm ci` → `npm test` → `npm run build`
3. `dist/` → `admin.tar.gz` → `scp` দিয়ে `~/deploy/`-এ
4. Server-এ: `~/admin-public.new`-এ extract → পুরনো `.htaccess` কপি → folder swap
5. `/` আর `/login` দুটো URL দিয়ে যাচাই

### কেন এভাবে

- **rsync নয়, tar** — এই host-এ `rsync` নেই (`which rsync` কিছু দেখায় না)। `tar` আর `scp` সব cPanel-এ থাকে।
- **নতুন folder-এ extract, তারপর swap** — Vite প্রতি build-এ file-এর নামে নতুন hash দেয়
  (`index-a1b2c3.js`)। পুরনো folder-এর ওপর extract করলে পুরনো JS জমতে থাকত। নতুন folder-এ extract করলে
  পুরনো ফাইল থাকেই না, আর upload চলাকালীন কেউ অর্ধেক-নতুন panel পায় না।
- **`.htaccess` কপি করা হয়** — ওটা আপনি হাতে বসিয়েছেন (`DEPLOY-topitsolution.md` §৭), `dist/`-এ নেই।
  পুরনো folder-এ `.htaccess` না পেলে workflow থেমে যায় — ওটা ছাড়া deploy করলে refresh করলেই 404।
- **পুরনো build `~/admin-public.old`-এ থাকে** — rollback-এর জন্য (§৫)।

---

## ৪. প্রথমবার চালানো

```bash
cd admin
git add .github/workflows/deploy.yml CICD-topitsolution.md
git commit -m "ci: deploy admin to cPanel"
git push
```

**GitHub → Actions → Deploy admin** (~২–৪ মিনিট)। Push ছাড়া চালাতে **Run workflow**।

> **`main`-এ প্রতিটা push এখন live।** অর্ধেক কাজ আলাদা branch-এ রাখুন।

---

## ৫. Rollback

**cPanel → Terminal:**

```bash
cd ~
mv admin-public admin-public.broken
mv admin-public.old admin-public
```

পরে `rm -rf ~/admin-public.broken`। Admin static, তাই restart লাগে না।

আরও পুরনো version-এ ফিরতে: **GitHub → Actions → সেই সবুজ "Deploy admin" run → Re-run all jobs** —
সেই run-এর commit থেকে আবার build করে বসাবে।

---

## ৬. সমস্যা হলে

| যা দেখবেন | কারণ |
|---|---|
| **`Permission denied (publickey)`** | public key cPanel-এ বসেনি, বা `SSH_PRIVATE_KEY` অসম্পূর্ণ |
| **`Host key verification failed`** | `SSH_KNOWN_HOSTS` খালি বা অন্য host-এর |
| **`.htaccess missing`** | `~/admin-public/.htaccess` নেই — `DEPLOY-topitsolution.md` §৭ থেকে বসিয়ে **Re-run jobs** |
| **"Build-time URLs present" লাল** | §২-এর Variables বসেনি (Secrets ট্যাবে নয়, **Variables** ট্যাবে বসাতে হবে) |
| **`npm ci` ব্যর্থ: lockfile মেলে না** | local-এ `npm install` চালিয়ে `package-lock.json` commit করুন |
| **Health check-এ `/login` 404** | `admin-public/.htaccess` নেই — `DEPLOY-topitsolution.md` §৭ থেকে আবার বসান |
| **Panel খোলে কিন্তু CORS error** | CI-র সমস্যা নয় — backend-এর `ADMIN_URL` env দেখুন |
| **Deploy-এর পর খোলা tab-এ "Failed to fetch dynamically imported module"** | পুরনো tab পুরনো JS file চাইছে যেটা নতুন build-এ নেই। page refresh করলেই ঠিক |
