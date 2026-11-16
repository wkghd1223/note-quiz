import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PracticeAnswerToast from "./PracticeAnswerToast";

describe("PracticeAnswerToast", () => {
  it("announces the judgment and mode-owned details together without moving focus", () => {
    const markup = renderToStaticMarkup(
      <PracticeAnswerToast
        message="Incorrect"
        correct={false}
        announcementKey={3}
        details={
          <>
            <p>Your answer: lower / Correct: higher</p>
            <p>Notes: A3 · D4</p>
          </>
        }
      />,
    );
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-atomic="true"');
    expect(markup).toContain('data-visible="true"');
    expect(markup).toContain("Your answer: lower / Correct: higher");
    expect(markup).toContain("Notes: A3 · D4");
    expect(markup).not.toContain("tabindex");
  });

  it("omits answer content entirely when its caller hides feedback, even if old details remain supplied", () => {
    const markup = renderToStaticMarkup(
      <PracticeAnswerToast
        correct
        announcementKey={3}
        details={<p>Previous answer: A3</p>}
      />,
    );
    expect(markup).toContain('data-visible="false"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("Previous answer");
    expect(markup).not.toContain("data-answer-toast-details");
    expect(markup).not.toContain("<svg");
  });
});
