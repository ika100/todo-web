import { describe, expect, it } from "vitest";

import { MAX_TITLE_LENGTH, MESSAGES, validateTitle } from "@/app/_lib/todo";

describe("todo title rules and messages", () => {
  it("AC-001.7 rejects empty and whitespace-only titles with title_required", () => {
    for (const raw of ["", "   ", "\t\n "]) expect(validateTitle(raw)).toEqual({ ok: false, error: "title_required" });
    expect(MESSAGES.title_required).toBe("Title is required");
  });

  it("AC-001.9 rejects 201 code points after trimming with title_too_long", () => {
    expect(MAX_TITLE_LENGTH).toBe(200);
    expect(validateTitle("a".repeat(201))).toEqual({ ok: false, error: "title_too_long" });
    expect(validateTitle(`  ${"a".repeat(201)}  `)).toEqual({ ok: false, error: "title_too_long" });
    expect(MESSAGES.title_too_long).toBe("Title must be at most 200 characters");
  });

  it("AC-001.10 accepts exactly 200 code points, counting emoji as one", () => {
    expect(validateTitle("a".repeat(200))).toEqual({ ok: true, title: "a".repeat(200) });
    const emoji = "😀".repeat(200); // 400 UTF-16 units
    expect(validateTitle(emoji)).toEqual({ ok: true, title: emoji });
    expect(validateTitle("😀".repeat(201))).toEqual({ ok: false, error: "title_too_long" });
  });

  it("AC-001.12 trims leading and trailing spaces", () => {
    expect(validateTitle("  Buy milk  ")).toEqual({ ok: true, title: "Buy milk" });
  });

  it("AC-001.16 and AC-001.17 expose the fixed user messages", () => {
    expect(MESSAGES.not_found).toBe("This todo no longer exists");
    expect(MESSAGES.unavailable).toBe("Todos are unavailable, please try again");
  });
});
