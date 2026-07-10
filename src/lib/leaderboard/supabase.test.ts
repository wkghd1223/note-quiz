import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitCountrySession } from "./supabase";

const country = {
  countryCode: "US",
  countryName: "United States",
  flag: "US",
};

describe("submitCountrySession", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("sends the authoritative session values to the v2 RPC", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue("accepted"),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitCountrySession(
        country,
        "123e4567-e89b-42d3-a456-426614174000",
        18,
        20,
        15,
        75,
      ),
    ).resolves.toBe("accepted");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://example.supabase.co/rest/v1/rpc/submit_anonymous_session_v2",
    );
    expect(options).toEqual(expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(options.body)).toEqual({
      p_period_date: expect.any(String),
      p_session_id: "123e4567-e89b-42d3-a456-426614174000",
      p_country_code: "US",
      p_country_name: "United States",
      p_session_points: 18,
      p_correct_answers: 15,
      p_total_questions: 20,
      p_accuracy: 75,
    });
  });

  it("rejects an unexpected RPC status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue("unknown"),
      }),
    );

    await expect(
      submitCountrySession(
        country,
        "123e4567-e89b-42d3-a456-426614174000",
        18,
        20,
        15,
        75,
      ),
    ).rejects.toThrow("invalid submission status");
  });
});
