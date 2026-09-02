# Figma, UI fidelity và asset

Với task UI/Figma, không build nếu Figma gate chưa pass/waive/substitute hợp lệ.

`output/figma-extraction-summary.md` ghi Figma access, screenshot reference, token, component, state, layout, UI Implementation Contract và Asset Extraction Log bằng tiếng Việt.

## Luật visual source of truth

- Nếu `figma_gate_status=passed`, Figma evidence là visual source of truth cho screen/state trong task.
- Source UI/design system là implementation base và constraint kỹ thuật; không được tự động override Figma.
- Nếu Figma khác source component, agent phải map variant/props/class/token để match Figma hoặc hỏi Design/Dev.
- Chỉ được làm theo source base thay Figma khi có waiver/substitution rõ từ human/Design/Dev hoặc CR/screenshot được xác nhận.

## UI Implementation Contract

`FE figma` phải ghi rõ:

- Frame/node/screenshot cho từng screen/state.
- Layout/spacing/typography/color/radius/shadow phải match.
- Source component mapping: component nào, variant/props/class/style/token nào.
- Interaction/state behavior: loading, empty, error, success, disabled.
- Allowed deviation: điểm nào được lệch, vì sao, ai xác nhận.
- Blocker nếu thiếu state hoặc source component không match Figma.

`FE cook` không được implement UI từ trí nhớ, từ base source UI, hoặc từ component mặc định nếu contract Figma đã yêu cầu khác.

## Figma review trước PR

Task UI/Figma nên chạy `FE figma-review <task-folder>` trước PR. Nếu còn Critical/High visual mismatch chưa fix/waive thì không PR-ready.

Icon/vector/image mới phải quyết định SVG, JSX/TSX, PNG/WebP hoặc reuse existing asset theo source convention và target folder user cung cấp.


## UI Node Implementation Matrix và component binding

`FE figma` phải map từng node/component/state quan trọng thành bảng UI Node Implementation Matrix. Bảng này phải ghi visual requirement atomic như layout, spacing, typography, color, radius, shadow, border, icon/image, responsive và state. Mỗi dòng phải có source component cụ thể và props/variant/class/token cần dùng. Nếu source component không match Figma, ghi blocker/deviation và hỏi Design/Dev hoặc human; không được tự fallback về UI base source.

## Screenshot/evidence trước PR

Task UI/Figma phải có implementation screenshot hoặc evidence tương đương trước PR. `FE figma-review` phải phân loại mismatch Critical/High/Medium/Low. Critical/High chưa fix/waive thì không PR-ready.
