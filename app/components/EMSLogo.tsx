interface EMSLogoProps {
  className?: string;
  showSubtitle?: boolean;
}

export default function EMSLogo({
  className = "",
  showSubtitle = false,
}: EMSLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* 2x2 grid geometric square icon matching Figma reference */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="9" height="9" rx="2" fill="#6554F4" />
        <rect x="13" y="2" width="9" height="9" rx="2" fill="#818CF8" />
        <rect x="2" y="13" width="9" height="9" rx="2" fill="#38BDF8" />
        <rect x="13" y="13" width="9" height="9" rx="2" fill="#6554F4" />
      </svg>
      <div className="flex flex-col">
        <span className="font-bold text-gray-900 text-xl tracking-tight leading-none">
          EMS
        </span>
        {showSubtitle && (
          <span className="text-[10px] text-gray-500 font-medium tracking-normal mt-0.5">
            Employee Management System
          </span>
        )}
      </div>
    </div>
  );
}
