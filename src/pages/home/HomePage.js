import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Header from "../Header";
import Footer from "../footer/Footer";
import FeaturedProductsSection from "./components/FeaturedProductsSection";
import HeroSection from "./components/HeroSection";
import StorySection from "./components/StorySection";
import NewsSection from "./components/NewsSection";
import {
  collections as defaultCollections,
} from "./data/homeData";
import {
  getBlockedProductIds,
  getLatestProductCatalogSync,
  subscribeProductVisibilityChange,
  syncBlockedProductIds,
} from "../../utils/productSync";
import {
  getLatestBannerSync,
  subscribeBannerChange,
} from "../../utils/bannerSync";
import { buildApiUrl } from "../../utils/api";
import "./HomePage.css";

function HomePage() {
  const location = useLocation();
  const shouldScrollToFeaturedProducts = Boolean(location.state?.scrollToFeaturedProducts);
  const [heroBanners, setHeroBanners] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [collections, setCollections] = useState(
    defaultCollections.map((item, index) => ({
      id: `default-${index}`,
      title: item.title,
      desc: item.desc,
      children: [],
    }))
  );

  const fetchHeroBanner = async () => {
    try {
      const latestBannerSync = getLatestBannerSync();
      const response = await fetch(
        `${buildApiUrl("/api/banners/home-hero")}?t=${latestBannerSync.changedAt || Date.now()}`,
        {
          cache: "no-store",
        }
      );
      const data = await response.json();
      const bannerItems = Array.isArray(data.banners)
        ? data.banners
        : data.banner
          ? [data.banner]
          : [];

      if (data.success && bannerItems.length) {
        setHeroBanners(
          bannerItems.map((banner) => ({
            ...banner,
            cache_key: latestBannerSync.changedAt || Date.now(),
          }))
        );
      } else {
        setHeroBanners([]);
      }
    } catch (error) {
      console.error("Fetch home hero banner error:", error);
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      const pageSize = 48;
      const latestProductSync = getLatestProductCatalogSync();
      const cacheKey = latestProductSync.changedAt || Date.now();
      const firstResponse = await fetch(
        `${buildApiUrl("/api/products")}?page=1&limit=${pageSize}&in_stock=1&t=${cacheKey}`,
        {
          cache: "no-store",
        }
      );
      const firstData = await firstResponse.json();

      if (firstData.success && Array.isArray(firstData.products)) {
        const totalPages = Math.max(1, Number(firstData.pagination?.totalPages || 1));
        const restPages =
          totalPages > 1
            ? await Promise.all(
                Array.from({ length: totalPages - 1 }, (_, index) =>
                  fetch(
                    `${buildApiUrl("/api/products")}?page=${
                      index + 2
                    }&limit=${pageSize}&in_stock=1&t=${cacheKey}`,
                    {
                      cache: "no-store",
                    }
                  ).then((response) => response.json())
                )
              )
            : [];
        const allProducts = [
          ...firstData.products,
          ...restPages.flatMap((pageData) =>
            pageData.success && Array.isArray(pageData.products) ? pageData.products : []
          ),
        ];
        const activeIds = allProducts.map((product) => Number(product.id));
        syncBlockedProductIds(activeIds);
        const blockedIds = getBlockedProductIds();
        setFeaturedProducts(
          allProducts.filter((product) => !blockedIds.includes(Number(product.id)))
        );
      }
    } catch (error) {
      console.error("Fetch featured products error:", error);
    }
  };

  useEffect(() => {
    fetchFeaturedProducts();

    return subscribeProductVisibilityChange(() => {
      fetchFeaturedProducts();
    });
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/categories"));
        const data = await response.json();

        if (!data.success || !Array.isArray(data.categories) || !data.categories.length) {
          return;
        }

        const parentCategories = data.categories.filter(
          (item) => item.parent_id === null
        );
        const childCategories = data.categories.filter(
          (item) => item.parent_id !== null
        );
        const childrenByParent = childCategories.reduce((acc, item) => {
          const key = item.parent_id;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push({
            id: item.id,
            name: item.name,
          });
          return acc;
        }, {});

        const mappedCollections = parentCategories.slice(0, 8).map((item) => ({
          id: item.id,
          title: item.name,
          desc: "Chọn danh mục con để xem nhanh sản phẩm.",
          children: childrenByParent[item.id] || [],
        }));

        if (mappedCollections.length) {
          setCollections(mappedCollections);
        }
      } catch (error) {
        console.error("Fetch categories error:", error);
      }
    };

    fetchHeroBanner();
    fetchCategories();
    fetchFeaturedProducts();
  }, []);

  useEffect(() => {
    return subscribeBannerChange(({ scope }) => {
      if (!scope || scope === "home_hero") {
        fetchHeroBanner();
      }
    });
  }, []);

  useEffect(() => {
    if (
      location.hash !== "#featured-products" &&
      !shouldScrollToFeaturedProducts
    ) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const element = document.getElementById("featured-products");
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [location.hash, shouldScrollToFeaturedProducts]);

  return (
    <div className="home-page">
      <Header />

      <main className="home-main">
        <HeroSection heroBanners={heroBanners} />
        <FeaturedProductsSection
          collections={collections}
          products={featuredProducts}
        />
        <StorySection />
        <NewsSection />
      </main>

      <Footer />
    </div>
  );
}

export default HomePage;
