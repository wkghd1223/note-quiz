import { NextResponse } from "next/server";

const MEDIAVINE_ADS_TXT_URL =
  "https://adstxt.journeymv.com/sites/5b2560fd-53fe-4920-872c-67302bb9311c/ads.txt";

export function GET() {
  return NextResponse.redirect(MEDIAVINE_ADS_TXT_URL, 301);
}
