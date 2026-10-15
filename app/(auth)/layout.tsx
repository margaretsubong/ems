import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 md:p-6 lg:p-8">
      {/* Background */}
      <Image
        src="/images/authbg.png"
        alt=""
        fill
        className="object-cover"
        priority
        aria-hidden="true"
      />
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />

      {/* Auth card */}
      <div className="relative z-10 flex w-full max-w-[920px] overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl">
        {/* Left: Form section */}
        <div className="flex w-full flex-col justify-center px-8 py-10 md:px-12 md:py-12 lg:w-[55%]">
          {children}
        </div>

        {/* Right: Decorative image (hidden on mobile) */}
        <div className="relative hidden lg:block lg:w-[45%]">
          <Image
            src="/images/loginside.png"
            alt="Decorative abstract pastel design"
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>
    </div>
  );
}
