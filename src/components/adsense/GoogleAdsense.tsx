import Script from "next/script";

const CLIENT_ID = "ca-pub-8230725169133274";

export default function GoogleAdsense() {
  return (
    <>
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`}
        crossOrigin="anonymous"
      ></Script>
    </>
  );
}
