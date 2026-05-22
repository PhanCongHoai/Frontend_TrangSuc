import { useEffect, useMemo, useState } from "react";

const buildBannerImageUrl = (banner) => {
  if (!banner?.image_url) {
    return "";
  }

  return `${banner.image_url}${banner.image_url.includes("?") ? "&" : "?"}v=${
    banner.cache_key || banner.id || Date.now()
  }`;
};

function HeroSection({ heroBanners = [] }) {
  const banners = useMemo(
    () => heroBanners.filter((banner) => buildBannerImageUrl(banner)),
    [heroBanners]
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((currentIndex) =>
      banners.length ? Math.min(currentIndex, banners.length - 1) : 0
    );
  }, [banners.length]);

  if (!banners.length) {
    return null;
  }

  const activeBanner = banners[activeIndex];
  const bannerImageUrl = buildBannerImageUrl(activeBanner);
  const hasMultipleBanners = banners.length > 1;

  const showPreviousBanner = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === 0 ? banners.length - 1 : currentIndex - 1
    );
  };

  const showNextBanner = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === banners.length - 1 ? 0 : currentIndex + 1
    );
  };

  return (
    <section className="hero hero-banner hero-banner-image-only">
      <img
        key={activeBanner.id || bannerImageUrl}
        src={bannerImageUrl}
        alt="Banner trang chủ"
        className="hero-banner-image"
        loading="eager"
        decoding="async"
        draggable="false"
      />

      {hasMultipleBanners ? (
        <>
          <button
            type="button"
            className="hero-banner-arrow hero-banner-arrow-prev"
            onClick={showPreviousBanner}
            aria-label="Banner trước"
          >
            {"<"}
          </button>
          <button
            type="button"
            className="hero-banner-arrow hero-banner-arrow-next"
            onClick={showNextBanner}
            aria-label="Banner tiếp theo"
          >
            {">"}
          </button>
        </>
      ) : null}
    </section>
  );
}

export default HeroSection;
