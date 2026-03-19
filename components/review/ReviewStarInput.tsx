"use client";

import { useState } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}

export default function ReviewStarInput({ value, onChange, size = 24 }: Props) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onClick={() => {
            onChange(i);
            const el = document.getElementById(`review-star-${i}`);
            if (el) {
              el.style.transform = "scale(1.2)";
              setTimeout(() => { el.style.transform = "scale(1)"; }, 100);
            }
          }}
          className="transition-transform"
          style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}
        >
          <svg
            id={`review-star-${i}`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={i <= display ? "#F59E0B" : "#374151"}
            stroke={i <= display ? "none" : "#F59E0B"}
            strokeWidth={i <= display ? 0 : 1.5}
            style={{ transition: "fill 150ms, transform 100ms" }}
          >
            <path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l7.1-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
