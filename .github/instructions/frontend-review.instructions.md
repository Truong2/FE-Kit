---
applyTo: "**/*.{ts,tsx,js,jsx,md}"
---

Review frontend code against SRS references, implementation-plan decisions, build-checklist items, questions decisions, and Figma evidence when present.

## UI/Figma strict mode v1.0.0

Bản này ép UI task có Figma phải đi qua `UI Implementation Contract`. Khi Figma gate passed, Figma là visual source of truth; source UI/core component chỉ là implementation base. Agent không được tự động làm theo UI base source nếu lệch Figma. Trước PR cho UI task, dùng `FE figma-review <task-folder>` hoặc review evidence tương đương để kiểm tra screenshot/UI đã build so với Figma.

## SRS/Figma strict contract v1.0.0

- SRS task phải có Ma trận trace SRS → FE logic → UI → Test trước build.
- UI/Figma task phải có UI Node Implementation Matrix và Figma → Source component binding cụ thể.
- Không fallback về UI base source nếu Figma gate passed và chưa có waiver.
- PR cho UI/Figma task cần UI match review/evidence; Critical/High mismatch block PR.

## Ngôn ngữ output

Viết bằng tiếng Việt có dấu đầy đủ (theo `.frontend-delivery/rules/vietnamese-output.md`). Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
