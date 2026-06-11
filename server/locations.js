/**
 * Master location classification — PIN-code based.
 * To add/change PIN coverage, edit only this file (no SQL changes needed).
 *
 * Rules:
 *   Chennai       : PIN in 600001..600118, or in [600129, 600130, 600131, 600600]
 *   Outer Chennai : PIN in 600119..600128, or in [603103, 603202, 603203, 602001]
 *                   (with city-name fallback for known suburbs)
 *   Other District: any other valid 6-digit PIN, OR has city/state set but PIN not Chennai/Outer
 */

export const LOC_CHENNAI = {
  pinRanges: [[600001, 600118]],
  pins:      [600129, 600130, 600131, 600600],
};

export const LOC_OUTER = {
  pinRanges: [[600119, 600128]],
  pins:      [603103, 603202, 603203, 602001],
  cityPatterns: [
    'tambaram', 'chengalpattu', 'avadi', 'poonamallee', 'guduvanchery',
    'kelambakkam', 'maraimalai', 'thiruvallur', 'tiruvallur',
    'kanchipuram', 'sriperumbudur', 'pallavaram',
  ],
};

/**
 * SQL fragment that extracts the first 6-digit number from zip (preferred) or city.
 * Returns INTEGER or NULL.  Same expression used everywhere so PG can plan it once.
 */
export const PIN_EXTRACT = `(
  CASE
    WHEN substring(COALESCE(NULLIF(l.zip,''), l.city, '') FROM '[0-9]{6}') ~ '^[0-9]{6}$'
    THEN substring(COALESCE(NULLIF(l.zip,''), l.city, '') FROM '[0-9]{6}')::int
    ELSE NULL
  END
)`;

function pinClause(spec) {
  const parts = [];
  for (const [a, b] of spec.pinRanges || []) parts.push(`(${PIN_EXTRACT} BETWEEN ${a} AND ${b})`);
  if (spec.pins?.length) parts.push(`(${PIN_EXTRACT} IN (${spec.pins.join(',')}))`);
  return parts.length ? '(' + parts.join(' OR ') + ')' : 'FALSE';
}

function cityClause(spec) {
  if (!spec.cityPatterns?.length) return null;
  const re = spec.cityPatterns.join('|');
  return `(LOWER(COALESCE(l.city,'')) ~ '(${re})')`;
}

/* Combined predicates (PIN ∪ city-fallback for outer).
 * IMPORTANT: wrap in COALESCE(..., FALSE) so a NULL PIN yields FALSE, not NULL.
 * Without this, `PIN BETWEEN a AND b` is NULL when there's no PIN, and the
 * "Other District" filter `NOT CHENNAI_PRED AND NOT OUTER_PRED AND ...` becomes
 * `NOT NULL` = NULL → the lead is counted in NO location bucket (silently dropped).
 * A city-only lead like "Kanniyakumari" must fall through to Other District. */
export const CHENNAI_PRED = `COALESCE(${pinClause(LOC_CHENNAI)}, FALSE)`;

const outerPin  = pinClause(LOC_OUTER);
const outerCity = cityClause(LOC_OUTER);
export const OUTER_PRED = `COALESCE(${outerCity ? `(${outerPin} OR ${outerCity})` : outerPin}, FALSE)`;

export const HAS_LOC_PRED = `(${PIN_EXTRACT} IS NOT NULL OR TRIM(COALESCE(l.city,'')) <> '' OR l.state_id IS NOT NULL)`;
