---
id: design-deep-modules
title: Build deep modules behind small interfaces
axis: null
category: architecture
section: engineering
applies-when:
  - designing a module or subsystem
---
## Build deep modules behind small interfaces

Place related complexity behind a small, stable interface. Keep policy at the boundary and prevent callers from coordinating internal steps themselves.
