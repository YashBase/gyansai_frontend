export function normalizeQuestionOptions(options) {
  if (!Array.isArray(options)) return [];

  return options.map((option, index) => {
    if (option && typeof option === "object") {
      const key = option.key || String.fromCharCode(65 + index);
      const text = option.text ?? option.value ?? option.label ?? "";
      return { key, text };
    }

    return { key: String.fromCharCode(65 + index), text: String(option ?? "") };
  });
}

export function normalizeAnswerValue(questionType, value) {
  if (value === null || value === undefined) return value;

  if (questionType === "mcq_multi") {
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .map((item) => item.toUpperCase());
    }

    if (typeof value === "string") {
      return value
        .split(/[|,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.toUpperCase());
    }

    return [];
  }

  if (questionType === "true_false") {
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return value.trim().toLowerCase();
  }

  if (questionType === "numerical") {
    if (typeof value === "number") return value;
    if (typeof value === "string") return value.trim();
  }

  if (typeof value === "string") return value.trim();
  return value;
}
