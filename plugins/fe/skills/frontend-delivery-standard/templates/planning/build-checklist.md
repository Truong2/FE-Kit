# Checklist build

> Checklist lean nhưng đủ gate. Chi tiết rule nằm trong `.frontend-delivery/rules/`. Không xóa nhóm gate nếu không áp dụng; hãy đánh dấu `Không áp dụng` và ghi lý do ngắn.

## 1. Gate trước khi code

| ID | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| GATE-01 | `workflow-status.md` đã có Input ledger đầy đủ từ FE plan | Chưa làm |  |
| GATE-02 | Đã đọc đúng input trong Input ledger, không đọc lan man | Chưa làm |  |
| GATE-03 | Đã đọc SRS/API/requirement liên quan | Chưa làm / Không áp dụng |  |
| GATE-04 | Đã đọc `.frontend-delivery/rules/` liên quan | Chưa làm |  |
| GATE-05 | Đã kiểm tra feature mẫu nếu có | Chưa làm / Không áp dụng |  |
| GATE-06 | Không còn blocking question; nếu có thì next phải là `FE input-sync`, không được `FE cook` | Chưa làm |  |
| GATE-07 | Nếu có Figma, đã có UI contract/gate phù hợp | Chưa làm / Không áp dụng |  |
| GATE-08 | Đã giới hạn file cần đọc/sửa để giữ token lean | Chưa làm |  |

## 2. SRS coverage

| ID | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| SRS-01 | Happy path đã trace sang FE behavior | Chưa làm / Không áp dụng |  |
| SRS-02 | Validation error đã trace | Chưa làm / Không áp dụng |  |
| SRS-03 | Business error/status/code đã trace | Chưa làm / Không áp dụng |  |
| SRS-04 | Permission/session/401/403 đã trace hoặc giao cho interceptor | Chưa làm / Không áp dụng |  |
| SRS-05 | Loading/empty/success/error/fallback state đã trace | Chưa làm / Không áp dụng |  |
| SRS-06 | Không tự bịa field/API/status ngoài SRS/API | Chưa làm |  |

## 3. API / Error display

| ID | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| API-01 | Request DTO/response DTO đúng contract | Chưa làm / Không áp dụng |  |
| API-02 | Mapper/service tách khỏi component UI | Chưa làm / Không áp dụng |  |
| API-03 | Query/mutation key dùng convention/constant của project | Chưa làm / Không áp dụng |  |
| ERR-01 | Error DTO/status/code map sang inline/form alert/toast/page/redirect/fallback | Chưa làm / Không áp dụng |  |
| ERR-02 | Không show raw backend message nếu chưa được confirm | Chưa làm / Không áp dụng |  |
| ERR-03 | Ưu tiên core toast/modal/error component nếu project có | Chưa làm / Không áp dụng |  |

## 4. State / Hook / Clean code

| ID | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| STATE-01 | State ownership đúng scope: local/module/query/global | Chưa làm |  |
| STATE-02 | Không duplicate server state vào global store | Chưa làm / Không áp dụng |  |
| HOOK-01 | Hook chỉ chứa orchestration/data logic, không nhét JSX/UI | Chưa làm / Không áp dụng |  |
| CODE-01 | Page/component/hook/service tách trách nhiệm | Chưa làm |  |
| CODE-02 | Không dùng `any` để né DTO/type | Chưa làm |  |
| CODE-03 | Không tạo global state/custom UI/hook ngoài plan | Chưa làm |  |
| CODE-04 | Không hardcode display string nếu project có i18n | Chưa làm / Không áp dụng |  |

## 5. UI / Figma

| ID | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| UI-01 | Figma node/state đã bind sang component/props/token/class | Không áp dụng |  |
| UI-02 | Không dùng source default nếu lệch Figma | Không áp dụng |  |
| UI-03 | Loading/empty/error/disabled/responsive state đúng UI contract | Không áp dụng |  |
| UI-04 | Screenshot/UI review evidence đã cập nhật nếu required | Không áp dụng |  |
| UI-05 | Playwright screenshot diff đã chạy hoặc ghi rõ không áp dụng | Không áp dụng |  |

## 6. Scope / Evidence / Test

| ID | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| SCOPE-01 | File đã sửa nằm trong plan hoặc đã input-sync update | Chưa làm |  |
| SCOPE-02 | Không refactor/sửa file ngoài scope chỉ vì thấy tiện | Chưa làm |  |
| EVD-01 | Command evidence log ghi rõ command chạy thật/chưa chạy | Chưa làm |  |
| TEST-01 | Typecheck/lint/test/build liên quan đã chạy hoặc ghi rõ lý do chưa chạy | Chưa làm |  |
| REVIEW-01 | Review report đã tạo/cập nhật | Chưa làm |  |
| PR-01 | Không còn Critical/High issue | Chưa làm |  |
