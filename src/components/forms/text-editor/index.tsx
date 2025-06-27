"use client";
import dynamic from "next/dynamic";

const TextEditor = dynamic(
  () => import("@/components/forms/text-editor/_index"),
  { ssr: false }
);

export default TextEditor;
