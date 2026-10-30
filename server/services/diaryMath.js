/**
 * Transparent diary grading: weighted criteria → period total with full breakdown.
 */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Normalize a raw score to the scheme scale (e.g. 5 or 100).
 * penalty criteria: higher raw = worse → inverted after normalize.
 */
function normalizeScore(score, maxScore, scaleMax, direction = 'higher_better') {
  const max = Number(maxScore) || scaleMax;
  if (!max || score == null || Number.isNaN(Number(score))) return null;
  let ratio = clamp(Number(score) / max, 0, 1);
  if (direction === 'lower_better') ratio = 1 - ratio;
  return ratio * scaleMax;
}

function aggregateScores(values, method = 'avg') {
  const nums = values.filter((v) => v != null && !Number.isNaN(Number(v))).map(Number);
  if (!nums.length) return null;
  if (method === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (method === 'max') return Math.max(...nums);
  if (method === 'min') return Math.min(...nums);
  if (method === 'latest') return nums[nums.length - 1];
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * @param {object} scheme
 * @param {Array} parts - scheme parts with criteria meta
 * @param {Array} entries - diary entries for student/group/period
 */
function computePeriodGrade({ scheme, parts, entries }) {
  const scaleMax = Number(scheme.scale_max) || 5;
  const used = [];
  let weightSum = 0;
  let weighted = 0;

  for (const part of parts) {
    const partEntries = entries.filter((e) => e.criteria_id === part.criteria_id);
    const normalized = partEntries
      .map((e) =>
        normalizeScore(
          e.score,
          e.max_score || part.default_max_score || scaleMax,
          scaleMax,
          part.direction || 'higher_better'
        )
      )
      .filter((v) => v != null);

    const agg = aggregateScores(normalized, part.aggregation || 'avg');
    const weight = Number(part.weight) || 0;
    const label = part.label_override || part.criteria_name;

    const contribution = agg == null || weight <= 0 ? null : (agg * weight) / 100;

    if (contribution != null) {
      weighted += contribution;
      weightSum += weight;
    }

    used.push({
      part_id: part.id,
      criteria_id: part.criteria_id,
      criteria_code: part.criteria_code,
      label,
      weight,
      aggregation: part.aggregation || 'avg',
      direction: part.direction || 'higher_better',
      entries_count: partEntries.length,
      raw_entries: partEntries.map((e) => ({
        id: e.id,
        title: e.title,
        detail: e.detail,
        score: e.score,
        max_score: e.max_score,
        comment: e.comment,
        graded_at: e.graded_at,
        teacher_name: e.teacher_name,
      })),
      aggregated_on_scale: agg == null ? null : round2(agg),
      contribution: contribution == null ? null : round2(contribution),
      missing: agg == null,
    });
  }

  // Re-normalize if weights don't sum to 100 among present parts
  let total = null;
  let formulaParts = [];
  if (weightSum > 0) {
    total = round2((weighted * 100) / weightSum);
    formulaParts = used
      .filter((p) => p.contribution != null)
      .map((p) => {
        const effectiveW = round2((p.weight * 100) / weightSum);
        return `${effectiveW}%×${p.label}(${p.aggregated_on_scale})`;
      });
  }

  return {
    scale_max: scaleMax,
    total,
    total_display: total == null ? null : round1(total),
    weight_used: weightSum,
    formula_text:
      formulaParts.length > 0
        ? `Итог = (${formulaParts.join(' + ')})  →  ${total} / ${scaleMax}`
        : 'Недостаточно оценок для расчёта по формуле',
    parts: used,
    entries_total: entries.length,
  };
}

module.exports = {
  clamp,
  round1,
  round2,
  normalizeScore,
  aggregateScores,
  computePeriodGrade,
};
