import fs from "node:fs";
import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
} from "@playwright/test/reporter";
export default class SummaryReporter implements Reporter {
  results: { title: string; status: string; durationMs: number }[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    this.results.push({
      title: test.titlePath().filter(Boolean).join(" / "),
      status: result.status,
      durationMs: result.duration,
    });
  }
  onEnd(result: FullResult) {
    fs.mkdirSync("reports", { recursive: true });
    fs.writeFileSync(
      "reports/browser-tests.json",
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          status: result.status,
          tests: this.results.length,
          passed: this.results.filter((x) => x.status === "passed").length,
          results: this.results,
        },
        null,
        2,
      ),
    );
  }
}
