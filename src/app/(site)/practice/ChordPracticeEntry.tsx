"use client";
import PracticeClient from "./PracticeClient";
import TheoryPracticeMode from "@/components/practice/TheoryPracticeMode";

export default function ChordPracticeEntry() {
  return (
    <PracticeClient mode="chord">
      {({ sessionKey, theoryProps }) => (
        <TheoryPracticeMode key={sessionKey} {...theoryProps} />
      )}
    </PracticeClient>
  );
}
