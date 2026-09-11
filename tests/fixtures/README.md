# Offline fixtures

Routine tests do not call live third-party services. Registry tests replay explicitly identified curated source snapshots as offline upstream fixtures, plus synthetic outage, pagination, deletion and deprecation envelopes. These test observations never enter the release catalog or its verification history.

`fixture-profile.json` is deliberately synthetic. The fixtures operator refuses production and requires an explicit `basic_test` database and ENABLE_FIXTURES=true. It remains unpublished until an operator edits it in that disposable database.
