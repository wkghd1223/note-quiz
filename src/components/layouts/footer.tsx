import Image from "next/image";
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="w-full py-4 bg-gray-200 text-center text-sm text-gray-600 flex flex-col justify-between items-center">
      <div className="flex justify-center">
        <div className="footer-section flex items-center">
          <Image
            src="/logo-rm-bg.png"
            alt="Logo"
            className="footer-logo"
            height={80}
            width={80}
          />
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
                className="github-logo transition-transform duration-200 hover:scale-110"
                height={40}
                width={40}
              />
            </Link>
          </div>
        </div>
      </div>
      <div className="footer-section">
        <p>&copy; {new Date().getFullYear()} Notequiz. All rights reserved.</p>
        <p>
          <Link href="mailto:wkghd951223@gmail.com" className="footer-email">
            Contact Us
          </Link>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
