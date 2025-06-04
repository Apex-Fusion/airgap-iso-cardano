# 🚀 Nix CI Migration Guide

This document explains the migration from traditional npm-based CI to Nix-powered CI workflows.

## 📋 Migration Overview

We've created new Nix-powered workflows that leverage your excellent `flake.nix`:

- **`ci-nix.yml`** - Nix-powered CI pipeline (replaces `ci.yml`)
- **`release-nix.yml`** - Nix-powered releases (replaces `release.yml`)
- **`setup-nix/action.yml`** - Reusable Nix setup action

## 🔄 Migration Strategy

### Phase 1: Parallel Testing (Recommended Start)

1. **Keep existing workflows** running for safety
2. **Enable new Nix workflows** to run alongside them
3. **Compare results** and performance
4. **Fix any Nix-specific issues**

To enable parallel testing:

```bash
# Rename existing workflows to keep them as backup
mv .github/workflows/ci.yml .github/workflows/ci-traditional.yml
mv .github/workflows/release.yml .github/workflows/release-traditional.yml

# New Nix workflows are ready to use
# .github/workflows/ci-nix.yml
# .github/workflows/release-nix.yml
```

### Phase 2: Full Migration

Once Nix workflows are proven:

1. **Disable traditional workflows** (rename with `.disabled` extension)
2. **Rename Nix workflows** to primary names:
   ```bash
   mv .github/workflows/ci-nix.yml .github/workflows/ci.yml
   mv .github/workflows/release-nix.yml .github/workflows/release.yml
   ```

## ✨ Benefits You'll Get

### 🔄 Reproducible Builds
- **Same environment everywhere** - Local dev = CI = Release
- **Pinned dependencies** - Exact versions in `flake.lock`
- **Hermetic builds** - No external dependencies

### ⚡ Performance Improvements
- **Magic Nix Cache** - Shared cache across all CI jobs
- **Parallel execution** - Better parallelization of Nix builds
- **Faster setup** - No Node.js version management overhead

### 🎯 Unified Tooling
- **Same commands** - `nix develop`, `nix run .#test`, etc.
- **Leverage your apps** - Uses your custom Nix apps directly
- **Built-in checks** - Uses your `flake.nix` checks

## 🔧 How It Works

### Your Flake Integration

The new CI leverages your existing flake features:

```yaml
# Uses your flake checks
- run: nix build .#checks.x86_64-linux.build
- run: nix build .#checks.x86_64-linux.test  
- run: nix build .#checks.x86_64-linux.lint

# Uses your custom apps
- run: nix run .#test security
- run: nix run .#doctor
- run: nix run .#setup

# Uses your dev environment
- run: nix develop --command npm run bundle:airgap:zip
```

### Key Workflow Jobs

#### Main CI (`ci-nix.yml`)
1. **Change Detection** - Skip unnecessary work
2. **Flake Validation** - Ensure flake is valid
3. **Nix Checks** - Run your build/test/lint checks in parallel
4. **Advanced Tests** - Use your test apps (security, performance, etc.)
5. **AirGap Bundle** - Build bundle in Nix environment
6. **Package Build** - Build package reproducibly
7. **Integration** - End-to-end testing
8. **Health Check** - Use your doctor app

#### Release (`release-nix.yml`)
1. **Comprehensive Checks** - Full flake validation
2. **Reproducible Build** - Package + AirGap bundle
3. **Release Validation** - Verify all artifacts
4. **GitHub Release** - Publish with verification instructions

## 🧪 Testing the Migration

### 1. Validate Your Flake

First, ensure your flake works correctly:

```bash
# Test locally
nix flake check          # Should pass all checks
nix run .#setup         # Should set up project
nix run .#test security # Should run security tests
nix develop --command npm run bundle:airgap:zip
```

### 2. Test Workflows Locally

You can test the workflows using `act` or by triggering them:

```bash
# Create a test commit to trigger CI
git commit --allow-empty -m "test: trigger Nix CI"
git push origin your-branch
```

### 3. Compare Results

Monitor both traditional and Nix workflows to compare:
- **Build times**
- **Success rates** 
- **Artifact quality**
- **Reproducibility**

## 🔧 Customization

### Adding More Nix Apps

If you want to add more test categories to your flake:

```nix
# In flake.nix apps section
test-custom = {
  type = "app";
  program = "${pkgs.writeShellScript "test-custom" ''
    ${nodejs}/bin/npm test -- --testPathPattern="custom"
  ''}/bin/test-custom";
};
```

Then use in CI:
```yaml
- run: nix run .#test-custom
```

### Modifying Checks

Your flake checks are in `flake.nix` around line 447. You can add more:

```nix
checks = {
  # Existing: build, test, lint
  
  # Add new check
  security = pkgs.stdenv.mkDerivation {
    name = "security-check";
    src = ./.;
    nativeBuildInputs = buildInputs;
    buildPhase = ''
      npm ci
      npm run security-audit
      npm run test -- --testPathPattern="security"
    '';
    installPhase = "mkdir $out";
  };
};
```

## 🐛 Troubleshooting

### Common Issues

1. **Flake check fails**
   ```bash
   nix flake check --show-trace  # Get detailed error info
   ```

2. **Cache misses**
   - Magic Nix Cache should handle this automatically
   - Check cache hit rates in workflow logs

3. **Node.js version mismatch**
   - Your flake pins Node.js 20 - this is now the source of truth
   - Update `package.json` engines if needed

4. **Build artifacts missing**
   - Nix builds are hermetic - ensure all inputs are declared
   - Check `nativeBuildInputs` in flake.nix

### Getting Help

1. **Check workflow logs** for detailed error messages
2. **Test locally** with same Nix commands
3. **Validate flake** with `nix flake check --show-trace`
4. **Compare with traditional workflow** if parallel testing

## 📊 Expected Improvements

After migration, you should see:

- ⚡ **20-40% faster CI** due to better caching
- 🔄 **100% reproducible builds** 
- 🎯 **Unified dev/CI experience**
- 🛡️ **Better security** through hermetic builds
- 📦 **Smaller maintenance burden** - less CI configuration

## 🎯 Rollback Plan

If you need to rollback:

1. **Disable Nix workflows** (rename with `.disabled`)
2. **Re-enable traditional workflows** (remove `.disabled`)
3. **Keep Nix workflows** for future retry

The migration is designed to be safe and reversible!

---

## 📝 Next Steps

1. ✅ **Review this migration guide**
2. 🧪 **Test Phase 1 (parallel workflows)**
3. 📊 **Compare results for a few runs**
4. 🚀 **Complete Phase 2 (full migration)**
5. 🎉 **Enjoy reproducible, faster CI!**

Questions? The new workflows are heavily commented to explain what they're doing!