# Search evaluation protocol

The 20 development and 10 held-out queries were written as separate files before the first scoring run. They are engineering judgments based on the reviewed catalog, not user feedback or an independent human study. No expected sets were changed to improve the reported score. The held-out set was not used to tune this implementation; because both sets were authored in the same build session, do not treat it as statistically independent research.

An answerable case passes top-three relevance if at least one acceptable profile appears among the first three results. No-match cases require zero results. Every returned deployment is checked against applied auth, price, setup and restricted-credential constraints. Include-unknown behavior is separately tested. Initial targets: >=80% top-three relevance and zero silent constraint violations.

Run `pnpm evaluate` against the genuine curated catalog. Results include every case and applied filter, plus a documented local 200-search/concurrency-5 benchmark after 20 warmups. The benchmark directly calls the shared PostgreSQL search service, not a deployed HTTP load test. Rerun after curation/search changes; explain misses without changing the baseline expectations.
