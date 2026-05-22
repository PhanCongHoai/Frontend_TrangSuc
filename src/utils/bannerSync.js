const BANNER_SYNC_EVENT = "banner-change";
const BANNER_SYNC_KEY = "bannerSync";

function dispatchBannerSync(detail) {
  window.dispatchEvent(
    new CustomEvent(BANNER_SYNC_EVENT, {
      detail,
    })
  );
}

export function notifyBannerChanged(scope = "home_hero") {
  const detail = {
    scope,
    changedAt: Date.now(),
  };

  localStorage.setItem(BANNER_SYNC_KEY, JSON.stringify(detail));
  dispatchBannerSync(detail);
}

export function getLatestBannerSync() {
  try {
    const rawValue = localStorage.getItem(BANNER_SYNC_KEY);

    if (!rawValue) {
      return {
        scope: "home_hero",
        changedAt: 0,
      };
    }

    const parsedValue = JSON.parse(rawValue);

    return {
      scope: parsedValue?.scope || "home_hero",
      changedAt: Number(parsedValue?.changedAt || 0),
    };
  } catch (error) {
    return {
      scope: "home_hero",
      changedAt: 0,
    };
  }
}

export function subscribeBannerChange(callback) {
  const handleCustomEvent = (event) => {
    callback(event.detail);
  };

  const handleStorageEvent = (event) => {
    if (event.key !== BANNER_SYNC_KEY) {
      return;
    }

    try {
      callback(
        event.newValue
          ? JSON.parse(event.newValue)
          : {
              scope: "home_hero",
              changedAt: Date.now(),
            }
      );
    } catch (error) {
      callback({
        scope: "home_hero",
        changedAt: Date.now(),
      });
    }
  };

  window.addEventListener(BANNER_SYNC_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(BANNER_SYNC_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}
