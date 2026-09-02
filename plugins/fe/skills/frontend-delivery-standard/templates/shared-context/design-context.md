---
doc_name: design-context
doc_version: 1.0.0
status: draft
owner:
last_updated:
---

# Design Context

File này mô tả design system, shared UI component, token, asset và Figma rule. Agent phải đọc file này khi task có UI hoặc cần quyết định component visual.

## 1. Design system

| Concern | Giá trị |
|---|---|
| UI library |  |
| Shared component path |  |
| Token path |  |
| Theme config |  |
| Icon system |  |
| Image asset path |  |

## 2. Shared UI components

| UI need | Component dùng | Path | Ghi chú |
|---|---|---|---|
| Button |  |  |  |
| Input |  |  |  |
| Select |  |  |  |
| Table/List |  |  |  |
| Modal/Dialog |  |  |  |
| Confirm dialog |  |  |  |
| Toast/message/snackbar |  |  |  |
| Form error/alert |  |  |  |
| Empty state |  |  |  |
| Loading/Skeleton |  |  |  |
| Page error/ErrorBoundary fallback |  |  |  |

## 3. Figma rule

- Nếu Figma gate passed, Figma là visual source of truth.
- Source component chỉ là implementation base.
- Không dùng default component nếu default lệch Figma.
- Phải map Figma node sang shared component cụ thể.
- Phải ghi props/variant/class/token cần dùng để match Figma.
- Nếu component không match bằng props/variant/class/token, phải ghi blocker hoặc hỏi Design/Dev.

## 4. Asset rule

| Asset type | Format ưu tiên | Path | Ghi chú |
|---|---|---|---|
| Icon | SVG / TSX icon / reuse existing |  |  |
| Illustration | SVG / PNG / WebP |  |  |
| Photo/image | WebP / PNG |  |  |

## 5. Visual deviation rule

| Severity | Ý nghĩa | Gate |
|---|---|---|
| Critical | Sai layout chính, thiếu component/state chính | Không PR |
| High | Sai variant/spacing/color/typography lớn | Không PR nếu chưa fix/waive |
| Medium | Lệch nhỏ không phá flow | Cần ghi rõ |
| Low | Polish nhỏ | Có thể follow-up nếu được chấp nhận |
