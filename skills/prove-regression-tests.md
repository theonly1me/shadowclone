---
id: prove-regression-tests
title: Prove regression tests fail without the fix
axis: null
category: testing
section: workflow
applies-when:
  - adding a regression test for a confirmed defect
---
## Prove regression tests fail without the fix

Run the regression test with the enforcing change removed or inverted. Confirm it fails for the claimed reason, then restore the change and confirm it passes.
