"use client";
import PracticeClient from "./PracticeClient";
import TheoryPracticeMode from "@/components/practice/TheoryPracticeMode";

export default function IntervalPracticeEntry() {
  return (
    <PracticeClient mode="interval">
      {({ sessionKey, theoryProps }) => (
        <TheoryPracticeMode key={sessionKey} {...theoryProps} />
      )}
    </PracticeClient>
  );
}
