import EarPracticeEntry from "../EarPracticeEntry";
import { practiceModeMetadata } from "@/lib/i18n/seo";
export const metadata = practiceModeMetadata("ear", null);
export default function PracticePage() {
  return <EarPracticeEntry />;
}
