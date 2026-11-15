import IntervalPracticeEntry from "../IntervalPracticeEntry";
import { practiceModeMetadata } from "@/lib/i18n/seo";
export const metadata = practiceModeMetadata("interval", null);
export default function PracticePage() {
  return <IntervalPracticeEntry />;
}
