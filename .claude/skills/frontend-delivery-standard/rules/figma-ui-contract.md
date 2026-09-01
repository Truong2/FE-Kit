# Figma/UI Contract

- Khi Figma gate passed, Figma là visual source of truth.
- `FE figma` phải tạo `output/figma-extraction-summary.md` có UI Implementation Contract và UI Node Implementation Matrix.
- Mỗi Figma node/state quan trọng phải map sang source component/props/variant/token/class hoặc ghi blocker.
- Shared component/core UI là implementation base, không phải visual truth nếu lệch Figma.
- Asset mới phải có quyết định export/reuse/no-new-asset rõ ràng.
- Trước PR cho UI/Figma task, cần UI match review/evidence hoặc waiver rõ ràng.
