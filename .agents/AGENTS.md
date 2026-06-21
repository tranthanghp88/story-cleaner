# Persistent AI Natural Translation Rules

This document defines core behavioral constraints and guidelines for the AI Natural Translation pipeline within the Story Cleaner project. All future code modifications, prompts, tests, and translations MUST adhere strictly to these rules to prevent regressions.

---

## 1. Character Title Preservation (Regression Group 1)
All character titles are considered protected entities and must remain unaltered.
* **Protected Titles**: `thiếu chủ`, `công tử`, `thiếu gia`, `tứ thiếu gia`, `gia chủ`, `tộc trưởng`, `trưởng lão`, `đường chủ`, `điện chủ`, `các chủ`, etc.
* **Constraints**:
  - **Never remove** character titles from the text.
  - **Never replace** one title with another (e.g., do not replace `thiếu chủ` with `công tử` or `thiếu gia`).
  - **Never simplify or shorten** compound titles (e.g., if the original is `Triệu Gia thiếu chủ`, do not shorten to `Triệu Gia` or change to `Triệu Gia công tử`).

---

## 2. Convert Phrase Understanding (Regression Group 2)
Convert-style phrases must be translated dynamically by their intended meaning rather than literally (word-for-word).
* **Key Example**: `minh bạch` (meaning understanding/consent)
* **Constraints**:
  - Never translate literal words that sound unnatural or machine-translated (e.g., avoid "Minh bạch...", "Hiểu, ta sớm nên hiểu.").
  - Always rewrite to natural Vietnamese sentences depending on context, such as:
    - `"Ta hiểu rồi, lẽ ra ta nên hiểu từ sớm."`
    - `"Phải, ta đáng lẽ nên hiểu điều đó từ lâu."`

---

## 3. Convert Sentence Structure & Contextual Rewriting (Regression Group 3)
Awkward Chinese sentence structures must be rewritten based on context and speaker intent.
* **Examples**:
  - `"Nói đến..."` / `"Nói chuyện..."`
  - `"Đã gặp sư phụ..."`
  - `"Ngươi bị bỏ..."`
* **Constraints**:
  - Do not preserve the original Chinese sentence structure if it translates to awkward, confusing, or literal wording.
  - Read surrounding dialogue and actions to identify intent, then rewrite naturally (e.g., translate the dismissive `"Ngươi... bị bỏ."` to `"Ngươi... đi đi."` or `"Ngươi đi đi."` rather than the literal `"Ngươi... bị bỏ rồi."`).
  - Prioritize speaker meaning and natural readability over word-matching (`Meaning > Literal wording`), while keeping all plot facts, character identities, and core events intact.
