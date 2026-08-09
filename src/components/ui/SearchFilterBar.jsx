import f from "./SearchFilterBar.module.css";
import FilterDropdown from "./FilterDropdown";

/**
 * One consistent search + filter toolbar, used across every table page
 * (Students, Applications, Grantees, Scholarships, Funds, ...).
 *
 * Behaves like a typical e-commerce filter bar: pick values from the
 * dropdowns, and every active filter (plus the search term) shows up as
 * a removable chip underneath, with a "Clear all" link once anything
 * is active.
 *
 * Props:
 *  - search:        current search string
 *  - onSearchChange: (value) => void
 *  - searchPlaceholder: placeholder text for the search input
 *  - filters: [{ value, onChange, options: [{value,label}], label, width? }]
 *      The FIRST option in `options` is treated as each filter's "cleared"
 *      state (e.g. "All", "All Status") — this is already how every filter
 *      on every page is built.
 *  - resultCount / totalCount: optional, shows "x of y" next to the bar
 */
export default function SearchFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  resultCount,
  totalCount,
}) {
  const activeFilters = filters.filter(
    (flt) => flt.options?.[0] && flt.value !== flt.options[0].value
  );
  const hasSearch = Boolean(search);
  const hasAnyActive = hasSearch || activeFilters.length > 0;

  const clearAll = () => {
    onSearchChange("");
    filters.forEach((flt) => flt.onChange(flt.options[0].value));
  };

  return (
    <div className={f.wrap}>
      <div className={f.bar}>
        <div className={f.searchWrap}>
          <svg className={f.searchIcon} width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.6" />
            <line x1="13.6" y1="13.6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className={f.searchInput}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className={f.clearBtn}
              aria-label="Clear search"
              onClick={() => onSearchChange("")}
            >
              ✕
            </button>
          )}
        </div>

        {filters.map((flt) => (
          <FilterDropdown
            key={flt.label}
            label={flt.label}
            value={flt.value}
            onChange={flt.onChange}
            options={flt.options}
            width={flt.width}
            active={flt.value !== flt.options[0]?.value}
          />
        ))}

        {(resultCount !== undefined && totalCount !== undefined) && (
          <span className={f.count}>{resultCount} of {totalCount}</span>
        )}
      </div>

      {hasAnyActive && (
        <div className={f.chipRow}>
          {hasSearch && (
            <span className={f.chip}>
              Search: "{search}"
              <button type="button" className={f.chipX} aria-label="Remove search" onClick={() => onSearchChange("")}>✕</button>
            </span>
          )}
          {activeFilters.map((flt) => {
            const opt = flt.options.find((o) => o.value === flt.value);
            return (
              <span key={flt.label} className={f.chip}>
                {flt.label}: {opt?.label ?? flt.value}
                <button
                  type="button"
                  className={f.chipX}
                  aria-label={`Remove ${flt.label} filter`}
                  onClick={() => flt.onChange(flt.options[0].value)}
                >
                  ✕
                </button>
              </span>
            );
          })}
          <button type="button" className={f.clearAll} onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
