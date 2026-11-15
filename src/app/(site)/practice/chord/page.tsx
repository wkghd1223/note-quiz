import ChordPracticeEntry from "../ChordPracticeEntry";
import { practiceModeMetadata } from "@/lib/i18n/seo";
export const metadata = practiceModeMetadata("chord", null);
export default function PracticePage() {
  return <ChordPracticeEntry />;
}
