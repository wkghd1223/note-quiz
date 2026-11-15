"use client";
import PracticeClient from "./PracticeClient";
import NotePracticeMode from "@/components/practice/NotePracticeMode";

export default function NotePracticeEntry() {
  return (
    <PracticeClient mode="note">
      {({ sessionKey, noteProps }) => (
        <NotePracticeMode key={sessionKey} {...noteProps} />
      )}
    </PracticeClient>
  );
}
