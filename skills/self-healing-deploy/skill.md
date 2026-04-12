# Self-Healing Deploy

Autonomous deployment with pre-flight checks, automatic error fixing, and post-deploy verification.

## Triggers
- "deploy"
- "ship it"
- "push to production"
- "go live"
- "publish"

## Pre-Flight Checklist (ZDBS Gate)

Run ALL checks before any deployment:

### 1. TypeScript Compilation
```bash
npx tsc --noEmit
```
- Must pass with zero errors
- If fails: Fix each error, re-run until clean

### 2. Build Test
```bash
npm run build
```
- Must complete successfully
- If fails: Read error, fix, rebuild

### 3. Lint Check
```bash
npm run lint
```
- Fix all errors (warnings acceptable)

### 4. Security Scan
- No API keys in client code
- No secrets in committed files
- Check `.env` is in `.gitignore`
- Verify no `SUPABASE_SERVICE_ROLE_KEY` in client components

### 5. RLS Audit (if Supabase)
- Every table has RLS enabled
- Policies defined for all operations

### 6. Responsive Check
- Verify Tailwind responsive classes present
- Check for mobile breakpoints (sm:, md:, lg:)

## Deployment Protocol

### Step 1: Stage All Changes
```bash
git add -A
```

### Step 2: Commit with Meaningful Message
```bash
git commit -m "feat: [description of changes]"
```
Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructure
- `style:` - Visual changes
- `perf:` - Performance improvement
- `docs:` - Documentation
- `chore:` - Maintenance

### Step 3: Push to Main
```bash
git push origin main
```

### Step 4: Verify Deployment
1. Check Vercel dashboard for build status
2. Wait for deployment to complete
3. Visit production URL
4. Verify key functionality works

## Self-Healing Protocol

When errors occur:

### Build Error
1. Read the full error message
2. Identify the file and line number
3. Fix the issue
4. Run `npm run build` again
5. Repeat until clean

### TypeScript Error
1. Check the type mismatch
2. Fix with proper typing (no `any`)
3. Run `npx tsc --noEmit` again
4. Repeat until clean

### Git Conflict
1. Check `git status` for conflicted files
2. Resolve conflicts (keep latest changes)
3. Stage resolved files
4. Commit and push

### Vercel Build Failure
1. Check Vercel logs for error
2. Pull latest, fix locally
3. Test with `npm run build`
4. Push fix

## Post-Deploy Verification

After successful deployment:

1. **Load Test** - Visit production URL, ensure loads under 3s
2. **Visual Check** - Verify styling matches development
3. **Responsive Test** - Check on mobile viewport
4. **Functionality Test** - Test primary user flows
5. **Console Check** - No errors in browser console

## Error Recovery

If deployment breaks production:

1. **Immediate**: Check Vercel for previous working deployment
2. **Rollback**: Use Vercel dashboard to redeploy previous version
3. **Fix**: Debug locally with `npm run build`
4. **Redeploy**: Push fix when confirmed working

## Success Criteria

Deployment complete when:
- [ ] All pre-flight checks pass
- [ ] Git push successful
- [ ] Vercel build completes
- [ ] Production URL accessible
- [ ] No console errors
- [ ] Core functionality working
