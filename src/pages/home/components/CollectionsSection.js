import { useEffect, useState } from "react";

function CollectionsSection({ collections }) {
  const [openParentId, setOpenParentId] = useState(null);
  const [selectedChildByParent, setSelectedChildByParent] = useState({});

  useEffect(() => {
    setSelectedChildByParent(
      collections.reduce((acc, item) => {
        acc[item.id] = item.children?.[0] || null;
        return acc;
      }, {})
    );
  }, [collections]);

  const handleSelectChild = (parentId, child) => {
    setSelectedChildByParent((prev) => ({
      ...prev,
      [parentId]: child,
    }));
    setOpenParentId(parentId);
  };

  return (
    <section
      className="collections"
      style={{
        "--collection-cols": Math.min(
          5,
          Math.max(1, collections?.length || 1)
        ),
      }}
    >
      {collections.map((item) => (
        <article
          className={`collection-card ${
            openParentId === item.id ? "collection-card-open" : ""
          }`}
          key={item.id || item.title}
          onMouseEnter={() => setOpenParentId(item.id)}
          onMouseLeave={() => setOpenParentId(null)}
        >
          <button
            type="button"
            className="collection-parent"
            aria-expanded={openParentId === item.id}
            onClick={() =>
              setOpenParentId((prev) => (prev === item.id ? null : item.id))
            }
            onFocus={() => setOpenParentId(item.id)}
          >
            <span>{item.title}</span>
            {item.children?.length ? (
              <span className="collection-trigger-icon" aria-hidden="true">
                ▾
              </span>
            ) : null}
          </button>

          {item.children?.length ? (
            <>
              <div className="collection-dropdown">
                {item.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    className={`collection-option ${
                      selectedChildByParent[item.id]?.id === child.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() => handleSelectChild(item.id, child)}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </article>
      ))}
    </section>
  );
}

export default CollectionsSection;
