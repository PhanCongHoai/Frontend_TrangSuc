import { useEffect } from "react";

function useHashScroll() {
  useEffect(() => {
    const scrollToHashSection = () => {
      const hash = window.location.hash;
      if (!hash) return;

      const target = document.querySelector(hash);
      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const timer = setTimeout(scrollToHashSection, 0);
    window.addEventListener("hashchange", scrollToHashSection);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", scrollToHashSection);
    };
  }, []);
}

export default useHashScroll;
