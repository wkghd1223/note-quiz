'use client';

import { useRouter } from 'next/navigation';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

interface IModal {
  children: React.ReactNode;
  title?: string;
  isPage?: boolean;
}
/**
 * **Modal Component**
 *
 * A reusable modal component that supports opening and closing via ref.
 * - Supports blocking body scroll when active.
 * - Can function as a page-based modal that closes with `router.back()`.
 *
 * @component
 *
 * @example
 * ```tsx
 * import { useRef } from "react";
 * import Modal, { IModalRef } from "./Modal";
 *
 * const MyComponent = () => {
 *   const modalRef = useRef<IModalRef>(null);
 *
 *   return (
 *     <>
 *       <button onClick={() => modalRef.current?.openModal()}>Open Modal</button>
 *       <Modal ref={modalRef} title="My Modal">
 *         <p>This is the modal content.</p>
 *       </Modal>
 *     </>
 *   );
 * };
 * ```
 *
 *  export default function SuggestModal() {
 *    return (
 *      <Modal isPage>
 *        <GunHee />
 *      </Modal>
 *    );
 *  }
 *
 * @param {IModal} props - Component properties.
 * @param {IModalRef} ref - Forwarded ref to expose modal controls.
 * @returns {JSX.Element} The rendered modal component.
 */
const Modal = forwardRef<IModalRef, IModal>(
  ({ children, title, isPage }, ref) => {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);

    // Prevent body scroll when modal is open
    useEffect(() => {
      if (isVisible) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }

      return () => {
        document.body.style.overflow = 'auto'; // Reset on unmount
      };
    }, [isVisible]);

    // Animation effect when modal opens
    useEffect(() => {
      if (isPage) {
        setIsVisible(true);
      }
    }, []);

    function closeModal() {
      setIsVisible(false);
      if (isPage) {
        setTimeout(() => {
          router.back(); // Go back to the previous page
        }, 200);
      }
    }
    useImperativeHandle(ref, () => ({
      openModal: () => {
        setIsVisible(true);
      },
      closeModal: () => {
        setIsVisible(false);
      },
    }));
    return (
      <div
        className={`fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ zIndex: isVisible ? '10' : '-1' }}
      >
        <div
          className={`w-fit max-w-[95%] bg-white p-4 md:p-6 rounded-lg shadow-lg transform transition-transform duration-300 ${
            isVisible ? 'scale-100' : 'scale-95'
          }`}
        >
          <div className="min-h-10">
            {title && <h2>{title}</h2>}
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute z-10 top-6 right-6 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>
          </div>

          {/* Modal Content */}
          {children}
        </div>
      </div>
    );
  },
);
Modal.displayName = 'Modal';
export default Modal;
