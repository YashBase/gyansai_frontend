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
