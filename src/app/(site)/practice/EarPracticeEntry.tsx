"use client";
import PracticeClient from "./PracticeClient";
import EarPracticeMode from "@/components/practice/EarPracticeMode";

export default function EarPracticeEntry() {
  return (
    <PracticeClient mode="ear">
      {({ sessionKey, earProps }) => (
        <EarPracticeMode key={sessionKey} {...earProps} />
      )}
    </PracticeClient>
  );
}
