# 🚀 Pull Request

## 📋 Description

Provide a clear and concise description of the changes in this PR.

**Type of Change:**

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📖 Documentation update
- [ ] 🧪 Test improvements
- [ ] 🔧 Code refactoring
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security enhancement

## 🔗 Related Issues

<!-- Link to related issues using "Closes #123" or "Fixes #123" -->

- Closes #<!-- issue number -->
- Related to #<!-- issue number -->

## 🧪 Testing

**Test Coverage:**

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Security tests added/updated (if applicable)
- [ ] Performance tests added/updated (if applicable)
- [ ] All existing tests pass

**Testing Commands:**

```bash
# Commands to test these changes
npm test
npm run test:security  # if security-related
npm run test:performance  # if performance-related
```

**Manual Testing:**

<!-- Describe any manual testing performed -->

## 🔒 Security Considerations

**Security Impact:**

- [ ] No security impact
- [ ] Handles sensitive data (private keys, seeds, etc.)
- [ ] Changes cryptographic operations
- [ ] Modifies input validation
- [ ] Affects QR code serialization
- [ ] Updates security utilities

**Security Checklist:**

- [ ] Input validation implemented
- [ ] No hardcoded secrets or keys
- [ ] Proper error handling (no information leakage)
- [ ] Timing-safe operations where needed
- [ ] Air-gap security model maintained

## ⚡ Performance Impact

**Performance Considerations:**

- [ ] No performance impact
- [ ] Improves performance
- [ ] May impact performance (justified below)
- [ ] Performance tests added/updated

**Benchmarks:**

<!-- Include before/after performance metrics if applicable -->

## 🔄 Breaking Changes

**Breaking Changes:**

- [ ] No breaking changes
- [ ] Contains breaking changes (described below)

**Migration Guide:**

<!-- If breaking changes, provide migration instructions -->

## 📖 Documentation

**Documentation Updates:**

- [ ] No documentation needed
- [ ] README updated
- [ ] API documentation updated
- [ ] Code comments added/updated
- [ ] Migration guide created (for breaking changes)

## ✅ Checklist

**Code Quality:**

- [ ] Code follows project style guidelines
- [ ] Self-review of code completed
- [ ] Code is properly commented
- [ ] No debugging code left in
- [ ] TypeScript types are complete and accurate

**Testing:**

- [ ] All tests pass locally
- [ ] Test coverage is adequate (>90% for new code)
- [ ] Edge cases are tested
- [ ] Error conditions are tested

**Security:**

- [ ] Security implications reviewed
- [ ] No sensitive data in code or tests
- [ ] Input validation is comprehensive
- [ ] Cryptographic operations are secure

**AirGap Compliance:**

- [ ] Maintains air-gap security model
- [ ] QR code compatibility preserved
- [ ] Offline functionality maintained
- [ ] No network dependencies added

## 🎯 Review Guidelines

**For Reviewers:**

- [ ] Code logic and implementation
- [ ] Security implications and best practices
- [ ] Test coverage and quality
- [ ] Performance impact
- [ ] Documentation completeness
- [ ] Breaking change assessment
- [ ] AirGap security model compliance

## 📊 Test Results

<!-- Paste relevant test results, CI status, or benchmark results -->

```
npm test results:
- Tests: X passed, Y total
- Coverage: Z%
- Time: Xs

Security tests:
- Tests: X passed, Y total
- Vulnerabilities: None detected
```

## 🚀 Deployment Notes

**Deployment Considerations:**

- [ ] No special deployment requirements
- [ ] Requires documentation updates
- [ ] Requires version bump (major/minor/patch)
- [ ] Requires migration steps

**Release Notes:**

<!-- Brief summary for release notes -->

---

## 📝 Additional Notes

<!-- Any additional information for reviewers -->

**Questions for Reviewers:**

- <!-- Any specific questions or areas of concern -->

**Future Work:**

- <!-- Any follow-up work or known limitations -->

---

By submitting this PR, I confirm that:

- [ ] I have read and followed the contributing guidelines
- [ ] My code follows the security best practices
- [ ] I have tested my changes thoroughly
- [ ] I understand this code will be used in security-critical applications

<!--
Thank you for contributing to the AirGap Cardano module! 🙏
Your contribution helps improve cryptocurrency security for everyone.
-->
