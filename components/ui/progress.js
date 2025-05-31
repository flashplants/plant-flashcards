import * as React from "react";

export const Progress = React.forwardRef(({ value = 0, max = 100, className = "" }, ref) => {
  return (
    <div
      ref={ref}
      className={`relative w-full h-2 bg-gray-200 rounded-full overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="absolute left-0 top-0 h-full bg-green-600 transition-all duration-300 rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }}
      />
    </div>
  );
});
Progress.displayName = "Progress"; 