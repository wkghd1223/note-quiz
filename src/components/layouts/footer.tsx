import Image from "next/image";
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="mt-12 w-full border-t border-[#ded6f7] bg-white/80 px-4 py-8 text-center text-sm text-slate-500 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="footer-section flex items-center gap-3">
          <Image
            src="/logo-rm-bg.png"
            alt="Logo"
            className="footer-logo rounded-2xl"
            height={56}
            width={56}
          />
          <div className="text-left">
            <p className="text-lg font-black tracking-[-0.03em] text-slate-950">
              Note Quiz
            </p>
            <p className="text-sm text-[#6d28d9]">Sharpen your music reading.</p>
          </div>
          <div className="social-icons">
            <Link
              href="https://github.com/wkghd1223/note-quiz"
              target="_blank"
              rel="noopener"
              aria-label="GitHub"
            >
              <Image
                src="/github-mark.png"
                alt="GitHub Logo"
                className="github-logo rounded-xl border border-[#ded6f7] bg-white p-2 transition-transform duration-200 hover:scale-110"
                height={36}
                width={36}
              />
            </Link>
          </div>
        </div>
        <div className="footer-section">
          <p>&copy; {new Date().getFullYear()} Note Quiz. All rights reserved.</p>
          <Link href="mailto:wkghd951223@gmail.com" className="footer-email">
            Contact Us
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
