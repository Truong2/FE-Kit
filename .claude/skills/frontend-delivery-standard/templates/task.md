# Tổng quan task

## 1. Metadata

| Field | Value |
|---|---|
| Task ID |  |
| Tên task |  |
| Owner |  |
| Trạng thái | Created |
| Plan version | v1 |

## 2. Phạm vi

### In scope

-

### Out of scope

-

## 3. Bản đồ tham chiếu SRS

| Hạng mục | Section SRS / nguồn | Ghi chú |
|---|---|---|
| Business rule |  |  |
| Acceptance criteria |  |  |
| Permission |  |  |
| Validation |  |  |
| Error behavior |  |  |

## 4. Bản đồ sử dụng API contract

| API / endpoint | Request DTO | Response DTO | Error DTO/status/code | Nguồn |
|---|---|---|---|---|
|  |  |  |  | SRS / API docs |

## 5. Bản đồ lỗi API và cách hiển thị FE

| Error case | FE display | Component/pattern | Message source | Ghi chú |
|---|---|---|---|---|
| Field validation | Inline field error |  | SRS/API/FE mapping |  |
| Business error | Form alert / toast / page error |  | SRS/API/FE mapping |  |
| 401/403 | Global auth/permission handler |  | Source rule |  |
| Network/server fallback | Toast/page error fallback |  | FE fallback |  |

## 6. Frontend context đã dùng

| Context | Vai trò | Trạng thái |
|---|---|---|
| `project-source-context.md` | Stack/folder/command | Chưa đọc |
| `.frontend-delivery/rules/` | Rule mặc định bắt buộc | Chưa đọc |
| `feature-source-context.md` | Feature mẫu/cách code feature mẫu nếu có | Chưa đọc / Không áp dụng |
| `design-context.md` | UI/Figma/shared component | Chưa đọc |

## 7. Figma reference

| Field | Value |
|---|---|
| Figma required | unknown |
| Figma link |  |
| Screenshot/reference |  |
| UI contract | `output/figma-extraction-summary.md` nếu có |

## 8. Planning files

| File | Vai trò |
|---|---|
| `planning/implementation-plan.md` | Quyết định architecture/flow/API/UI/error/test |
| `planning/build-checklist.md` | Verify plan trước/sau build |
| `planning/questions.md` | Handoff câu hỏi/blocker |
| `tracking/workflow-status.md` | Trạng thái machine-readable + Prompt bước tiếp theo |

## 9. Tóm tắt câu hỏi

| Question ID | Owner | Blocking? | Status |
|---|---|---|---|
|  |  |  |  |

## 10. Nhật ký quyết định

| Ngày | Quyết định | Lý do | Evidence |
|---|---|---|---|
|  |  |  |  |

---

Ghi chú ngôn ngữ: mọi nội dung Markdown phải viết bằng tiếng Việt có dấu đầy đủ. Cache marker: `vi-diacritics-rules-folder-v1.0.0`.
