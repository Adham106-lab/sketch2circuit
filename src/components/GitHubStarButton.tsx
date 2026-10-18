/**
 * @license Apache-2.0
 * @s2c/ui — High-Conversion "Star on GitHub" CTA Button with Live Star Counter.
 */

import { useEffect, useState } from "react";

const GITHUB_REPO_URL = "https://github.com/Adham106-lab/sketch2circuit";
const GITHUB_API_URL = "https://api.github.com/repos/Adham106-lab/sketch2circuit";
const CACHE_KEY = "s2c_github_stars_count";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache to prevent rate-limiting

export function GitHubStarButton({ className = "" }: { className?: string }) {
  const [starCount, setStarCount] = useState<number | null>(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS && typeof parsed.count === "number") {
          return parsed.count;
        }
      }
    } catch {
      // Ignore sessionStorage issues
    }
    return null;
  });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchStars() {
      try {
        const res = await fetch(GITHUB_API_URL, {
          signal: controller.signal,
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (!res.ok) {
          return;
        }

        const data = await res.json();
        if (typeof data?.stargazers_count === "number") {
          setStarCount(data.stargazers_count);
          try {
            sessionStorage.setItem(
              CACHE_KEY,
              JSON.stringify({
                count: data.stargazers_count,
                timestamp: Date.now(),
              }),
            );
          } catch {
            // Storage full or unavailable
          }
        }
      } catch (err: unknown) {
        // Silently handle offline / abort / rate-limit errors
        if ((err as Error)?.name !== "AbortError") {
          // Gracefully fallback to hiding counter
        }
      }
    }

    fetchStars();
    return () => controller.abort();
  }, []);

  const formattedStars =
    starCount !== null
      ? starCount >= 1000
        ? `${(starCount / 1000).toFixed(1)}k`
        : starCount.toString()
      : null;

  return (
    <a
      id="github-star-cta"
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Star sketch2circuit on GitHub"
      aria-label="Star sketch2circuit on GitHub"
      className={`group relative inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-[4px] font-sans text-xs font-semibold
        border border-amber-500/40 hover:border-amber-400
        bg-zinc-900/90 hover:bg-zinc-800 text-white
        transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-amber-500/10
        active:scale-[0.98] select-none no-underline shrink-0 ${className}`}
    >
      {/* Subtle glowing halo on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-[4px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-[2px] bg-amber-500/20"
      />

      {/* GitHub Octocat Icon */}
      <svg
        className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white transition-colors shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        />
      </svg>

      {/* Amber Star Icon with pulse / scale animation on hover */}
      <svg
        className="w-3.5 h-3.5 text-amber-400 fill-amber-400 group-hover:scale-125 group-hover:rotate-12 transition-transform duration-200 shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>

      {/* Text Label: Responsive ("Star on GitHub" on desktop/tablet, "Star" on small mobile) */}
      <span className="font-medium tracking-tight">
        <span className="hidden sm:inline">Star on GitHub</span>
        <span className="sm:hidden">Star</span>
      </span>

      {/* Live Star Counter Badge (Gracefully hidden if offline or rate-limited) */}
      {formattedStars !== null && (
        <span
          data-testid="github-stars-badge"
          className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold
            bg-amber-500/15 border border-amber-500/30 text-amber-300
            group-hover:bg-amber-500/25 group-hover:border-amber-400/50 transition-colors"
        >
          {formattedStars}
        </span>
      )}
    </a>
  );
}
