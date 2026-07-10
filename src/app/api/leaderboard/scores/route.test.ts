import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const country = {
  countryCode: "US",
  countryName: "United States",
  flag: "US",
};

const { detectCountryFromHeaders, submitCountrySession } = vi.hoisted(() => ({
  detectCountryFromHeaders: vi.fn(),
  submitCountrySession: vi.fn(),
}));

vi.mock("@/lib/leaderboard/country", () => ({ detectCountryFromHeaders }));
vi.mock("@/lib/leaderboard/supabase", () => ({ submitCountrySession }));

import { POST } from "./route";

const validPayload = {
  schemaVersion: 2,
  sessionId: "123e4567-e89b-42d3-a456-426614174000",
  mode: "note",
  totalQuestions: 20,
  correctAnswers: 15,
  totalTime: 30_000,
};

function createRequest(payload: unknown) {
  return new NextRequest("http://localhost/api/leaderboard/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/leaderboard/scores", () => {
  beforeEach(() => {
    detectCountryFromHeaders.mockResolvedValue(country);
    submitCountrySession.mockResolvedValue("accepted");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns authoritative points for an accepted session", async () => {
    const response = await POST(createRequest(validPayload));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      sessionPoints: 18,
      submissionStatus: "accepted",
    });
    expect(submitCountrySession).toHaveBeenCalledWith(
      country,
      validPayload.sessionId,
      18,
      20,
      15,
      75,
    );
  });

  it("returns duplicate without changing the response contract", async () => {
    submitCountrySession.mockResolvedValue("duplicate");
    const response = await POST(createRequest(validPayload));

    await expect(response.json()).resolves.toMatchObject({
      sessionPoints: 18,
      submissionStatus: "duplicate",
    });
  });

  it("does not write an ineligible session", async () => {
    const response = await POST(
      createRequest({
        ...validPayload,
        totalQuestions: 5,
        correctAnswers: 5,
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      sessionPoints: 7,
      submissionStatus: "ineligible",
    });
    expect(submitCountrySession).not.toHaveBeenCalled();
  });

  it("treats a zero-answer session as ineligible", async () => {
    const response = await POST(
      createRequest({
        ...validPayload,
        totalQuestions: 0,
        correctAnswers: 0,
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      sessionPoints: 0,
      submissionStatus: "ineligible",
    });
    expect(submitCountrySession).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads", async () => {
    const response = await POST(
      createRequest({ ...validPayload, totalTime: 0 }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 503 when leaderboard storage is unavailable", async () => {
    submitCountrySession.mockRejectedValue(
      new Error("Storage request failed."),
    );
    const response = await POST(createRequest(validPayload));

    expect(response.status).toBe(503);
  });
});
