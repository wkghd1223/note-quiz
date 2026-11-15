import NotePracticeEntry from "../NotePracticeEntry";
import { practiceModeMetadata } from "@/lib/i18n/seo";
export const metadata = practiceModeMetadata("note", null);
export default function PracticePage() {
  return <NotePracticeEntry />;
}
