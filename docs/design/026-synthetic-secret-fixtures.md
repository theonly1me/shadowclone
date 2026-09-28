# Synthetic secret fixtures

Shadowclone tests need credential-shaped inputs to verify redaction, capture boundaries, and local evaluation probes. The catalog's source scanner treats literal strings with those shapes as possible credentials even when they appear in tests. Moving fixtures outside the repository would make tests depend on an external store and would leave other scanned literals in place.

Keep the fixtures in the repository. Construct each deterministic value from meaningful parts, such as a provider prefix and a synthetic payload, so no complete credential-shaped literal appears in source. Preserve the value that each test observes, its assertions, and redaction coverage. Local probes keep the same nonempty synthetic key for the CLI contract.

Update the affected fixtures, run focused tests, run the repository check, and scan the source with the catalog's pinned scanner version. The scan must report no hardcoded-secret findings without repository-owned ignore rules or a baseline.
