import { notFound, permanentRedirect } from "next/navigation";
import { challengeEnabled } from "@/features/challenge/config";
export default function LegacyChallengePage() {
  if (!challengeEnabled) notFound();
  permanentRedirect("/melody/generated");
}
