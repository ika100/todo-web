import { describe, expect, it } from "vitest";

import { GET as health } from "@/app/api/health/route";
import { GET as metrics } from "@/app/api/metrics/route";
import { GET as ready } from "@/app/api/ready/route";

describe("probe endpoints after the todo page", () => {
  it("AC-001.2 /api/health, /api/ready and /api/metrics answer as before", async () => {
    const h = health();
    expect(h.status).toBe(200);
    expect(await h.json()).toEqual({ status: "ok" });
    const r = ready();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "ready" });
    const m = await metrics();
    expect(m.status).toBe(200);
    expect(m.headers.get("content-type")).toContain("text/plain");
  });
});
